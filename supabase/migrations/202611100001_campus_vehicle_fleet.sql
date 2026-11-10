create table if not exists public.campus_vehicle_fleet (
  vehicle_id text primary key,
  vehicle_kind text not null check (vehicle_kind in ('bike','shuttle')),
  display_name text not null,
  capacity smallint not null check (capacity between 1 and 18),
  active boolean not null default true
);

insert into public.campus_vehicle_fleet(vehicle_id,vehicle_kind,display_name,capacity) values
  ('bike-01','bike','Campus bike 01',1),('bike-02','bike','Campus bike 02',1),
  ('bike-03','bike','Campus bike 03',1),('bike-04','bike','Campus bike 04',1),
  ('bike-05','bike','Campus bike 05',1),('bike-06','bike','Campus bike 06',1),
  ('shuttle-01','shuttle','FUTO Life Shuttle 01',18),
  ('shuttle-02','shuttle','FUTO Life Shuttle 02',18)
on conflict(vehicle_id) do update set
  vehicle_kind=excluded.vehicle_kind,display_name=excluded.display_name,capacity=excluded.capacity,active=true;

create table if not exists public.campus_vehicle_sessions (
  vehicle_id text not null references public.campus_vehicle_fleet(vehicle_id),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  seat_no smallint not null,
  request_id uuid not null,
  boarded_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  primary key(vehicle_id,seat_no),
  unique(profile_id),
  unique(profile_id,request_id)
);

create index if not exists campus_vehicle_sessions_active_idx
  on public.campus_vehicle_sessions(vehicle_id,heartbeat_at);

alter table public.campus_vehicle_fleet enable row level security;
alter table public.campus_vehicle_sessions enable row level security;
revoke all on public.campus_vehicle_fleet,public.campus_vehicle_sessions from anon,authenticated;

create or replace function public.reserve_campus_vehicle(p_vehicle_id text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  caller uuid := auth.uid();
  vehicle public.campus_vehicle_fleet%rowtype;
  current_session public.campus_vehicle_sessions%rowtype;
  requested_seat smallint;
  fare_item text;
begin
  if caller is null or not public.is_user_active() then raise exception 'Sign in with an active account to board a campus vehicle.'; end if;
  if p_request_id is null then raise exception 'A ride request ID is required.'; end if;
  select * into vehicle from public.campus_vehicle_fleet where vehicle_id=p_vehicle_id and active for update;
  if not found then raise exception 'This campus vehicle is not available.'; end if;

  delete from public.campus_vehicle_sessions where vehicle_id=p_vehicle_id and heartbeat_at<now()-interval '60 seconds';
  delete from public.campus_vehicle_sessions where profile_id=caller and heartbeat_at<now()-interval '60 seconds';
  select * into current_session from public.campus_vehicle_sessions where profile_id=caller;
  if found then
    if current_session.vehicle_id=p_vehicle_id then
      update public.campus_vehicle_sessions set heartbeat_at=now() where profile_id=caller;
      return jsonb_build_object('vehicle_id',vehicle.vehicle_id,'kind',vehicle.vehicle_kind,'seat_no',current_session.seat_no,'capacity',vehicle.capacity,'existing',true);
    end if;
    raise exception 'Leave your current vehicle before boarding another one.';
  end if;
  select candidate::smallint into requested_seat
  from generate_series(1,vehicle.capacity) candidate
  where not exists(select 1 from public.campus_vehicle_sessions s where s.vehicle_id=p_vehicle_id and s.seat_no=candidate)
  order by candidate limit 1;
  if requested_seat is null then raise exception 'This vehicle is full. Try another shuttle or bike.'; end if;

  fare_item := case vehicle.vehicle_kind when 'bike' then 'bike-ride' else 'shuttle-ride' end;
  perform public.consume_game_ride_ticket(fare_item,p_request_id);
  insert into public.campus_vehicle_sessions(vehicle_id,profile_id,seat_no,request_id)
    values(p_vehicle_id,caller,requested_seat,p_request_id);
  return jsonb_build_object('vehicle_id',vehicle.vehicle_id,'kind',vehicle.vehicle_kind,'seat_no',requested_seat,'capacity',vehicle.capacity,'existing',false);
end $$;

create or replace function public.heartbeat_campus_vehicle(p_vehicle_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare touched integer;
begin
  if auth.uid() is null or not public.is_user_active() then return false; end if;
  update public.campus_vehicle_sessions set heartbeat_at=now()
    where profile_id=auth.uid() and vehicle_id=p_vehicle_id returning 1 into touched;
  return coalesce(touched,0)=1;
end $$;

create or replace function public.leave_campus_vehicle(p_vehicle_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare removed integer;
begin
  if auth.uid() is null then return false; end if;
  delete from public.campus_vehicle_sessions where profile_id=auth.uid() and vehicle_id=p_vehicle_id returning 1 into removed;
  return coalesce(removed,0)=1;
end $$;

create or replace function public.get_campus_vehicle_fleet()
returns table(vehicle_id text,vehicle_kind text,display_name text,capacity integer,occupied integer,server_epoch_ms bigint)
language sql stable security definer set search_path=public as $$
  select v.vehicle_id,v.vehicle_kind,v.display_name,v.capacity::integer,
    (select count(*)::integer from public.campus_vehicle_sessions s where s.vehicle_id=v.vehicle_id and s.heartbeat_at>=now()-interval '60 seconds'),
    floor(extract(epoch from now())*1000)::bigint
  from public.campus_vehicle_fleet v where v.active order by v.vehicle_kind,v.vehicle_id
$$;

update public.game_store_items set active=true where id='shuttle-ride';

revoke all on function public.reserve_campus_vehicle(text,uuid) from public,anon;
revoke all on function public.heartbeat_campus_vehicle(text) from public,anon;
revoke all on function public.leave_campus_vehicle(text) from public,anon;
revoke all on function public.get_campus_vehicle_fleet() from public,anon;
grant execute on function public.reserve_campus_vehicle(text,uuid) to authenticated;
grant execute on function public.heartbeat_campus_vehicle(text) to authenticated;
grant execute on function public.leave_campus_vehicle(text) to authenticated;
grant execute on function public.get_campus_vehicle_fleet() to anon,authenticated;
