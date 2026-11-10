-- Game currency is a closed-loop, non-cash points system. Clients can read
-- their own state but all balance changes happen through protected functions.
create table if not exists public.game_challenges (
  id text primary key,
  title text not null,
  description text not null,
  category text not null,
  challenge_type text not null check (challenge_type in ('daily_login','trivia','discovery','route','social')),
  repeat_period text not null default 'once' check (repeat_period in ('once','daily','weekly')),
  coin_reward integer not null default 0 check (coin_reward between 0 and 1000),
  xp_reward integer not null default 0 check (xp_reward between 0 and 5000),
  prompt text,
  choices jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_challenge_answers (
  challenge_id text primary key references public.game_challenges(id) on delete cascade,
  accepted_answers text[] not null
);

create table if not exists public.game_challenge_claims (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  challenge_id text not null references public.game_challenges(id),
  cycle_key text not null,
  request_id uuid not null,
  coins_awarded integer not null,
  xp_awarded integer not null,
  claimed_at timestamptz not null default now(),
  unique(profile_id, challenge_id, cycle_key),
  unique(profile_id, request_id)
);

create table if not exists public.game_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  coins_delta integer not null check (coins_delta between -100000 and 1000),
  xp_delta integer not null default 0 check (xp_delta between 0 and 5000),
  entry_type text not null check (entry_type in ('challenge_reward','store_purchase','ride_ticket_use','admin_adjustment')),
  source_id text not null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(profile_id, idempotency_key)
);

create table if not exists public.game_progress (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  daily_streak integer not null default 0 check (daily_streak between 0 and 10000),
  best_daily_streak integer not null default 0 check (best_daily_streak between 0 and 10000),
  last_daily_claim date,
  updated_at timestamptz not null default now()
);

create table if not exists public.game_store_items (
  id text primary key,
  name text not null,
  description text not null,
  category text not null check (category in ('cosmetic','bike_fare','shuttle_fare','taxi_fare','vehicle')),
  price_coins integer not null check (price_coins between 1 and 100000),
  purchase_type text not null check (purchase_type in ('consumable','permanent')),
  quantity_per_purchase integer not null default 1 check (quantity_per_purchase between 1 and 100),
  active boolean not null default true
);

create table if not exists public.game_inventory (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.game_store_items(id),
  quantity integer not null default 0 check (quantity between 0 and 100000),
  acquired_at timestamptz not null default now(),
  primary key(profile_id, item_id)
);

create table if not exists public.game_purchases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.game_store_items(id),
  request_id uuid not null,
  price_coins integer not null,
  quantity integer not null,
  purchased_at timestamptz not null default now(),
  unique(profile_id, request_id)
);

create table if not exists public.game_ride_uses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.game_store_items(id),
  request_id uuid not null,
  used_at timestamptz not null default now(),
  unique(profile_id, request_id)
);

alter table public.game_challenges enable row level security;
alter table public.game_challenge_answers enable row level security;
alter table public.game_challenge_claims enable row level security;
alter table public.game_wallet_ledger enable row level security;
alter table public.game_progress enable row level security;
alter table public.game_store_items enable row level security;
alter table public.game_inventory enable row level security;
alter table public.game_purchases enable row level security;
alter table public.game_ride_uses enable row level security;

drop policy if exists "Active game challenges are readable" on public.game_challenges;
create policy "Active game challenges are readable" on public.game_challenges for select to anon, authenticated using (active);
drop policy if exists "Users can read their game claims" on public.game_challenge_claims;
create policy "Users can read their game claims" on public.game_challenge_claims for select to authenticated using (profile_id=(select auth.uid()));
drop policy if exists "Users can read their wallet ledger" on public.game_wallet_ledger;
create policy "Users can read their wallet ledger" on public.game_wallet_ledger for select to authenticated using (profile_id=(select auth.uid()));
drop policy if exists "Users can read their game progress" on public.game_progress;
create policy "Users can read their game progress" on public.game_progress for select to authenticated using (profile_id=(select auth.uid()));
drop policy if exists "Active store items are readable" on public.game_store_items;
create policy "Active store items are readable" on public.game_store_items for select to anon, authenticated using (active);
drop policy if exists "Users can read their inventory" on public.game_inventory;
create policy "Users can read their inventory" on public.game_inventory for select to authenticated using (profile_id=(select auth.uid()));
drop policy if exists "Users can read their purchases" on public.game_purchases;
create policy "Users can read their purchases" on public.game_purchases for select to authenticated using (profile_id=(select auth.uid()));
drop policy if exists "Users can read their ride ticket use" on public.game_ride_uses;
create policy "Users can read their ride ticket use" on public.game_ride_uses for select to authenticated using (profile_id=(select auth.uid()));

