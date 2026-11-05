-- Keep already-deployed clients working while the newer profile editor rolls out.
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
returns void language sql security definer set search_path = '' as $$
  select public.save_my_profile_details(
    p_display_name,
    p_department,
    p_year_of_study,
    p_bio,
    p_gender,
    p_date_of_birth,
    p_dob_visibility,
    p_hometown,
    p_interests,
    p_social_link,
    'student',
    null
  );
$$;

revoke all on function public.save_my_profile_details(text,text,smallint,text,text,date,text,text,text,text) from public;
grant execute on function public.save_my_profile_details(text,text,smallint,text,text,date,text,text,text,text) to authenticated;

notify pgrst, 'reload schema';
