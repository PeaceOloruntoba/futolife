-- Let open campus experiences receive place edits and new photos immediately.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='campus_locations') then
    alter publication supabase_realtime add table public.campus_locations;
  end if;
end $$;
