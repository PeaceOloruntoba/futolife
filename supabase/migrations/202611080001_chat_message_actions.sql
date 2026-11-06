alter table public.messages
  add column if not exists edited_at timestamptz,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null;

create index if not exists messages_reply_to_idx on public.messages(reply_to_id) where reply_to_id is not null;

drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages" on public.messages for insert to authenticated with check (
  sender_id=(select auth.uid()) and public.is_user_active() and public.is_conversation_member(conversation_id)
  and (reply_to_id is null or exists(
    select 1 from public.messages replied
    where replied.id=public.messages.reply_to_id and replied.conversation_id=public.messages.conversation_id
  ))
  and ((message_kind='text' and attachment_bucket is null and attachment_path is null)
    or (message_kind<>'text' and attachment_bucket in ('chat-images','chat-attachments')
      and attachment_path like conversation_id::text||'/'||(select auth.uid())::text||'/%'))
);

create or replace function public.edit_my_message(target_message uuid, new_body text)
returns public.messages language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); target public.messages%rowtype;
begin
  if caller is null then raise exception 'Sign in to edit a message.'; end if;
  select * into target from public.messages where id=target_message for update;
  if not found or target.sender_id<>caller or not public.is_conversation_member(target.conversation_id) then
    raise exception 'You can only edit your own message in a conversation you belong to.';
  end if;
  if target.is_deleted then raise exception 'Deleted messages cannot be edited.'; end if;
  if target.message_kind<>'text' then raise exception 'Only text messages can be edited.'; end if;
  if new_body is null or char_length(trim(new_body)) not between 1 and 4000 then
    raise exception 'Message must contain between 1 and 4000 characters.';
  end if;
  update public.messages set body=trim(new_body),edited_at=now() where id=target_message returning * into target;
  return target;
end;
$$;

create or replace function public.delete_my_message(target_message uuid)
returns public.messages language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); target public.messages%rowtype;
begin
  if caller is null then raise exception 'Sign in to delete a message.'; end if;
  select * into target from public.messages where id=target_message for update;
  if not found or target.sender_id<>caller or not public.is_conversation_member(target.conversation_id) then
    raise exception 'You can only delete your own message in a conversation you belong to.';
  end if;
  if target.is_deleted then raise exception 'This message is already deleted.'; end if;
  update public.messages set body='This message was deleted',is_deleted=true,edited_at=null
  where id=target_message returning * into target;
  return target;
end;
$$;

revoke all on function public.edit_my_message(uuid,text) from public,anon;
revoke all on function public.delete_my_message(uuid) from public,anon;
grant execute on function public.edit_my_message(uuid,text) to authenticated;
grant execute on function public.delete_my_message(uuid) to authenticated;

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('👍','❤️','😂','😮','😢','🙏')),
  created_at timestamptz not null default now(),
  primary key(message_id,profile_id)
);
create index if not exists message_reactions_message_idx on public.message_reactions(message_id);
alter table public.message_reactions enable row level security;
drop policy if exists "Conversation members can see message reactions" on public.message_reactions;
create policy "Conversation members can see message reactions" on public.message_reactions for select to authenticated using (
  exists(select 1 from public.messages m where m.id=message_id and public.is_conversation_member(m.conversation_id))
);
drop policy if exists "Active members can react to messages" on public.message_reactions;
create policy "Active members can react to messages" on public.message_reactions for insert to authenticated with check (
  profile_id=(select auth.uid()) and public.is_user_active()
  and exists(select 1 from public.messages m where m.id=message_id and not m.is_deleted and public.is_conversation_member(m.conversation_id))
);
drop policy if exists "Users can change their message reaction" on public.message_reactions;
create policy "Users can change their message reaction" on public.message_reactions for update to authenticated using (
  profile_id=(select auth.uid()) and public.is_user_active()
) with check (
  profile_id=(select auth.uid()) and public.is_user_active()
  and exists(select 1 from public.messages m where m.id=message_id and not m.is_deleted and public.is_conversation_member(m.conversation_id))
);
drop policy if exists "Users can remove their message reaction" on public.message_reactions;
create policy "Users can remove their message reaction" on public.message_reactions for delete to authenticated using (
  profile_id=(select auth.uid()) and public.is_conversation_member((select m.conversation_id from public.messages m where m.id=message_id))
);

-- Replace the generic message audit trigger so edits and tombstones are recorded
-- distinctly and message contents are never copied into the activity log.
drop trigger if exists audit_activity on public.messages;
create or replace function public.audit_message_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    perform public.insert_activity_log(new.sender_id,'message.sent','message',new.id::text,
      jsonb_build_object('conversation_id',new.conversation_id,'message_kind',new.message_kind),null);
  elsif new.is_deleted and not old.is_deleted then
    perform public.insert_activity_log(new.sender_id,'message.deleted','message',new.id::text,
      jsonb_build_object('conversation_id',new.conversation_id),null);
  elsif new.body is distinct from old.body then
    perform public.insert_activity_log(new.sender_id,'message.edited','message',new.id::text,
      jsonb_build_object('conversation_id',new.conversation_id),null);
  end if;
  return new;
end;
$$;
revoke all on function public.audit_message_change() from public,anon,authenticated;
create trigger audit_message_change after insert or update on public.messages
for each row execute function public.audit_message_change();

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='message_reactions') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
