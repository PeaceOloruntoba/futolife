-- Referral records, user moderation and post reporting.
alter table public.profiles add column if not exists is_suspended boolean not null default false;
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists suspension_reason text;
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists suspended_by uuid references auth.users(id) on delete set null;
update public.profiles set referral_code=lower(substr(replace(gen_random_uuid()::text,'-',''),1,12)) where referral_code is null;
alter table public.profiles alter column referral_code set default lower(substr(replace(gen_random_uuid()::text,'-',''),1,12));
alter table public.profiles alter column referral_code set not null;
create unique index if not exists profiles_referral_code_unique on public.profiles(lower(referral_code));

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referrer_id<>referred_id)
);
create index if not exists referrals_referrer_idx on public.referrals(referrer_id,created_at);
alter table public.referrals enable row level security;
drop policy if exists "Users can see their own referral edges" on public.referrals;
create policy "Users can see their own referral edges" on public.referrals for select to authenticated
using ((select auth.uid()) in (referrer_id,referred_id) or public.is_admin());

create or replace function public.register_profile_referral()
returns trigger language plpgsql security definer set search_path = '' as $$
declare submitted_code text; inviter uuid;
begin
  select nullif(lower(trim(u.raw_user_meta_data->>'referral_code')),'') into submitted_code from auth.users u where u.id=new.id;
  if submitted_code is null then return new; end if;
  select p.id into inviter from public.profiles p where lower(p.referral_code)=submitted_code and p.id<>new.id;
  if inviter is not null then
    insert into public.referrals(referrer_id,referred_id) values(inviter,new.id) on conflict(referred_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists register_profile_referral on public.profiles;
create trigger register_profile_referral after insert on public.profiles for each row execute function public.register_profile_referral();

create or replace function public.get_my_referral_network()
returns table(profile_id uuid,display_name text,depth integer,joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with recursive network(profile_id,depth,joined_at) as (
    select r.referred_id,1,r.created_at from public.referrals r where r.referrer_id=auth.uid()
    union all
    select child.referred_id,parent.depth+1,child.created_at
      from network parent join public.referrals child on child.referrer_id=parent.profile_id
  )
  select n.profile_id,p.display_name,n.depth,n.joined_at from network n
  join public.profiles p on p.id=n.profile_id order by n.depth,n.joined_at;
$$;
revoke all on function public.get_my_referral_network() from public;
grant execute on function public.get_my_referral_network() to authenticated;

create or replace function public.is_user_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select not p.is_suspended from public.profiles p where p.id=auth.uid()),false);
$$;
revoke all on function public.is_user_active() from public;
grant execute on function public.is_user_active() to authenticated;

create or replace function public.guard_profile_suspension()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.is_suspended is distinct from old.is_suspended or new.suspension_reason is distinct from old.suspension_reason or new.suspended_at is distinct from old.suspended_at or new.suspended_by is distinct from old.suspended_by or new.referral_code is distinct from old.referral_code) and not public.is_admin() then
    raise exception 'Only an administrator can change account status';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_suspension on public.profiles;
create trigger guard_profile_suspension before update on public.profiles for each row execute function public.guard_profile_suspension();
drop policy if exists "Admins can manage student profiles" on public.profiles;
create policy "Admins can manage student profiles" on public.profiles for update to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Authenticated users can discover profiles" on public.profiles;
create policy "Authenticated users can discover profiles" on public.profiles for select to authenticated
using (not is_suspended or id=(select auth.uid()) or public.is_admin());

drop policy if exists "Users can request friendship" on public.friendships;
create policy "Users can request friendship" on public.friendships for insert to authenticated with check (
  (select auth.uid())=requester_id and status='pending' and public.is_user_active() and
  exists(select 1 from public.profiles p where p.id=addressee_id and not p.is_suspended)
);
drop policy if exists "Recipients can respond to requests" on public.friendships;
create policy "Recipients can respond to requests" on public.friendships for update to authenticated
using ((select auth.uid())=addressee_id and status='pending' and public.is_user_active())
with check ((select auth.uid())=addressee_id and status in ('accepted','declined') and public.is_user_active());