revoke all on public.game_challenge_answers, public.game_challenge_claims, public.game_wallet_ledger,
  public.game_progress, public.game_inventory, public.game_purchases, public.game_ride_uses from anon, authenticated;
grant select on public.game_challenges, public.game_store_items to anon, authenticated;
grant select on public.game_challenge_claims, public.game_wallet_ledger, public.game_progress,
  public.game_inventory, public.game_purchases, public.game_ride_uses to authenticated;

insert into public.game_challenges(id,title,description,category,challenge_type,repeat_period,coin_reward,xp_reward,prompt,choices)
values
  ('daily-arrival','Daily login','Claim your once-per-day FUTO Life reward. Build a streak by returning on different days.','daily','daily_login','daily',10,25,null,'[]'::jsonb),
  ('futo-acronym','FUTO acronym','Answer a quick campus warm-up question.','trivia','trivia','once',20,50,'What does FUTO stand for?','["Federal University of Technology Owerri","Federal Union of Technology Owerri","Federal University Training Organisation"]'::jsonb),
  ('map-basics','Map explorer','Learn the coordinate order used by GeoJSON.','trivia','trivia','once',15,35,'In GeoJSON, which coordinate comes first?','["Longitude, then latitude","Latitude, then longitude","Altitude, then longitude"]'::jsonb),
  ('explore-senate','Find the Senate','Follow a reviewed route to the Senate Building.','discovery','discovery','once',40,100,null,'[]'::jsonb),
  ('explore-library','Find the Main Library','Discover a study destination on a reviewed campus map.','discovery','discovery','once',35,90,null,'[]'::jsonb)
on conflict (id) do nothing;

insert into public.game_challenge_answers(challenge_id,accepted_answers) values
  ('futo-acronym',array['federal university of technology owerri','federal university of technology, owerri']),
  ('map-basics',array['longitude, then latitude','longitude then latitude','longitude latitude'])
on conflict (challenge_id) do nothing;

insert into public.game_store_items(id,name,description,category,price_coins,purchase_type,quantity_per_purchase,active)
values
  ('bike-ride','Bike ride ticket','One in-game bike rental.','bike_fare',12,'consumable',1,true),
  ('shuttle-ride','Shuttle ticket','One in-game shuttle trip.','shuttle_fare',8,'consumable',1,false),
  ('taxi-ride','Campus taxi ticket','One in-game taxi trip.','taxi_fare',20,'consumable',1,false),
  ('campus-backpack','Campus backpack','A cosmetic backpack for your avatar.','cosmetic',120,'permanent',1,true),
  ('compact-car','Compact car','A cosmetic role-play vehicle for a later driving release.','vehicle',2500,'permanent',1,false)
on conflict (id) do nothing;

create or replace function public.get_game_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := auth.uid(); result jsonb;
begin
  if caller is null then raise exception 'Sign in to view your game profile.'; end if;
  select jsonb_build_object(
    'coins',coalesce((select sum(l.coins_delta) from public.game_wallet_ledger l where l.profile_id=caller),0),
    'xp',coalesce((select sum(l.xp_delta) from public.game_wallet_ledger l where l.profile_id=caller),0),
    'daily_streak',coalesce(p.daily_streak,0),'best_daily_streak',coalesce(p.best_daily_streak,0),'last_daily_claim',p.last_daily_claim,
    'challenges',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'description',c.description,'category',c.category,'type',c.challenge_type,'repeat_period',c.repeat_period,'coins',c.coin_reward,'xp',c.xp_reward,'prompt',c.prompt,'choices',c.choices,'claimable',c.challenge_type in ('daily_login','trivia') and not exists(select 1 from public.game_challenge_claims cc where cc.profile_id=caller and cc.challenge_id=c.id and cc.cycle_key=case when c.challenge_type='daily_login' then (now() at time zone 'Africa/Lagos')::date::text else 'once' end),'claimed',exists(select 1 from public.game_challenge_claims cc where cc.profile_id=caller and cc.challenge_id=c.id and cc.cycle_key=case when c.challenge_type='daily_login' then (now() at time zone 'Africa/Lagos')::date::text else 'once' end)) order by c.category,c.id) from public.game_challenges c where c.active), '[]'::jsonb),
    'inventory',coalesce((select jsonb_agg(jsonb_build_object('id',i.item_id,'name',s.name,'category',s.category,'quantity',i.quantity,'purchase_type',s.purchase_type) order by s.category,s.name) from public.game_inventory i join public.game_store_items s on s.id=i.item_id where i.profile_id=caller and i.quantity>0), '[]'::jsonb),
    'store',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'category',s.category,'price',s.price_coins,'purchase_type',s.purchase_type) order by s.category,s.price_coins) from public.game_store_items s where s.active), '[]'::jsonb)
  ) into result
  from (select 1) seed left join public.game_progress p on p.profile_id=caller;
  return result;
