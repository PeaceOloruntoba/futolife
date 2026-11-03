-- Persistent in-app notifications and an administrator-only append-only audit trail.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null default 'FUTO Life member',
  notification_type text not null check (notification_type in ('friend_request','friend_accepted','message')),
  title text not null,
  summary text not null,
  target_path text not null,
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_recipient_unread_idx on public.notifications(recipient_id,created_at desc) where read_at is null;
create index if not exists notifications_recipient_created_idx on public.notifications(recipient_id,created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications" on public.notifications for select to authenticated using(recipient_id=(select auth.uid()));
drop policy if exists "Users can mark own notifications read" on public.notifications;
create policy "Users can mark own notifications read" on public.notifications for update to authenticated using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
revoke all on public.notifications from anon,authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_created_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_actor_idx on public.activity_logs(actor_id,created_at desc);
alter table public.activity_logs enable row level security;
drop policy if exists "Only admins can view activity logs" on public.activity_logs;
create policy "Only admins can view activity logs" on public.activity_logs for select to authenticated using(public.is_admin());
revoke all on public.activity_logs from anon,authenticated;
grant select on public.activity_logs to authenticated;

create or replace function public.insert_activity_log(
  p_actor_id uuid, p_action text, p_entity_type text default null,
  p_entity_id text default null, p_metadata jsonb default '{}'::jsonb, p_actor_email text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare resolved_email text;
begin
  if p_actor_id is not null then
    select u.email into resolved_email from auth.users u where u.id=p_actor_id;
  end if;
  insert into public.activity_logs(actor_id,actor_email,action,entity_type,entity_id,metadata)
  values(p_actor_id,coalesce(p_actor_email,resolved_email),p_action,p_entity_type,p_entity_id,coalesce(p_metadata,'{}'::jsonb));
end;
$$;
revoke all on function public.insert_activity_log(uuid,text,text,text,jsonb,text) from public,anon,authenticated;

-- Browser-originated events are restricted to events that do not have a reliable row trigger.
create or replace function public.record_user_activity(
  p_action text, p_entity_type text default null, p_entity_id text default null,
  p_contact_email text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); contact text := lower(trim(coalesce(p_contact_email,'')));
begin
  if p_action not in ('auth.login','auth.logout','auth.password_reset_requested','auth.login_failed','auth.signup_failed','profile.viewed','chat.opened','place.viewed','admin.activity_log.viewed') then
    raise exception 'Unsupported activity event';
  end if;
  if p_action in ('auth.password_reset_requested','auth.login_failed','auth.signup_failed') then
    if contact !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'A valid email is required'; end if;
    if (select count(*) from public.activity_logs l where l.action=p_action and l.actor_email=contact and l.created_at>now()-interval '1 hour')>=10 then
      return;
    end if;
    perform public.insert_activity_log(caller,p_action,p_entity_type,p_entity_id,jsonb_build_object('source','password_recovery'),contact);
    return;
  end if;
  if caller is null then raise exception 'Sign in is required to record this activity'; end if;
  if p_action='admin.activity_log.viewed' and not public.is_admin() then raise exception 'Administrator access is required'; end if;
  if p_action='profile.viewed' and p_entity_type='profile' and p_entity_id=caller::text then return; end if;
  perform public.insert_activity_log(caller,p_action,p_entity_type,p_entity_id,'{}'::jsonb,null);
end;
$$;
revoke all on function public.record_user_activity(text,text,text,text) from public;
grant execute on function public.record_user_activity(text,text,text,text) to authenticated,anon;

create or replace function public.audit_app_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare row_data jsonb; old_data jsonb; actor uuid; action_name text; entity_key text; details jsonb := '{}'::jsonb;
begin
  if tg_op='DELETE' then row_data:=to_jsonb(old); else row_data:=to_jsonb(new); end if;
  if tg_op='UPDATE' then old_data:=to_jsonb(old); end if;
  actor:=auth.uid();
  if actor is null then
    begin actor:=coalesce(nullif(row_data->>'sender_id','')::uuid,nullif(row_data->>'author_id','')::uuid,nullif(row_data->>'profile_id','')::uuid,nullif(row_data->>'requester_id','')::uuid,nullif(row_data->>'reporter_id','')::uuid,nullif(row_data->>'created_by','')::uuid,nullif(row_data->>'referred_id','')::uuid,nullif(row_data->>'referrer_id','')::uuid); exception when invalid_text_representation then actor:=null; end;
  end if;
  entity_key:=coalesce(row_data->>'id',row_data->>'conversation_id',row_data->>'post_id',row_data->>'message_id',row_data->>'profile_id',row_data->>'user_id');
  action_name:=tg_table_name||'.'||lower(tg_op);
  if tg_table_name='profiles' then
    action_name:=case when tg_op='INSERT' then 'profile.created' when tg_op='UPDATE' then 'profile.updated' else 'profile.deleted' end;
    if tg_op='UPDATE' then
      select coalesce(jsonb_agg(n.key),'[]'::jsonb) into details from jsonb_each(to_jsonb(new)) n join jsonb_each(old_data) o on o.key=n.key where n.value is distinct from o.value and n.key not in ('updated_at');
      details:=jsonb_build_object('changed_fields',details);
    end if;
  elsif tg_table_name='friendships' then
    action_name:=case when tg_op='INSERT' then 'friend.requested' when tg_op='DELETE' then 'friendship.deleted' when new.status='accepted' then 'friend.request.accepted' when new.status='declined' then 'friend.request.declined' else 'friend.request.updated' end;
    details:=jsonb_build_object('status',case when tg_op='DELETE' then row_data->>'status' else new.status end,'requester_id',row_data->>'requester_id','addressee_id',row_data->>'addressee_id');
  elsif tg_table_name='messages' then
    action_name:='message.sent'; details:=jsonb_build_object('conversation_id',row_data->>'conversation_id','message_kind',row_data->>'message_kind');
  elsif tg_table_name='message_reads' then
    action_name:='message.read'; details:=jsonb_build_object('message_id',row_data->>'message_id');
  elsif tg_table_name='conversations' then action_name:='chat.created';
  elsif tg_table_name='conversation_members' then action_name:='chat.member_added';
  elsif tg_table_name='posts' then action_name:='post.'||case when tg_op='INSERT' then 'created' when tg_op='UPDATE' then 'updated' else 'deleted' end;
  elsif tg_table_name='post_comments' then action_name:='post.comment.'||lower(tg_op); details:=jsonb_build_object('post_id',row_data->>'post_id');
  elsif tg_table_name='post_reactions' then action_name:=case when tg_op='INSERT' then 'post.liked' else 'post.unliked' end; details:=jsonb_build_object('post_id',row_data->>'post_id');
  elsif tg_table_name='post_tags' then action_name:='post.friend_tagged'; details:=jsonb_build_object('post_id',row_data->>'post_id','tagged_profile_id',row_data->>'profile_id');
  elsif tg_table_name='post_reports' then action_name:='post.report.'||lower(tg_op); details:=jsonb_build_object('post_id',row_data->>'post_key','reason',row_data->>'reason','status',row_data->>'status');
  elsif tg_table_name='referrals' then action_name:='referral.created'; details:=jsonb_build_object('referred_id',row_data->>'referred_id');
  elsif tg_table_name='campus_locations' then action_name:='campus.place.'||lower(tg_op); details:=jsonb_build_object('place_name',row_data->>'name');
  elsif tg_table_name='user_roles' then action_name:='admin.role.'||lower(tg_op); details:=jsonb_build_object('role',row_data->>'role','user_id',row_data->>'user_id');
  elsif tg_table_name='notifications' and tg_op='UPDATE' and old_data->>'read_at' is null and row_data->>'read_at' is not null then action_name:='notification.read';
  end if;
  if actor is null and tg_table_name='profiles' then begin actor:=nullif(row_data->>'id','')::uuid; exception when invalid_text_representation then actor:=null; end; end if;
  perform public.insert_activity_log(actor,action_name,tg_table_name,entity_key,details,null);
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.audit_app_row_change() from public,anon,authenticated;

create or replace function public.audit_auth_user_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    perform public.insert_activity_log(new.id,'auth.signup','user',new.id::text,'{}'::jsonb,new.email);
  elsif new.encrypted_password is distinct from old.encrypted_password then
    perform public.insert_activity_log(new.id,'auth.password_changed','user',new.id::text,'{}'::jsonb,new.email);
  elsif old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.insert_activity_log(new.id,'auth.email_confirmed','user',new.id::text,'{}'::jsonb,new.email);
  end if;
  return new;
end;
$$;
revoke all on function public.audit_auth_user_change() from public,anon,authenticated;
drop trigger if exists audit_auth_user_change on auth.users;
create trigger audit_auth_user_change after insert or update on auth.users for each row execute function public.audit_auth_user_change();

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','friendships','messages','message_reads','conversations','conversation_members','posts','post_comments','post_reactions','post_tags','post_reports','referrals','campus_locations','user_roles','notifications'] loop
    execute format('drop trigger if exists audit_activity on public.%I',table_name);
    execute format('create trigger audit_activity after insert or update or delete on public.%I for each row execute function public.audit_app_row_change()',table_name);
  end loop;
end $$;

create or replace function public.notify_friendship_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient uuid; initiator uuid; kind text; heading text; summary_text text; target text; actor_label text;
begin
  if tg_op='INSERT' and new.status='pending' then recipient:=new.addressee_id; initiator:=new.requester_id; kind:='friend_request'; heading:='New friend request'; summary_text:='sent you a friend request'; target:='/community/friends';
  elsif tg_op='UPDATE' and old.status='pending' and new.status='accepted' then recipient:=new.requester_id; initiator:=new.addressee_id; kind:='friend_accepted'; heading:='Friend request accepted'; summary_text:='accepted your friend request'; target:='/community/friends';
  else return new;
  end if;
  select p.display_name into actor_label from public.profiles p where p.id=initiator;
  insert into public.notifications(recipient_id,actor_id,actor_name,notification_type,title,summary,target_path,entity_id)
  values(recipient,initiator,coalesce(actor_label,'A FUTO student'),kind,heading,coalesce(actor_label,'A FUTO student')||' '||summary_text,target,new.id);
  return new;
end;
$$;
revoke all on function public.notify_friendship_event() from public,anon,authenticated;
drop trigger if exists notify_friendship_event on public.friendships;
create trigger notify_friendship_event after insert or update on public.friendships for each row execute function public.notify_friendship_event();

create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor_label text; recipient uuid; conversation_label text;
begin
  select p.display_name into actor_label from public.profiles p where p.id=new.sender_id;
  select c.title into conversation_label from public.conversations c where c.id=new.conversation_id and c.kind='group';
  for recipient in select cm.profile_id from public.conversation_members cm where cm.conversation_id=new.conversation_id and cm.profile_id<>new.sender_id loop
    insert into public.notifications(recipient_id,actor_id,actor_name,notification_type,title,summary,target_path,entity_id)
    values(recipient,new.sender_id,coalesce(actor_label,'A FUTO student'),'message',coalesce(conversation_label,actor_label,'New message'),coalesce(actor_label,'A FUTO student')||' sent you a message','/community/messages/'||new.conversation_id::text,new.conversation_id);
  end loop;
  return new;
end;
$$;
revoke all on function public.notify_new_message() from public,anon,authenticated;
drop trigger if exists notify_new_message on public.messages;
create trigger notify_new_message after insert on public.messages for each row execute function public.notify_new_message();

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
