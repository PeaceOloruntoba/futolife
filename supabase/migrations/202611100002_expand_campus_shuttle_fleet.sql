-- Expand the campus fleet and give every client one shared shuttle schedule.
-- The first two timetable phases depart the Main Gate; the next three start
-- halfway through separate campus route legs.

insert into public.campus_vehicle_fleet(vehicle_id,vehicle_kind,display_name,capacity)
values
  ('shuttle-03','shuttle','FUTO Life Shuttle 03',18),
  ('shuttle-04','shuttle','FUTO Life Shuttle 04',18),
  ('shuttle-05','shuttle','FUTO Life Shuttle 05',18)
on conflict(vehicle_id) do update set
  vehicle_kind=excluded.vehicle_kind,
  display_name=excluded.display_name,
  capacity=excluded.capacity,
  active=true;

create table if not exists public.campus_vehicle_schedule_state (
  singleton boolean primary key default true check(singleton),
  schedule_epoch timestamptz not null default now()
);

insert into public.campus_vehicle_schedule_state(singleton,schedule_epoch)
values(true,now())
on conflict(singleton) do nothing;

alter table public.campus_vehicle_schedule_state enable row level security;
revoke all on public.campus_vehicle_schedule_state from anon,authenticated;

drop function if exists public.get_campus_vehicle_fleet();
create function public.get_campus_vehicle_fleet()
returns table(
  vehicle_id text,
  vehicle_kind text,
  display_name text,
  capacity integer,
  occupied integer,
  server_epoch_ms bigint,
  schedule_epoch_ms bigint
)
language sql stable security definer set search_path=public as $$
  select v.vehicle_id,v.vehicle_kind,v.display_name,v.capacity::integer,
    (select count(*)::integer from public.campus_vehicle_sessions s
      where s.vehicle_id=v.vehicle_id and s.heartbeat_at>=now()-interval '60 seconds'),
    floor(extract(epoch from now())*1000)::bigint,
    floor(extract(epoch from timetable.schedule_epoch)*1000)::bigint
  from public.campus_vehicle_fleet v
  cross join public.campus_vehicle_schedule_state timetable
  where v.active and timetable.singleton
  order by v.vehicle_kind,v.vehicle_id
$$;

revoke all on function public.get_campus_vehicle_fleet() from public,anon;
grant execute on function public.get_campus_vehicle_fleet() to anon,authenticated;