end;
$$;

create or replace function public.claim_game_challenge(p_challenge_id text, p_request_id uuid, p_answer text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid(); user_confirmed timestamptz; challenge public.game_challenges%rowtype;
  today date := (now() at time zone 'Africa/Lagos')::date; cycle text; streak integer; awarded_coins integer; awarded_xp integer;
begin
  if caller is null then raise exception 'Sign in to claim game rewards.'; end if;
  if p_request_id is null then raise exception 'A request id is required.'; end if;
  select u.email_confirmed_at into user_confirmed from auth.users u where u.id=caller;
  if user_confirmed is null then raise exception 'Confirm your email before earning game rewards.'; end if;
  if not public.is_user_active() then raise exception 'This account cannot earn game rewards.'; end if;
  select * into challenge from public.game_challenges where id=p_challenge_id and active for share;
  if not found then raise exception 'This challenge is unavailable.'; end if;
  if challenge.challenge_type not in ('daily_login','trivia') then raise exception 'This activity is waiting for the verified campus arrival system.'; end if;
  if challenge.challenge_type='trivia' then
    if p_answer is null or not exists(select 1 from public.game_challenge_answers a where a.challenge_id=challenge.id and lower(btrim(p_answer))=any(a.accepted_answers)) then
      raise exception 'That answer is not correct yet.';
    end if;
    cycle := 'once';
  else
    cycle := today::text;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text,0));
  if exists(select 1 from public.game_challenge_claims c where c.profile_id=caller and c.request_id=p_request_id) then
    return jsonb_build_object('ok',true,'already_claimed',true,'state',public.get_game_state());
  end if;
  if exists(select 1 from public.game_challenge_claims c where c.profile_id=caller and c.challenge_id=challenge.id and c.cycle_key=cycle) then
    return jsonb_build_object('ok',true,'already_claimed',true,'state',public.get_game_state());
  end if;
  if challenge.challenge_type='daily_login' then
    insert into public.game_progress(profile_id) values(caller) on conflict(profile_id) do nothing;
    select case when last_daily_claim=today-1 then daily_streak+1 else 1 end into streak from public.game_progress where profile_id=caller for update;
    update public.game_progress set daily_streak=streak,best_daily_streak=greatest(best_daily_streak,streak),last_daily_claim=today,updated_at=now() where profile_id=caller;
    awarded_coins := challenge.coin_reward + case when streak>0 and streak%7=0 then 40 else 0 end;
    awarded_xp := challenge.xp_reward + case when streak>0 and streak%7=0 then 50 else 0 end;
  else
    awarded_coins := challenge.coin_reward;
    awarded_xp := challenge.xp_reward;
  end if;
  insert into public.game_challenge_claims(profile_id,challenge_id,cycle_key,request_id,coins_awarded,xp_awarded)
    values(caller,challenge.id,cycle,p_request_id,awarded_coins,awarded_xp);
  insert into public.game_wallet_ledger(profile_id,coins_delta,xp_delta,entry_type,source_id,idempotency_key,metadata)
    values(caller,awarded_coins,awarded_xp,'challenge_reward',challenge.id||':'||cycle,'claim:'||p_request_id::text,jsonb_build_object('challenge_id',challenge.id,'streak',case when challenge.challenge_type='daily_login' then streak else null end));
  return jsonb_build_object('ok',true,'already_claimed',false,'coins_awarded',awarded_coins,'xp_awarded',awarded_xp,'state',public.get_game_state());
end;
$$;

