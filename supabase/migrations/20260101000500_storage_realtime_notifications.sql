-- ═══════════════════════════════════════════════════════════════════════════
-- Preach — 006: storage buckets, realtime publication, push fan-out
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Storage ────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/heic']),
  ('voice-notes', 'voice-notes', false, 26214400,
   array['audio/m4a','audio/mp4','audio/aac','audio/mpeg','audio/wav','audio/x-m4a']),
  ('room-images', 'room-images', true, 10485760,
   array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Avatars: world-readable, owner-writable. Object path is `<uid>/<filename>`.
create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users replace their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Voice notes: private bucket. Path is `<conversation_key>/<uid>-<ts>.m4a`, so
-- a note is readable exactly by the two people in that conversation. Playback
-- uses a signed URL minted on demand.
create policy "conversation participants read voice notes"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'voice-notes'
    and (select auth.uid())::text = any (
      string_to_array((storage.foldername(name))[1], ':')
    )
  );

create policy "conversation participants upload voice notes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'voice-notes'
    and (select auth.uid())::text = any (
      string_to_array((storage.foldername(name))[1], ':')
    )
  );

create policy "senders delete their voice notes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'voice-notes'
    and (select auth.uid())::text = any (
      string_to_array((storage.foldername(name))[1], ':')
    )
  );

create policy "room images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'room-images');

create policy "members upload room images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'room-images'
    and public.is_room_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  );

-- ─── Realtime ───────────────────────────────────────────────────────────────
-- Postgres-changes streams for everything the UI must update without a manual
-- refresh. RLS still applies to realtime, so a subscriber only ever receives
-- rows they were already allowed to read.

alter publication supabase_realtime add table public.direct_messages;
alter publication supabase_realtime add table public.study_room_notes;
alter publication supabase_realtime add table public.study_room_members;
alter publication supabase_realtime add table public.circle_messages;
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.journal_entries;
alter publication supabase_realtime add table public.study_rooms;

-- REPLICA IDENTITY FULL so DELETE and UPDATE events carry enough of the old row
-- for RLS to be evaluated against them.
alter table public.direct_messages replica identity full;
alter table public.study_room_notes replica identity full;
alter table public.circle_messages replica identity full;
alter table public.friendships replica identity full;
alter table public.journal_entries replica identity full;

-- ─── Push notification fan-out ──────────────────────────────────────────────
-- Triggers hand off to the `send-push` Edge Function through pg_net. pg_net is
-- available on hosted Supabase; on a bare local Postgres it may not be, so the
-- dispatcher degrades to a no-op rather than failing the originating write —
-- a missed push must never roll back the message that caused it.

create extension if not exists "pg_net" with schema extensions;

create or replace function public.dispatch_push(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  fn_url text;
  service_key text;
begin
  -- Set once per project:
  --   alter database postgres set app.settings.functions_url = 'https://<ref>.supabase.co/functions/v1';
  --   alter database postgres set app.settings.service_role_key = '<service-role-key>';
  fn_url := current_setting('app.settings.functions_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  if fn_url is null or service_key is null then
    return;
  end if;

  perform extensions.http_post(
    url := fn_url || '/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := payload
  );
exception when others then
  -- Never let notification delivery break the write that triggered it.
  raise warning 'dispatch_push failed: %', sqlerrm;
end;
$$;

create or replace function public.notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
begin
  select display_name into sender_name from public.profiles where id = new.sender_id;
  perform public.dispatch_push(jsonb_build_object(
    'kind', 'direct_message',
    'user_id', new.recipient_id,
    'title', sender_name,
    'body', coalesce(
      nullif(new.body, ''),
      case when new.voice_note_url is not null then '🎤 Sent a voice note' end,
      case when new.shared_verse_ref is not null then '📖 Shared ' || new.shared_verse_ref end,
      'New message'
    ),
    'data', jsonb_build_object('route', '/chat/' || new.sender_id)
  ));
  return new;
end;
$$;

create trigger direct_messages_notify
  after insert on public.direct_messages
  for each row execute function public.notify_direct_message();

create or replace function public.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_name text;
  recipient_name text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select display_name into requester_name from public.profiles where id = new.requester_id;
    perform public.dispatch_push(jsonb_build_object(
      'kind', 'friend_request',
      'user_id', new.recipient_id,
      'title', 'New friend request',
      'body', requester_name || ' would like to study with you',
      'data', jsonb_build_object('route', '/(tabs)/friends?tab=requests')
    ));
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
    select display_name into recipient_name from public.profiles where id = new.recipient_id;
    perform public.dispatch_push(jsonb_build_object(
      'kind', 'friend_accepted',
      'user_id', new.requester_id,
      'title', 'Request accepted',
      'body', recipient_name || ' accepted your friend request',
      'data', jsonb_build_object('route', '/chat/' || new.recipient_id)
    ));
  end if;
  return new;
end;
$$;

create trigger friendships_notify
  after insert or update on public.friendships
  for each row execute function public.notify_friend_request();

-- Study-room activity: notify every member except the author.
create or replace function public.notify_room_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_name text;
  room_name text;
  member record;
begin
  if new.is_shared = false then
    return new;
  end if;

  select display_name into author_name from public.profiles where id = new.user_id;
  select name into room_name from public.study_rooms where id = new.room_id;

  for member in
    select user_id from public.study_room_members
     where room_id = new.room_id and user_id <> new.user_id
  loop
    perform public.dispatch_push(jsonb_build_object(
      'kind', 'room_note',
      'user_id', member.user_id,
      'title', room_name,
      'body', author_name || ': ' || left(new.body, 120),
      'data', jsonb_build_object('route', '/room/' || new.room_id)
    ));
  end loop;
  return new;
end;
$$;

create trigger study_room_notes_notify
  after insert on public.study_room_notes
  for each row execute function public.notify_room_note();
