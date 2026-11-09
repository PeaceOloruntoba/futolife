-- Real campus avatars are opt-in, short-lived Realtime presence.
-- The payload contains only in-world position/mount state; display names and
-- profile photos are resolved from authenticated profiles by the app.
drop policy if exists "Authenticated users can receive campus presence" on realtime.messages;
create policy "Authenticated users can receive campus presence"
  on realtime.messages for select to authenticated
  using (
    realtime.topic() = 'futo-campus-presence-v1'
    and realtime.messages.extension = 'presence'
    and public.is_user_active()
  );

drop policy if exists "Active users can publish campus presence" on realtime.messages;
create policy "Active users can publish campus presence"
  on realtime.messages for insert to authenticated
  with check (
    realtime.topic() = 'futo-campus-presence-v1'
    and realtime.messages.extension = 'presence'
    and public.is_user_active()
  );
