-- Replace the one administrator role with least-privilege module roles.
alter table public.user_roles drop constraint if exists user_roles_role_check;
insert into public.user_roles(user_id,role)
select user_id,'super_admin' from public.user_roles where role='admin'
on conflict do nothing;
delete from public.user_roles where role='admin';
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('super_admin','opportunities_admin','community_admin','platform_admin'));
create unique index if not exists user_roles_one_module_role_per_user
  on public.user_roles(user_id) where role in ('opportunities_admin','community_admin','platform_admin');

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='super_admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_any_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles r where r.user_id=auth.uid());
$$;
revoke all on function public.is_any_admin() from public;
grant execute on function public.is_any_admin() to authenticated;

create or replace function public.has_admin_role(target_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role=target_role);
$$;
revoke all on function public.has_admin_role(text) from public;
grant execute on function public.has_admin_role(text) to authenticated;

create or replace function public.is_admin_account(target_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles r where r.user_id=target_user);
$$;
revoke all on function public.is_admin_account(uuid) from public;
grant execute on function public.is_admin_account(uuid) to authenticated;

create or replace function public.can_manage_opportunities()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_admin_role('opportunities_admin');
$$;
create or replace function public.can_manage_community()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_admin_role('community_admin');
$$;
create or replace function public.can_manage_campus()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_admin_role('platform_admin');
$$;
create or replace function public.can_manage_users()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_admin_role('community_admin') or public.has_admin_role('platform_admin');
$$;
revoke all on function public.can_manage_opportunities() from public;
revoke all on function public.can_manage_community() from public;
revoke all on function public.can_manage_campus() from public;
revoke all on function public.can_manage_users() from public;
grant execute on function public.can_manage_opportunities() to authenticated;
grant execute on function public.can_manage_community() to authenticated;
grant execute on function public.can_manage_campus() to authenticated;
grant execute on function public.can_manage_users() to authenticated;

create or replace function public.sync_bootstrap_admin_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if lower(coalesce(new.email,'')) in ('admin@futolife.com','admin@futolife.app') and new.email_confirmed_at is not null then
    insert into public.user_roles(user_id,role) values(new.id,'super_admin') on conflict do nothing;
  elsif lower(coalesce(new.email,'')) not in ('admin@futolife.com','admin@futolife.app') then
    delete from public.user_roles where user_id=new.id and role='super_admin';
  end if;
  return new;
end;
$$;
insert into public.user_roles(user_id,role)
select id,'super_admin' from auth.users
where lower(email) in ('admin@futolife.com','admin@futolife.app') and email_confirmed_at is not null
on conflict do nothing;

-- Keep the email-bound bootstrap account in a privileged role through the planned address change.
drop policy if exists "Admins can add campus locations" on public.campus_locations;
create policy "Platform admins can add campus locations" on public.campus_locations for insert to authenticated with check(public.can_manage_campus());
drop policy if exists "Admins can edit campus locations" on public.campus_locations;
create policy "Platform admins can edit campus locations" on public.campus_locations for update to authenticated using(public.can_manage_campus()) with check(public.can_manage_campus());
drop policy if exists "Admins can remove campus locations" on public.campus_locations;
create policy "Platform admins can remove campus locations" on public.campus_locations for delete to authenticated using(public.can_manage_campus());
drop policy if exists "Admins can upload campus photos" on storage.objects;
create policy "Platform admins can upload campus photos" on storage.objects for insert to authenticated with check(bucket_id='campus-media' and public.can_manage_campus());
drop policy if exists "Admins can update campus photos" on storage.objects;
create policy "Platform admins can update campus photos" on storage.objects for update to authenticated using(bucket_id='campus-media' and public.can_manage_campus()) with check(bucket_id='campus-media' and public.can_manage_campus());
drop policy if exists "Admins can delete campus photos" on storage.objects;
create policy "Platform admins can delete campus photos" on storage.objects for delete to authenticated using(bucket_id='campus-media' and public.can_manage_campus());

