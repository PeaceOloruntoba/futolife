create table if not exists public.profile_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  gender text check (gender is null or gender in ('Male','Female')),
  date_of_birth date check (date_of_birth is null or date_of_birth >= date '1900-01-01'),
  dob_visibility text not null default 'private' check (dob_visibility in ('private','friends','public')),
  hometown text check (hometown is null or char_length(hometown) <= 100),
  interests text check (interests is null or char_length(interests) <= 280),
  social_link text check (social_link is null or (char_length(social_link) <= 200 and social_link ~ '^https://[^[:space:]]+$')),
  updated_at timestamptz not null default now()
);

alter table public.profile_details enable row level security;
drop policy if exists "Users can read own profile details" on public.profile_details;
create policy "Users can read own profile details" on public.profile_details for select to authenticated using (profile_id = (select auth.uid()));
drop policy if exists "Users can insert own profile details" on public.profile_details;
create policy "Users can insert own profile details" on public.profile_details for insert to authenticated with check (profile_id = (select auth.uid()));
drop policy if exists "Users can update own profile details" on public.profile_details;
create policy "Users can update own profile details" on public.profile_details for update to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

create or replace function public.get_profile_details(target_profile_id uuid)
returns table (gender text, date_of_birth date, dob_visibility text, hometown text, interests text, social_link text)
language sql stable security definer set search_path = '' as $$
  select
    d.gender,
    case
      when auth.uid() = d.profile_id then d.date_of_birth
      when d.dob_visibility = 'public' then d.date_of_birth
      when d.dob_visibility = 'friends' and exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and ((f.requester_id = auth.uid() and f.addressee_id = d.profile_id)
            or (f.addressee_id = auth.uid() and f.requester_id = d.profile_id))
      ) then d.date_of_birth
      else null
    end,
    case when auth.uid() = d.profile_id then d.dob_visibility else null end,
    d.hometown,
    d.interests,
    d.social_link
  from public.profile_details d
  where d.profile_id = target_profile_id
    and auth.uid() is not null
    and exists (select 1 from public.profiles p where p.id = target_profile_id);
$$;

create or replace function public.save_my_profile_details(
  p_display_name text,
  p_department text,
  p_year_of_study smallint,
  p_bio text,
  p_gender text,
  p_date_of_birth date,
  p_dob_visibility text,
  p_hometown text,
  p_interests text,
  p_social_link text
)
returns void language plpgsql security definer set search_path = '' as $$
declare current_profile_id uuid := auth.uid();
begin
  if current_profile_id is null then raise exception 'Sign in to update your profile.'; end if;
  if char_length(trim(p_display_name)) not between 2 and 48 then raise exception 'Display name must be between 2 and 48 characters.'; end if;
  if p_gender is not null and p_gender not in ('Male','Female') then raise exception 'Choose Male or Female.'; end if;
  if p_dob_visibility not in ('private','friends','public') then raise exception 'Choose a valid date of birth privacy setting.'; end if;
  if p_date_of_birth is not null and (p_date_of_birth > current_date or p_date_of_birth < date '1900-01-01') then raise exception 'Enter a valid date of birth.'; end if;
  if p_department is not null and char_length(p_department) > 80 then raise exception 'Department is too long.'; end if;
  if p_year_of_study is not null and p_year_of_study not between 1 and 7 then raise exception 'Choose a valid year of study.'; end if;
  if p_hometown is not null and char_length(p_hometown) > 100 then raise exception 'Hometown is too long.'; end if;
  if p_interests is not null and char_length(p_interests) > 280 then raise exception 'Interests are too long.'; end if;
  if p_social_link is not null and (char_length(p_social_link) > 200 or p_social_link !~ '^https://[^[:space:]]+$') then raise exception 'Social link must begin with https://.'; end if;

  update public.profiles
  set display_name = trim(p_display_name), department = nullif(trim(p_department), ''),
      year_of_study = p_year_of_study, bio = nullif(trim(p_bio), '')
  where id = current_profile_id;
  if not found then raise exception 'Profile not found.'; end if;

  insert into public.profile_details(profile_id,gender,date_of_birth,dob_visibility,hometown,interests,social_link)
  values (current_profile_id,p_gender,p_date_of_birth,p_dob_visibility,nullif(trim(p_hometown),''),nullif(trim(p_interests),''),nullif(trim(p_social_link),''))
  on conflict (profile_id) do update set gender=excluded.gender,date_of_birth=excluded.date_of_birth,
    dob_visibility=excluded.dob_visibility,hometown=excluded.hometown,interests=excluded.interests,
    social_link=excluded.social_link,updated_at=now();
end;
$$;

revoke all on function public.get_profile_details(uuid) from public;
revoke all on function public.save_my_profile_details(text,text,smallint,text,text,date,text,text,text,text) from public;
grant execute on function public.get_profile_details(uuid) to authenticated;
grant execute on function public.save_my_profile_details(text,text,smallint,text,text,date,text,text,text,text) to authenticated;

drop trigger if exists audit_profile_details on public.profile_details;
create trigger audit_profile_details after insert or update or delete on public.profile_details
for each row execute function public.audit_app_row_change();
