create table if not exists public.message_hidden_for_profiles (
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key(message_id,profile_id)
);
create index if not exists message_hidden_for_profiles_profile_idx on public.message_hidden_for_profiles(profile_id,conversation_id,message_id);
alter table public.message_hidden_for_profiles enable row level security;
drop policy if exists "Users can see their hidden messages" on public.message_hidden_for_profiles;
create policy "Users can see their hidden messages" on public.message_hidden_for_profiles
  for select to authenticated using (profile_id=(select auth.uid()));
drop policy if exists "Conversation members can hide messages for themselves" on public.message_hidden_for_profiles;
create policy "Conversation members can hide messages for themselves" on public.message_hidden_for_profiles
  for insert to authenticated with check (
    profile_id=(select auth.uid()) and public.is_user_active()
    and exists(select 1 from public.messages m where m.id=message_id and m.conversation_id=message_hidden_for_profiles.conversation_id and public.is_conversation_member(m.conversation_id))
  );
grant select,insert on public.message_hidden_for_profiles to authenticated;

create or replace function public.hide_my_message(target_message uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); target public.messages%rowtype;
begin
  if caller is null then raise exception 'Sign in to delete a message for yourself.'; end if;
  select * into target from public.messages where id=target_message;
  if not found or not public.is_conversation_member(target.conversation_id) then
    raise exception 'You can only hide messages in a conversation you belong to.';
  end if;
  insert into public.message_hidden_for_profiles(message_id,conversation_id,profile_id)
    values(target_message,target.conversation_id,caller) on conflict(message_id,profile_id) do nothing;
  perform public.insert_activity_log(caller,'message.deleted_for_me','message',target_message::text,
    jsonb_build_object('conversation_id',target.conversation_id),null);
end;
$$;
revoke all on function public.hide_my_message(uuid) from public,anon;
grant execute on function public.hide_my_message(uuid) to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='message_hidden_for_profiles') then
    alter publication supabase_realtime add table public.message_hidden_for_profiles;
  end if;
end $$;