drop policy if exists "Users can see their own referral edges" on public.referrals;
create policy "Users and community admins can see referral edges" on public.referrals for select to authenticated
using((select auth.uid()) in(referrer_id,referred_id) or public.can_manage_community());

drop policy if exists "Admins can manage student profiles" on public.profiles;
create policy "Admins can edit manageable profiles" on public.profiles for update to authenticated
using(public.can_manage_users() and (public.is_admin() or not public.is_admin_account(id)))
with check(public.can_manage_users() and (public.is_admin() or not public.is_admin_account(id)));
drop policy if exists "Authenticated users can discover profiles" on public.profiles;
create policy "Authenticated users can discover profiles" on public.profiles for select to authenticated
using (not is_suspended or id=(select auth.uid()) or public.is_admin() or (public.can_manage_users() and not public.is_admin_account(id)));

create or replace function public.guard_profile_suspension()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.is_suspended is distinct from old.is_suspended or new.suspension_reason is distinct from old.suspension_reason or new.suspended_at is distinct from old.suspended_at or new.suspended_by is distinct from old.suspended_by or new.referral_code is distinct from old.referral_code)
    and (not public.can_manage_users() or (public.is_admin_account(old.id) and not public.is_admin())) then
    raise exception 'Administrator access to this user is not permitted';
  end if;
  return new;
end;
$$;

drop policy if exists "Users can read their friends posts" on public.posts;
create policy "Users can read their friends posts" on public.posts for select to authenticated using (
  public.can_manage_community() or (public.is_user_active() and (author_id=(select auth.uid()) or exists(select 1 from public.friendships f where f.status='accepted' and
    ((f.requester_id=(select auth.uid()) and f.addressee_id=author_id) or (f.addressee_id=(select auth.uid()) and f.requester_id=author_id)))))
);
drop policy if exists "Admins can update report status" on public.post_reports;
drop policy if exists "Users can read their own reports" on public.post_reports;
create policy "Users can read their own reports" on public.post_reports for select to authenticated
using(reporter_id=(select auth.uid()) or public.can_manage_community());
create policy "Community admins can update report status" on public.post_reports for update to authenticated using(public.can_manage_community()) with check(public.can_manage_community());
drop policy if exists "Admins can remove posts with five reports" on public.posts;
create policy "Community admins can remove posts" on public.posts for delete to authenticated using(
  author_id=(select auth.uid()) and public.is_user_active() or public.can_manage_community()
);

drop policy if exists "Only admins can view activity logs" on public.activity_logs;
create policy "Admins can view activity logs" on public.activity_logs for select to authenticated using(public.is_any_admin());
create or replace function public.record_user_activity(
  p_action text, p_entity_type text default null, p_entity_id text default null,
  p_contact_email text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); contact text := lower(trim(coalesce(p_contact_email,'')));
begin
  if p_action not in ('auth.login','auth.logout','auth.password_reset_requested','auth.login_failed','auth.signup_failed','profile.viewed','chat.opened','place.viewed','admin.activity_log.viewed') then raise exception 'Unsupported activity event'; end if;
  if p_action in ('auth.password_reset_requested','auth.login_failed','auth.signup_failed') then
    if contact !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'A valid email is required'; end if;
    if (select count(*) from public.activity_logs l where l.action=p_action and l.actor_email=contact and l.created_at>now()-interval '1 hour')>=10 then return; end if;
    perform public.insert_activity_log(caller,p_action,p_entity_type,p_entity_id,jsonb_build_object('source','password_recovery'),contact); return;
  end if;
  if caller is null then raise exception 'Sign in is required to record this activity'; end if;
  if p_action='admin.activity_log.viewed' and not public.is_any_admin() then raise exception 'Administrator access is required'; end if;
  if p_action='profile.viewed' and p_entity_type='profile' and p_entity_id=caller::text then return; end if;
  perform public.insert_activity_log(caller,p_action,p_entity_type,p_entity_id,'{}'::jsonb,null);
end;
$$;
revoke all on function public.record_user_activity(text,text,text,text) from public;
grant execute on function public.record_user_activity(text,text,text,text) to authenticated,anon;

