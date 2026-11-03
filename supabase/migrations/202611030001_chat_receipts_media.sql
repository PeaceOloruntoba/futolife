-- Per-user read receipts and private, conversation-scoped uploads.
alter table public.messages
  add column if not exists message_kind text not null default 'text'
    check (message_kind in ('text','image','video','document','voice')),
  add column if not exists attachment_bucket text,
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_size bigint,
  add column if not exists attachment_mime text;

alter table public.messages drop constraint if exists messages_attachment_metadata_check;
alter table public.messages add constraint messages_attachment_metadata_check check (
  (message_kind='text' and attachment_bucket is null and attachment_path is null and attachment_name is null and attachment_size is null and attachment_mime is null)
  or
  (message_kind<>'text' and attachment_bucket is not null and attachment_bucket in ('chat-images','chat-attachments') and attachment_path is not null and attachment_name is not null and attachment_size is not null and attachment_size between 1 and 26214400 and attachment_mime is not null and ((message_kind='image' and attachment_bucket='chat-images' and attachment_size<=10485760) or (message_kind<>'image' and attachment_bucket='chat-attachments')))
);
create index if not exists messages_unread_lookup_idx on public.messages(conversation_id,sender_id,created_at desc);

create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(message_id,profile_id)
);
create index if not exists message_reads_profile_idx on public.message_reads(profile_id,message_id);
alter table public.message_reads enable row level security;
drop policy if exists "Conversation members can see read receipts" on public.message_reads;
create policy "Conversation members can see read receipts" on public.message_reads
for select to authenticated using (
  exists(select 1 from public.messages m where m.id=message_id and public.is_conversation_member(m.conversation_id))
);
drop policy if exists "Users can record their own reads" on public.message_reads;
create policy "Users can record their own reads" on public.message_reads
for insert to authenticated with check (
  profile_id=(select auth.uid()) and exists(select 1 from public.messages m where m.id=message_id and m.sender_id<>profile_id and public.is_conversation_member(m.conversation_id))
);

create or replace function public.mark_conversation_read(target_conversation uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); inserted_count integer;
begin
  if caller is null or not public.is_conversation_member(target_conversation) then
    raise exception 'You are not a member of this conversation';
  end if;
  insert into public.message_reads(message_id,profile_id)
    select m.id,caller from public.messages m
    where m.conversation_id=target_conversation and m.sender_id<>caller
    on conflict(message_id,profile_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

create or replace function public.get_my_unread_counts()
returns table(conversation_id uuid, unread_count bigint)
language sql stable security definer set search_path = '' as $$
  select m.conversation_id,count(*)::bigint
  from public.messages m
  join public.conversation_members cm on cm.conversation_id=m.conversation_id and cm.profile_id=auth.uid()
  where m.sender_id<>auth.uid()
    and public.is_conversation_member(m.conversation_id)
    and not exists(select 1 from public.message_reads mr where mr.message_id=m.id and mr.profile_id=auth.uid())
  group by m.conversation_id;
$$;
revoke all on function public.get_my_unread_counts() from public;
grant execute on function public.get_my_unread_counts() to authenticated;

drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages" on public.messages for insert to authenticated with check (
  sender_id=(select auth.uid()) and public.is_user_active() and public.is_conversation_member(conversation_id)
  and ((message_kind='text' and attachment_bucket is null and attachment_path is null)
    or (message_kind<>'text' and attachment_bucket in ('chat-images','chat-attachments')
      and attachment_path like conversation_id::text||'/'||(select auth.uid())::text||'/%'))
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-images','chat-images',false,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-attachments','chat-attachments',false,26214400,array[
  'video/mp4','video/webm','video/quicktime',
  'application/pdf','text/plain','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-wav'
]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Chat members can read conversation uploads" on storage.objects;
create policy "Chat members can read conversation uploads" on storage.objects for select to authenticated using (
  bucket_id in ('chat-images','chat-attachments')
  and public.is_conversation_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists "Chat members can upload conversation files" on storage.objects;
create policy "Chat members can upload conversation files" on storage.objects for insert to authenticated with check (
  bucket_id in ('chat-images','chat-attachments')
  and public.is_user_active()
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and public.is_conversation_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists "Uploaders can remove own conversation files" on storage.objects;
create policy "Uploaders can remove own conversation files" on storage.objects for delete to authenticated using (
  bucket_id in ('chat-images','chat-attachments') and (storage.foldername(name))[2]=(select auth.uid())::text
  and public.is_conversation_member(((storage.foldername(name))[1])::uuid)
);

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='message_reads') then
      alter publication supabase_realtime add table public.message_reads;
    end if;
  end if;
end $$;
