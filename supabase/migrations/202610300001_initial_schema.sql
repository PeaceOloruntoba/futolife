create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 48),
  department text check (department is null or char_length(department) <= 80),
  year_of_study smallint check (year_of_study is null or year_of_study between 1 and 7),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
drop policy if exists "Profiles are viewable by their owner" on public.profiles;
create policy "Profiles are viewable by their owner" on public.profiles
for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Owners can insert their profile" on public.profiles;
create policy "Owners can insert their profile" on public.profiles
for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "Owners can update their profile" on public.profiles;
create policy "Owners can update their profile" on public.profiles
for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create table if not exists public.campus_locations (
  id text primary key,
  name text not null,
  category text not null,
  description text,
  latitude double precision,
  longitude double precision,
  local_x double precision,
  local_z double precision,
  position_status text not null default 'unverified' check (position_status in ('verified','provisional','unverified')),
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);

alter table public.campus_locations enable row level security;
drop policy if exists "Campus locations are visible to everyone" on public.campus_locations;
create policy "Campus locations are visible to everyone" on public.campus_locations
for select to anon, authenticated using (true);

insert into public.campus_locations (id, name, category, local_x, local_z, position_status, evidence)
values
  ('main-gate','FUTO Main Gate','entrance',0,0,'provisional','[{"type":"owner_photo","note":"Appearance guided by a supplied front photograph; dimensions and geographic coordinates are not verified."}]'::jsonb),
  ('senate-building','Senate Building','landmark',-62,-300,'provisional','[{"type":"owner_photo","note":"Appearance guided by a supplied photograph; local position is an estimate, not a geographic coordinate."}]'::jsonb)
on conflict (id) do nothing;