drop policy if exists "Authors can create posts" on public.posts;
create policy "Authors can create posts" on public.posts for insert to authenticated with check ((select auth.uid())=author_id and public.is_user_active());
drop policy if exists "Users can read their friends posts" on public.posts;
create policy "Users can read their friends posts" on public.posts for select to authenticated using (
  public.is_admin() or (public.is_user_active() and (author_id=(select auth.uid()) or exists(select 1 from public.friendships f where f.status='accepted' and
    ((f.requester_id=(select auth.uid()) and f.addressee_id=author_id) or (f.addressee_id=(select auth.uid()) and f.requester_id=author_id)))))
);
drop policy if exists "Authors can edit posts" on public.posts;
create policy "Authors can edit posts" on public.posts for update to authenticated using ((select auth.uid())=author_id and public.is_user_active()) with check ((select auth.uid())=author_id and public.is_user_active());
drop policy if exists "Authors can delete posts" on public.posts;
create policy "Authors can delete posts" on public.posts for delete to authenticated using ((select auth.uid())=author_id and public.is_user_active());
drop policy if exists "Users can react to visible posts" on public.post_reactions;
create policy "Users can react to visible posts" on public.post_reactions for insert to authenticated with check ((select auth.uid())=profile_id and public.is_user_active() and exists(select 1 from public.posts p where p.id=post_id));
drop policy if exists "Users can remove their reactions" on public.post_reactions;
create policy "Users can remove their reactions" on public.post_reactions for delete to authenticated using ((select auth.uid())=profile_id and public.is_user_active());
drop policy if exists "Users can comment on visible posts" on public.post_comments;
create policy "Users can comment on visible posts" on public.post_comments for insert to authenticated with check ((select auth.uid())=author_id and public.is_user_active() and exists(select 1 from public.posts p where p.id=post_id));
drop policy if exists "Authors can delete their comments" on public.post_comments;
create policy "Authors can delete their comments" on public.post_comments for delete to authenticated using ((select auth.uid())=author_id and public.is_user_active());
drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages" on public.messages for insert to authenticated with check (sender_id=(select auth.uid()) and public.is_user_active() and public.is_conversation_member(conversation_id));

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete set null,
  post_key uuid not null,
  post_author_id uuid references public.profiles(id) on delete set null,
  post_snapshot text not null default '',
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null check(reason in ('spam','harassment','hate_or_abuse','sexual_content','violence','false_information','other')),
  details text check(details is null or char_length(details)<=1000),
  status text not null default 'pending' check(status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index if not exists post_reports_one_per_user on public.post_reports(post_key,reporter_id);
create index if not exists post_reports_post_idx on public.post_reports(post_key,created_at);
alter table public.post_reports enable row level security;
drop policy if exists "Users can report visible posts" on public.post_reports;
create policy "Users can report visible posts" on public.post_reports for insert to authenticated with check (
  reporter_id=(select auth.uid()) and public.is_user_active() and exists(select 1 from public.posts p where p.id=post_id and p.author_id<>(select auth.uid()))
);
drop policy if exists "Users can read their own reports" on public.post_reports;
create policy "Users can read their own reports" on public.post_reports for select to authenticated using (reporter_id=(select auth.uid()) or public.is_admin());
drop policy if exists "Admins can update report status" on public.post_reports;
create policy "Admins can update report status" on public.post_reports for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "Admins can remove posts with five reports" on public.posts;
create policy "Admins can remove posts with five reports" on public.posts for delete to authenticated using (
  public.is_admin() and (select count(*) from public.post_reports r where r.post_key=posts.id)>=5
);

create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_user_active() and exists(
    select 1 from public.conversation_members mine
    join public.conversations c on c.id=mine.conversation_id
    where mine.conversation_id=target_conversation and mine.profile_id=auth.uid()
      and (c.kind='group' or exists(
        select 1 from public.conversation_members theirs
        join public.friendships f on f.status='accepted' and
          ((f.requester_id=auth.uid() and f.addressee_id=theirs.profile_id) or (f.addressee_id=auth.uid() and f.requester_id=theirs.profile_id))
        where theirs.conversation_id=target_conversation and theirs.profile_id<>auth.uid()
      ))
  );
$$;

create or replace function public.capture_reported_post()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.post_key:=new.post_id;
  select p.body,p.author_id into new.post_snapshot,new.post_author_id from public.posts p where p.id=new.post_id;
  if new.post_snapshot is null then raise exception 'Post no longer exists'; end if;
  return new;
end;
$$;
drop trigger if exists capture_reported_post on public.post_reports;
create trigger capture_reported_post before insert on public.post_reports for each row execute function public.capture_reported_post();

-- Referral and report history intentionally persists when a reported post is deleted.

drop policy if exists "Authors can tag friends in posts" on public.post_tags;
create policy "Authors can tag friends in posts" on public.post_tags for insert to authenticated with check (
  public.is_user_active() and exists(select 1 from public.posts p where p.id=post_id and p.author_id=(select auth.uid())) and
  exists(select 1 from public.friendships f where f.status='accepted' and
    ((f.requester_id=(select auth.uid()) and f.addressee_id=profile_id) or (f.addressee_id=(select auth.uid()) and f.requester_id=profile_id)))
);

create or replace function public.open_direct_conversation(other_profile uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); found_id uuid; new_id uuid;
begin
  if caller is null or caller=other_profile or not public.is_user_active() then raise exception 'Invalid conversation participants'; end if;
  if not exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=caller and f.addressee_id=other_profile) or (f.addressee_id=caller and f.requester_id=other_profile))) then raise exception 'You can only chat with accepted friends'; end if;
  select c.id into found_id from public.conversations c
   where c.kind='direct'
   and (select count(*) from public.conversation_members m where m.conversation_id=c.id)=2
   and exists(select 1 from public.conversation_members m where m.conversation_id=c.id and m.profile_id=caller)
   and exists(select 1 from public.conversation_members m where m.conversation_id=c.id and m.profile_id=other_profile)
   limit 1;
  if found_id is not null then return found_id; end if;
  insert into public.conversations(kind,created_by) values('direct',caller) returning id into new_id;
  insert into public.conversation_members(conversation_id,profile_id) values(new_id,caller),(new_id,other_profile);
  return new_id;
end; $$;

create or replace function public.create_group_conversation(group_title text, friend_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); new_id uuid; friend_id uuid;
begin
  if caller is null or not public.is_user_active() or char_length(trim(group_title)) not between 1 and 80 then raise exception 'Group name must be 1 to 80 characters'; end if;
  if coalesce(array_length(friend_ids,1),0)<2 or array_length(friend_ids,1)>49 then raise exception 'Select between 2 and 49 friends'; end if;
  foreach friend_id in array friend_ids loop
    if friend_id=caller or not exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=caller and f.addressee_id=friend_id) or (f.addressee_id=caller and f.requester_id=friend_id))) then raise exception 'Group chats can include accepted friends only'; end if;
  end loop;
  insert into public.conversations(kind,title,created_by) values('group',trim(group_title),caller) returning id into new_id;
  insert into public.conversation_members(conversation_id,profile_id) values(new_id,caller);
  insert into public.conversation_members(conversation_id,profile_id) select new_id,distinct_id from (select distinct unnest(friend_ids) as distinct_id) ids;
  return new_id;
end; $$;
