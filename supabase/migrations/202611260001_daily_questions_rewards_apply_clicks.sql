-- FLN rewards, a per-user non-repeating daily trivia sequence, and apply-click audit.
alter table public.game_wallet_ledger drop constraint if exists game_wallet_ledger_entry_type_check;
alter table public.game_wallet_ledger add constraint game_wallet_ledger_entry_type_check
  check (entry_type in ('challenge_reward','store_purchase','ride_ticket_use','admin_adjustment','referral_reward'));

-- 500 unique, answerable daily brain warm-ups. Stable IDs keep yearly sequences repeatable.
insert into public.game_challenges(id,title,description,category,challenge_type,repeat_period,coin_reward,xp_reward,prompt,choices)
select 'daily-math-'||lpad(n::text,4,'0'),'Daily question','One fresh brain warm-up, selected just for you.','daily','trivia','daily',25,25,
  'What is '||((n-1)/50)||' + '||(((n-1)%50)+1)||'?',
  jsonb_build_array((((n-1)/50)+((n-1)%50)+1)::text,(((n-1)/50)+((n-1)%50)+2)::text,(((n-1)/50)+((n-1)%50)+3)::text)
from generate_series(1,500) n
on conflict(id) do update set title=excluded.title,description=excluded.description,category=excluded.category,
  challenge_type=excluded.challenge_type,repeat_period=excluded.repeat_period,coin_reward=25,xp_reward=25,
  prompt=excluded.prompt,choices=excluded.choices,active=true;
insert into public.game_challenge_answers(challenge_id,accepted_answers)
select 'daily-math-'||lpad(n::text,4,'0'),array[(((n-1)/50)+((n-1)%50)+1)::text]
from generate_series(1,500) n
on conflict(challenge_id) do update set accepted_answers=excluded.accepted_answers;

update public.game_challenges set coin_reward=20 where id='daily-arrival';

-- Every referral earns the inviter 100 FLN, including existing referral relationships.
create or replace function public.reward_referral()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.game_wallet_ledger(profile_id,coins_delta,xp_delta,entry_type,source_id,idempotency_key,metadata)
  values(new.referrer_id,100,0,'referral_reward',new.id::text,'referral:'||new.id::text,
    jsonb_build_object('referred_user_id',new.referred_id,'referral_id',new.id))
  on conflict(profile_id,idempotency_key) do nothing;
  return new;
end;
$$;
drop trigger if exists reward_referral on public.referrals;
create trigger reward_referral after insert on public.referrals for each row execute function public.reward_referral();
insert into public.game_wallet_ledger(profile_id,coins_delta,xp_delta,entry_type,source_id,idempotency_key,metadata)
select r.referrer_id,100,0,'referral_reward',r.id::text,'referral:'||r.id::text,
  jsonb_build_object('referred_user_id',r.referred_id,'referral_id',r.id)
from public.referrals r on conflict(profile_id,idempotency_key) do nothing;

-- Track each deliberate click, while only the clicked user and opportunity admins can read it.
create table if not exists public.opportunity_apply_clicks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  profile_display_name text not null default '',
  opportunity_id uuid references public.opportunities(id) on delete set null,
  opportunity_title text not null default '',
  opportunity_slug text not null default '',
  clicked_at timestamptz not null default now()
);
create index if not exists opportunity_apply_clicks_recent_idx on public.opportunity_apply_clicks(clicked_at desc);
alter table public.opportunity_apply_clicks enable row level security;
create or replace function public.snapshot_apply_click_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select p.display_name into new.profile_display_name from public.profiles p where p.id=new.profile_id;
  select o.title,o.slug into new.opportunity_title,new.opportunity_slug from public.opportunities o where o.id=new.opportunity_id;
  return new;
end; $$;
drop trigger if exists snapshot_apply_click_user on public.opportunity_apply_clicks;
create trigger snapshot_apply_click_user before insert on public.opportunity_apply_clicks for each row execute function public.snapshot_apply_click_user();
drop policy if exists "Users can record their apply clicks" on public.opportunity_apply_clicks;
create policy "Users can record their apply clicks" on public.opportunity_apply_clicks for insert to authenticated
with check(profile_id=(select auth.uid()) and public.is_user_active() and exists(select 1 from public.opportunities o where o.id=opportunity_id and o.status='published'));
drop policy if exists "Opportunity admins can review apply clicks" on public.opportunity_apply_clicks;
create policy "Opportunity admins can review apply clicks" on public.opportunity_apply_clicks for select to authenticated using(public.can_manage_opportunities());
revoke all on public.opportunity_apply_clicks from anon,authenticated;
grant insert,select on public.opportunity_apply_clicks to authenticated;

-- Pick one question each Lagos calendar day by ranking a per-user, per-year hash order.
-- The first 365/366 unique questions are used, so there are no repeats within that year.
create or replace function public.get_game_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := auth.uid(); result jsonb; today date := (now() at time zone 'Africa/Lagos')::date;
  question_id text; question_day integer; question_year integer;
