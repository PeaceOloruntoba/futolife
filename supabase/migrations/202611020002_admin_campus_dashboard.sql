-- Admin access is assigned only to the confirmed, exact bootstrap email.
-- No password is stored in the repository or database by this migration.
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
drop policy if exists "Users can read their own roles" on public.user_roles;
create policy "Users can read their own roles" on public.user_roles
for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.sync_bootstrap_admin_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if lower(coalesce(new.email,''))='admin@futolife.com' and new.email_confirmed_at is not null then
    insert into public.user_roles(user_id,role) values(new.id,'admin') on conflict do nothing;
  else
    delete from public.user_roles where user_id=new.id and role='admin';
  end if;
  return new;
end;
$$;
drop trigger if exists sync_bootstrap_admin_role on auth.users;
create trigger sync_bootstrap_admin_role after insert or update on auth.users
for each row execute function public.sync_bootstrap_admin_role();
-- Also grant admin to the account if it already exists and has verified its email.
insert into public.user_roles(user_id,role)
select id,'admin' from auth.users where lower(email)='admin@futolife.com' and email_confirmed_at is not null
on conflict do nothing;

drop policy if exists "Admins can add campus locations" on public.campus_locations;
create policy "Admins can add campus locations" on public.campus_locations
for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins can edit campus locations" on public.campus_locations;
create policy "Admins can edit campus locations" on public.campus_locations
for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins can remove campus locations" on public.campus_locations;
create policy "Admins can remove campus locations" on public.campus_locations
for delete to authenticated using (public.is_admin());

alter table public.campus_locations add column if not exists image_url text;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='campus_locations_local_coordinates_pair' and conrelid='public.campus_locations'::regclass) then
    alter table public.campus_locations add constraint campus_locations_local_coordinates_pair
      check ((local_x is null and local_z is null) or (local_x is not null and local_z is not null));
  end if;
  if not exists(select 1 from pg_constraint where conname='campus_locations_verified_has_evidence' and conrelid='public.campus_locations'::regclass) then
    alter table public.campus_locations add constraint campus_locations_verified_has_evidence
      check (position_status <> 'verified' or (jsonb_typeof(evidence)='array' and jsonb_array_length(evidence)>0));
  end if;
  if not exists(select 1 from pg_constraint where conname='campus_locations_verified_has_position' and conrelid='public.campus_locations'::regclass) then
    alter table public.campus_locations add constraint campus_locations_verified_has_position
      check (position_status <> 'verified' or ((latitude is not null and longitude is not null) or (local_x is not null and local_z is not null)));
  end if;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('campus-media','campus-media',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "Campus photos are public" on storage.objects;
create policy "Campus photos are public" on storage.objects for select to public using(bucket_id='campus-media');
drop policy if exists "Admins can upload campus photos" on storage.objects;
create policy "Admins can upload campus photos" on storage.objects for insert to authenticated with check(bucket_id='campus-media' and public.is_admin());
drop policy if exists "Admins can update campus photos" on storage.objects;
create policy "Admins can update campus photos" on storage.objects for update to authenticated using(bucket_id='campus-media' and public.is_admin()) with check(bucket_id='campus-media' and public.is_admin());
drop policy if exists "Admins can delete campus photos" on storage.objects;
create policy "Admins can delete campus photos" on storage.objects for delete to authenticated using(bucket_id='campus-media' and public.is_admin());
