-- FUTO Life social foundation: discoverable profiles, accepted friendships,
-- tagged posts, reactions, comments, direct chats and group chats.

-- Social discovery requires signed-in users to read public profile fields.
drop policy if exists "Profiles are viewable by their owner" on public.profiles;
create policy "Authenticated users can discover profiles" on public.profiles
for select to authenticated using (true);

alter table public.profiles add column if not exists bio text check (bio is null or char_length(bio) <= 280);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_unique on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_pending on public.friendships (addressee_id, status);
alter table public.friendships enable row level security;
drop policy if exists "Users can read their friendships" on public.friendships;
create policy "Users can read their friendships" on public.friendships for select to authenticated
using ((select auth.uid()) in (requester_id, addressee_id));
drop policy if exists "Users can request friendship" on public.friendships;
create policy "Users can request friendship" on public.friendships for insert to authenticated
with check ((select auth.uid()) = requester_id and status = 'pending' and exists(select 1 from public.profiles p where p.id = addressee_id));
drop policy if exists "Recipients can respond to requests" on public.friendships;
create policy "Recipients can respond to requests" on public.friendships for update to authenticated
using ((select auth.uid()) = addressee_id and status = 'pending')
with check ((select auth.uid()) = addressee_id and status in ('accepted','declined'));
drop policy if exists "Requesters can cancel requests" on public.friendships;
create policy "Requesters can cancel requests" on public.friendships for delete to authenticated using ((select auth.uid()) = requester_id and status = 'pending');
drop policy if exists "Friends can end friendship" on public.friendships;
create policy "Friends can end friendship" on public.friendships for delete to authenticated using ((select auth.uid()) in (requester_id,addressee_id) and status = 'accepted');

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_created_at_idx on public.posts (created_at desc);
alter table public.posts enable row level security;
drop policy if exists "Signed in users can read posts" on public.posts;
create policy "Signed in users can read posts" on public.posts for select to authenticated using (true);
drop policy if exists "Authors can create posts" on public.posts;
create policy "Authors can create posts" on public.posts for insert to authenticated with check ((select auth.uid()) = author_id);
drop policy if exists "Authors can edit posts" on public.posts;
create policy "Authors can edit posts" on public.posts for update to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
drop policy if exists "Authors can delete posts" on public.posts;
create policy "Authors can delete posts" on public.posts for delete to authenticated using ((select auth.uid()) = author_id);

create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);
alter table public.post_tags enable row level security;
drop policy if exists "Signed in users can read post tags" on public.post_tags;
create policy "Signed in users can read post tags" on public.post_tags for select to authenticated using (true);
drop policy if exists "Authors can tag friends in posts" on public.post_tags;
create policy "Authors can tag friends in posts" on public.post_tags for insert to authenticated with check (
  exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())) and
  exists (select 1 from public.friendships f where f.status = 'accepted' and
    ((f.requester_id = (select auth.uid()) and f.addressee_id = profile_id) or (f.addressee_id = (select auth.uid()) and f.requester_id = profile_id)))
);

create table if not exists public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);
alter table public.post_reactions enable row level security;
drop policy if exists "Signed in users can read reactions" on public.post_reactions;
create policy "Signed in users can read reactions" on public.post_reactions for select to authenticated using (true);
drop policy if exists "Users can react to posts" on public.post_reactions;
create policy "Users can react to posts" on public.post_reactions for insert to authenticated with check ((select auth.uid()) = profile_id);
drop policy if exists "Users can remove their reactions" on public.post_reactions;
create policy "Users can remove their reactions" on public.post_reactions for delete to authenticated using ((select auth.uid()) = profile_id);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;
drop policy if exists "Signed in users can read comments" on public.post_comments;
create policy "Signed in users can read comments" on public.post_comments for select to authenticated using (true);
drop policy if exists "Users can comment on posts" on public.post_comments;
create policy "Users can comment on posts" on public.post_comments for insert to authenticated with check ((select auth.uid()) = author_id);
drop policy if exists "Authors can delete their comments" on public.post_comments;
create policy "Authors can delete their comments" on public.post_comments for delete to authenticated using ((select auth.uid()) = author_id);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct','group')),
  title text check (title is null or char_length(title) between 1 and 80),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((kind = 'direct' and title is null) or kind = 'group')
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index if not exists conversation_members_profile_idx on public.conversation_members (profile_id, conversation_id);
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
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
revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;
drop policy if exists "Members can view conversations" on public.conversations;
create policy "Members can view conversations" on public.conversations for select to authenticated using (public.is_conversation_member(id));
drop policy if exists "Members can view memberships" on public.conversation_members;
create policy "Members can view memberships" on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id));
drop policy if exists "Members can read messages" on public.messages;
create policy "Members can read messages" on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));
drop policy if exists "Members can send messages" on public.messages;
create policy "Members can send messages" on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id)
);

create or replace function public.open_direct_conversation(other_profile uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); found_id uuid; new_id uuid;
begin
  if caller is null or caller = other_profile then raise exception 'Invalid conversation participants'; end if;
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
revoke all on function public.open_direct_conversation(uuid) from public;
grant execute on function public.open_direct_conversation(uuid) to authenticated;

create or replace function public.create_group_conversation(group_title text, friend_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); new_id uuid; friend_id uuid;
begin
  if caller is null or char_length(trim(group_title)) not between 1 and 80 then raise exception 'Group name must be 1 to 80 characters'; end if;
  if coalesce(array_length(friend_ids,1),0) < 2 or array_length(friend_ids,1) > 49 then raise exception 'Select between 2 and 49 friends'; end if;
  foreach friend_id in array friend_ids loop
    if friend_id=caller or not exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=caller and f.addressee_id=friend_id) or (f.addressee_id=caller and f.requester_id=friend_id))) then raise exception 'Group chats can include accepted friends only'; end if;
  end loop;
  insert into public.conversations(kind,title,created_by) values('group',trim(group_title),caller) returning id into new_id;
  insert into public.conversation_members(conversation_id,profile_id) values(new_id,caller);
  insert into public.conversation_members(conversation_id,profile_id) select new_id, distinct_id from (select distinct unnest(friend_ids) as distinct_id) ids;
  return new_id;
end; $$;
revoke all on function public.create_group_conversation(text,uuid[]) from public;
grant execute on function public.create_group_conversation(text,uuid[]) to authenticated;

-- User supplied avatars live in a public bucket; paths are namespaced by auth user ID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-avatars','profile-avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "Avatar images are public" on storage.objects;
create policy "Avatar images are public" on storage.objects for select to public using (bucket_id='profile-avatars');
drop policy if exists "Users can upload their avatar" on storage.objects;
create policy "Users can upload their avatar" on storage.objects for insert to authenticated with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users can update their avatar" on storage.objects;
create policy "Users can update their avatar" on storage.objects for update to authenticated using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users can delete their avatar" on storage.objects;
create policy "Users can delete their avatar" on storage.objects for delete to authenticated using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