begin
  if caller is null then raise exception 'Sign in to view your game profile.'; end if;
  question_day := extract(doy from today)::integer;
  question_year := extract(year from today)::integer;
  select q.id into question_id from (
    select c.id,row_number() over(order by md5(caller::text||':'||question_year::text||':'||c.id)) as day_number
    from public.game_challenges c where c.active and c.challenge_type='trivia' and c.id like 'daily-math-%'
  ) q where q.day_number=question_day;
  select jsonb_build_object(
    'coins',coalesce((select sum(l.coins_delta) from public.game_wallet_ledger l where l.profile_id=caller),0),
    'xp',coalesce((select sum(l.xp_delta) from public.game_wallet_ledger l where l.profile_id=caller),0),
    'daily_streak',coalesce(p.daily_streak,0),'best_daily_streak',coalesce(p.best_daily_streak,0),'last_daily_claim',p.last_daily_claim,
    'challenges',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'description',c.description,'category',c.category,'type',c.challenge_type,'repeat_period',c.repeat_period,'coins',c.coin_reward,'xp',c.xp_reward,'prompt',c.prompt,'choices',c.choices,'claimable',not exists(select 1 from public.game_challenge_claims cc where cc.profile_id=caller and cc.challenge_id=c.id and cc.cycle_key=today::text),'claimed',exists(select 1 from public.game_challenge_claims cc where cc.profile_id=caller and cc.challenge_id=c.id and cc.cycle_key=today::text)) order by case when c.challenge_type='daily_login' then 0 else 1 end) from public.game_challenges c where c.active and (c.id='daily-arrival' or c.id=question_id)), '[]'::jsonb),
    'inventory',coalesce((select jsonb_agg(jsonb_build_object('id',i.item_id,'name',s.name,'category',s.category,'quantity',i.quantity,'purchase_type',s.purchase_type) order by s.category,s.name) from public.game_inventory i join public.game_store_items s on s.id=i.item_id where i.profile_id=caller and i.quantity>0), '[]'::jsonb),
    'store',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'category',s.category,'price',s.price_coins,'purchase_type',s.purchase_type) order by s.category,s.price_coins) from public.game_store_items s where s.active), '[]'::jsonb)
  ) into result from (select 1) seed left join public.game_progress p on p.profile_id=caller;
  return result;
end; $$;

create or replace function public.claim_game_challenge(p_challenge_id text, p_request_id uuid, p_answer text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); user_confirmed timestamptz; challenge public.game_challenges%rowtype;
  today date := (now() at time zone 'Africa/Lagos')::date; cycle text; streak integer; awarded_coins integer; awarded_xp integer; expected_question text;
begin
  if caller is null then raise exception 'Sign in to claim game rewards.'; end if;
  if p_request_id is null then raise exception 'A request id is required.'; end if;
  select u.email_confirmed_at into user_confirmed from auth.users u where u.id=caller;
  if user_confirmed is null then raise exception 'Confirm your email before earning game rewards.'; end if;
  if not public.is_user_active() then raise exception 'This account cannot earn game rewards.'; end if;
  select * into challenge from public.game_challenges where id=p_challenge_id and active for share;
  if not found then raise exception 'This challenge is unavailable.'; end if;
  if challenge.id='daily-arrival' then cycle:=today::text;
  elsif challenge.id like 'daily-math-%' and challenge.challenge_type='trivia' then
    select q.id into expected_question from (
      select c.id,row_number() over(order by md5(caller::text||':'||extract(year from today)::text||':'||c.id)) as day_number
      from public.game_challenges c where c.active and c.challenge_type='trivia' and c.id like 'daily-math-%'
    ) q where q.day_number=extract(doy from today)::integer;
    if expected_question is distinct from challenge.id then raise exception 'That question is not assigned to you today.'; end if;
    if p_answer is null or not exists(select 1 from public.game_challenge_answers a where a.challenge_id=challenge.id and lower(btrim(p_answer))=any(a.accepted_answers)) then raise exception 'That answer is not correct yet.'; end if;
    cycle:=today::text;
  else raise exception 'This activity is unavailable.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text,0));
  if exists(select 1 from public.game_challenge_claims c where c.profile_id=caller and c.request_id=p_request_id) or
    exists(select 1 from public.game_challenge_claims c where c.profile_id=caller and c.challenge_id=challenge.id and c.cycle_key=cycle) then
    return jsonb_build_object('ok',true,'already_claimed',true,'state',public.get_game_state());
  end if;
  if challenge.id='daily-arrival' then
    insert into public.game_progress(profile_id) values(caller) on conflict(profile_id) do nothing;
    select case when last_daily_claim=today-1 then daily_streak+1 else 1 end into streak from public.game_progress where profile_id=caller for update;
    update public.game_progress set daily_streak=streak,best_daily_streak=greatest(best_daily_streak,streak),last_daily_claim=today,updated_at=now() where profile_id=caller;
    awarded_coins:=20;
    awarded_xp:=challenge.xp_reward+case when streak>0 and streak%7=0 then 50 else 0 end;
  else awarded_coins:=25; awarded_xp:=challenge.xp_reward; end if;
  insert into public.game_challenge_claims(profile_id,challenge_id,cycle_key,request_id,coins_awarded,xp_awarded) values(caller,challenge.id,cycle,p_request_id,awarded_coins,awarded_xp);
  insert into public.game_wallet_ledger(profile_id,coins_delta,xp_delta,entry_type,source_id,idempotency_key,metadata)
    values(caller,awarded_coins,awarded_xp,'challenge_reward',challenge.id||':'||cycle,'claim:'||p_request_id::text,jsonb_build_object('challenge_id',challenge.id,'streak',case when challenge.id='daily-arrival' then streak else null end));
  return jsonb_build_object('ok',true,'already_claimed',false,'coins_awarded',awarded_coins,'xp_awarded',awarded_xp,'state',public.get_game_state());
end; $$;

revoke all on function public.get_game_state() from public,anon;
revoke all on function public.claim_game_challenge(text,uuid,text) from public,anon;
grant execute on function public.get_game_state() to authenticated;
grant execute on function public.claim_game_challenge(text,uuid,text) to authenticated;