create or replace function public.purchase_game_item(p_item_id text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); item public.game_store_items%rowtype; confirmed timestamptz; current_balance bigint; new_quantity integer;
begin
  if caller is null then raise exception 'Sign in to use the game store.'; end if;
  if p_request_id is null then raise exception 'A request id is required.'; end if;
  select u.email_confirmed_at into confirmed from auth.users u where u.id=caller;
  if confirmed is null or not public.is_user_active() then raise exception 'This account cannot make game purchases.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text,0));
  if exists(select 1 from public.game_purchases p where p.profile_id=caller and p.request_id=p_request_id) then
    return jsonb_build_object('ok',true,'already_purchased',true,'state',public.get_game_state());
  end if;
  select * into item from public.game_store_items where id=p_item_id and active for share;
  if not found then raise exception 'This item is unavailable.'; end if;
  if item.purchase_type='permanent' and exists(select 1 from public.game_inventory i where i.profile_id=caller and i.item_id=item.id and i.quantity>0) then
    raise exception 'You already own this item.';
  end if;
  select coalesce(sum(coins_delta),0) into current_balance from public.game_wallet_ledger where profile_id=caller;
  if current_balance<item.price_coins then raise exception 'You need more game coins for this item.'; end if;
  new_quantity := item.quantity_per_purchase;
  insert into public.game_purchases(profile_id,item_id,request_id,price_coins,quantity) values(caller,item.id,p_request_id,item.price_coins,new_quantity);
  insert into public.game_wallet_ledger(profile_id,coins_delta,xp_delta,entry_type,source_id,idempotency_key,metadata)
    values(caller,-item.price_coins,0,'store_purchase',item.id,'purchase:'||p_request_id::text,jsonb_build_object('item_id',item.id,'quantity',new_quantity));
  insert into public.game_inventory(profile_id,item_id,quantity) values(caller,item.id,new_quantity)
    on conflict(profile_id,item_id) do update set quantity=public.game_inventory.quantity+excluded.quantity,acquired_at=now();
  return jsonb_build_object('ok',true,'item_id',item.id,'quantity',new_quantity,'state',public.get_game_state());
end;
$$;

create or replace function public.consume_game_ride_ticket(p_item_id text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); item public.game_store_items%rowtype; confirmed timestamptz; remaining integer;
begin
  if caller is null then raise exception 'Sign in to use a ride ticket.'; end if;
  if p_request_id is null then raise exception 'A request id is required.'; end if;
  select u.email_confirmed_at into confirmed from auth.users u where u.id=caller;
  if confirmed is null or not public.is_user_active() then raise exception 'This account cannot use game ride tickets.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text,0));
  if exists(select 1 from public.game_ride_uses r where r.profile_id=caller and r.request_id=p_request_id) then
    return jsonb_build_object('ok',true,'already_used',true,'state',public.get_game_state());
  end if;
  select * into item from public.game_store_items where id=p_item_id and active for share;
  if not found or item.category not in ('bike_fare','shuttle_fare','taxi_fare') then raise exception 'This ride ticket is unavailable.'; end if;
  update public.game_inventory set quantity=quantity-1 where profile_id=caller and item_id=item.id and quantity>0 returning quantity into remaining;
  if not found then raise exception 'You need a % ticket before taking this ride.',item.name; end if;
  insert into public.game_ride_uses(profile_id,item_id,request_id) values(caller,item.id,p_request_id);
  insert into public.game_wallet_ledger(profile_id,coins_delta,xp_delta,entry_type,source_id,idempotency_key,metadata)
    values(caller,0,0,'ride_ticket_use',item.id,'ride-use:'||p_request_id::text,jsonb_build_object('item_id',item.id));
  return jsonb_build_object('ok',true,'remaining',remaining,'state',public.get_game_state());
end;
$$;

revoke all on function public.get_game_state() from public, anon;
revoke all on function public.claim_game_challenge(text,uuid,text) from public, anon;
revoke all on function public.purchase_game_item(text,uuid) from public, anon;
revoke all on function public.consume_game_ride_ticket(text,uuid) from public, anon;
grant execute on function public.get_game_state() to authenticated;
grant execute on function public.claim_game_challenge(text,uuid,text) to authenticated;
grant execute on function public.purchase_game_item(text,uuid) to authenticated;
grant execute on function public.consume_game_ride_ticket(text,uuid) to authenticated;
