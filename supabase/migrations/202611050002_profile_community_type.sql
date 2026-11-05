alter table public.profiles
  add column if not exists member_type text not null default 'student'
    check (member_type in ('student','alumni','visitor')),
  add column if not exists alumni_set text
    check (alumni_set is null or alumni_set ~ '^[0-9]{2}/[0-9]{2}$');

-- Remove the legacy non-immutable bound if the profile-details migration was
-- already applied before the date constraint was corrected.
alter table public.profile_details drop constraint if exists profile_details_date_of_birth_check;
alter table public.profile_details add constraint profile_details_date_of_birth_check
  check (date_of_birth is null or date_of_birth >= date '1900-01-01');

drop function if exists public.save_my_profile_details(text,text,smallint,text,text,date,text,text,text,text);
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
  p_social_link text,
  p_member_type text,
  p_alumni_set text
)
returns void language plpgsql security definer set search_path = '' as $$
declare current_profile_id uuid := auth.uid(); normalized_set text := nullif(trim(p_alumni_set),'');
begin
  if current_profile_id is null then raise exception 'Sign in to update your profile.'; end if;
  if char_length(trim(p_display_name)) not between 2 and 48 then raise exception 'Display name must be between 2 and 48 characters.'; end if;
  if p_member_type is null or p_member_type not in ('student','alumni','visitor') then raise exception 'Choose student, alumni, or visitor.'; end if;
  if p_member_type='alumni' and (normalized_set is null or normalized_set !~ '^[0-9]{2}/[0-9]{2}$') then raise exception 'Enter your alumni set as YY/YY, for example 23/24.'; end if;
  if p_member_type<>'alumni' then normalized_set:=null; end if;
  if p_gender is not null and p_gender not in ('Male','Female') then raise exception 'Choose Male or Female.'; end if;
  if p_dob_visibility not in ('private','friends','public') then raise exception 'Choose a valid date of birth privacy setting.'; end if;
  if p_date_of_birth is not null and (p_date_of_birth > current_date or p_date_of_birth < date '1900-01-01') then raise exception 'Enter a valid date of birth.'; end if;
  if p_department is not null and char_length(p_department) > 80 then raise exception 'Department is too long.'; end if;
  if p_year_of_study is not null and p_year_of_study not between 1 and 7 then raise exception 'Choose a valid year of study.'; end if;
  if p_hometown is not null and char_length(p_hometown) > 100 then raise exception 'Hometown is too long.'; end if;
  if p_interests is not null and char_length(p_interests) > 280 then raise exception 'Interests are too long.'; end if;
  if p_social_link is not null and (char_length(p_social_link) > 200 or p_social_link !~ '^https://[^[:space:]]+$') then raise exception 'Social link must begin with https://.'; end if;

  update public.profiles
  set display_name=trim(p_display_name), department=nullif(trim(p_department),''),
      year_of_study=case when p_member_type='student' then p_year_of_study else null end,
      member_type=p_member_type, alumni_set=normalized_set,
      bio=nullif(trim(p_bio),'')
  where id=current_profile_id;
  if not found then raise exception 'Profile not found.'; end if;

  insert into public.profile_details(profile_id,gender,date_of_birth,dob_visibility,hometown,interests,social_link)
  values(current_profile_id,p_gender,p_date_of_birth,p_dob_visibility,nullif(trim(p_hometown),''),nullif(trim(p_interests),''),nullif(trim(p_social_link),''))
  on conflict(profile_id) do update set gender=excluded.gender,date_of_birth=excluded.date_of_birth,
    dob_visibility=excluded.dob_visibility,hometown=excluded.hometown,interests=excluded.interests,
    social_link=excluded.social_link,updated_at=now();
end;
$$;

revoke all on function public.save_my_profile_details(text,text,smallint,text,text,date,text,text,text,text,text,text) from public;
grant execute on function public.save_my_profile_details(text,text,smallint,text,text,date,text,text,text,text,text,text) to authenticated;
