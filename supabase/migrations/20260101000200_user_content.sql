-- ═══════════════════════════════════════════════════════════════════════════
-- Preach — 003: highlights, journals, tasks, friendships, direct messages
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Friendships ────────────────────────────────────────────────────────────

create type public.friendship_status as enum ('pending', 'accepted', 'declined', 'blocked');

create table public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  status        public.friendship_status not null default 'pending',
  -- Shown on the request card: "Fav: Prov 27:17"
  favourite_ref text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint no_self_friendship check (requester_id <> recipient_id),
  -- One row per ordered pair; the accept path reuses the existing row rather
  -- than inserting a mirror, so a pair can never be half-accepted.
  unique (requester_id, recipient_id)
);

create index friendships_recipient_idx on public.friendships (recipient_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

create trigger friendships_updated_at
  before update on public.friendships
  for each row execute function public.set_updated_at();

-- Are these two users accepted friends, in either direction?
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.recipient_id = b)
        or (f.requester_id = b and f.recipient_id = a))
  );
$$;

alter table public.friendships enable row level security;

create policy "users see friendships they are part of"
  on public.friendships for select to authenticated
  using (requester_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create policy "users send their own friend requests"
  on public.friendships for insert to authenticated
  with check (requester_id = (select auth.uid()));

-- Either side may update: the recipient accepts/declines, the requester may
-- withdraw. The status transition itself is validated by a trigger below.
create policy "participants update their friendship"
  on public.friendships for update to authenticated
  using (requester_id = (select auth.uid()) or recipient_id = (select auth.uid()))
  with check (requester_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create policy "participants delete their friendship"
  on public.friendships for delete to authenticated
  using (requester_id = (select auth.uid()) or recipient_id = (select auth.uid()));

-- Only the recipient may accept or decline a pending request. Without this a
-- requester could accept their own request straight through the update policy.
create or replace function public.guard_friendship_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('accepted', 'declined')
     and old.status = 'pending'
     and auth.uid() is distinct from old.recipient_id then
    raise exception 'only the recipient may accept or decline a friend request';
  end if;
  return new;
end;
$$;

create trigger friendships_guard_transition
  before update on public.friendships
  for each row execute function public.guard_friendship_transition();

-- ─── Highlights ─────────────────────────────────────────────────────────────

create table public.highlights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  verse_ref   text not null,                   -- 2CO.3.17
  -- Denormalised for the Me → Highlights filters (by book / by date / colour).
  book_id     text not null,
  chapter     integer not null,
  color       text not null,                   -- rgba(...) exactly as picked
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, verse_ref)
);

create index highlights_user_idx on public.highlights (user_id, created_at desc);
create index highlights_user_book_idx on public.highlights (user_id, book_id, chapter);
create index highlights_user_color_idx on public.highlights (user_id, color);

create trigger highlights_updated_at
  before update on public.highlights
  for each row execute function public.set_updated_at();

alter table public.highlights enable row level security;

create policy "users manage their own highlights"
  on public.highlights for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ─── Journals ───────────────────────────────────────────────────────────────
-- A journal is a container. Every user gets one `personal` journal on signup;
-- a `shared` journal is co-authored by exactly two friends and is reachable
-- from the 📔 button in a 1:1 chat.

create type public.journal_kind as enum ('personal', 'shared');

create table public.journals (
  id          uuid primary key default gen_random_uuid(),
  kind        public.journal_kind not null default 'personal',
  title       text not null default 'My Journal',
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.journal_members (
  journal_id  uuid not null references public.journals(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (journal_id, user_id)
);

create index journal_members_user_idx on public.journal_members (user_id);

create table public.journal_entries (
  id            uuid primary key default gen_random_uuid(),
  journal_id    uuid not null references public.journals(id) on delete cascade,
  author_id     uuid not null references public.profiles(id) on delete cascade,
  title         text not null default 'Untitled entry',
  body          text not null default '',
  -- Canonical refs cited by this entry, e.g. {PSA.27.14, ISA.40.31}. Tapping
  -- one deep-links into the Read tab at that verse.
  linked_verses text[] not null default '{}',
  study_plan    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index journal_entries_journal_idx on public.journal_entries (journal_id, created_at desc);
create index journal_entries_author_idx on public.journal_entries (author_id, created_at desc);

create trigger journal_entries_updated_at
  before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- Tasks are a table rather than a column on the entry: they carry due dates and
-- reminder timestamps, and the reminder scheduler queries them directly.
create table public.journal_tasks (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null references public.journal_entries(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  label         text not null,
  done          boolean not null default false,
  due_at        timestamptz,
  remind_at     timestamptz,
  -- Identifier returned by expo-notifications so a reschedule can cancel the
  -- previous local notification.
  local_notification_id text,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index journal_tasks_entry_idx on public.journal_tasks (entry_id, position);
create index journal_tasks_reminders_idx on public.journal_tasks (user_id, remind_at)
  where remind_at is not null and done = false;

create trigger journal_tasks_updated_at
  before update on public.journal_tasks
  for each row execute function public.set_updated_at();

create or replace function public.is_journal_member(j uuid, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.journal_members m
    where m.journal_id = j and m.user_id = u
  );
$$;

alter table public.journals enable row level security;
alter table public.journal_members enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_tasks enable row level security;

create policy "members read their journals"
  on public.journals for select to authenticated
  using (public.is_journal_member(id, (select auth.uid())));

create policy "users create journals"
  on public.journals for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "members update their journals"
  on public.journals for update to authenticated
  using (public.is_journal_member(id, (select auth.uid())))
  with check (public.is_journal_member(id, (select auth.uid())));

create policy "members read the roster"
  on public.journal_members for select to authenticated
  using (public.is_journal_member(journal_id, (select auth.uid())));

-- You may add yourself, or the journal's creator may add a friend as the
-- second author of a shared journal.
create policy "members join or are invited"
  on public.journal_members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.journals j
      where j.id = journal_id
        and j.created_by = (select auth.uid())
        and j.kind = 'shared'
        and public.are_friends(j.created_by, journal_members.user_id)
    )
  );

create policy "members leave a journal"
  on public.journal_members for delete to authenticated
  using (user_id = (select auth.uid()));

-- Both co-authors of a shared journal can add *and edit* entries, which is why
-- update is scoped to journal membership rather than authorship.
create policy "members read entries"
  on public.journal_entries for select to authenticated
  using (public.is_journal_member(journal_id, (select auth.uid())));

create policy "members write entries"
  on public.journal_entries for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_journal_member(journal_id, (select auth.uid()))
  );

create policy "members edit entries"
  on public.journal_entries for update to authenticated
  using (public.is_journal_member(journal_id, (select auth.uid())))
  with check (public.is_journal_member(journal_id, (select auth.uid())));

create policy "authors delete their entries"
  on public.journal_entries for delete to authenticated
  using (author_id = (select auth.uid()));

-- Tasks are personal even inside a shared journal: your intentions are yours.
create policy "users manage their own tasks"
  on public.journal_tasks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Give every new user a personal journal at signup so the Me tab is never
-- empty-by-accident.
create or replace function public.create_personal_journal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jid uuid;
begin
  insert into public.journals (kind, title, created_by)
  values ('personal', 'My Journal', new.id)
  returning id into jid;

  insert into public.journal_members (journal_id, user_id) values (jid, new.id);
  return new;
end;
$$;

create trigger profiles_create_personal_journal
  after insert on public.profiles
  for each row execute function public.create_personal_journal();

-- ─── Direct messages ────────────────────────────────────────────────────────

create table public.direct_messages (
  id                 uuid primary key default gen_random_uuid(),
  sender_id          uuid not null references public.profiles(id) on delete cascade,
  recipient_id       uuid not null references public.profiles(id) on delete cascade,
  -- Stable, order-independent key for a 1:1 thread, so realtime subscribes to
  -- one channel per conversation regardless of who sent what.
  conversation_key   text generated always as (
    least(sender_id::text, recipient_id::text) || ':' ||
    greatest(sender_id::text, recipient_id::text)
  ) stored,
  body               text,
  voice_note_url     text,
  voice_note_ms      integer,
  shared_verse_ref   text,
  read_at            timestamptz,
  created_at         timestamptz not null default now(),
  constraint message_has_content check (
    coalesce(nullif(body, ''), voice_note_url, shared_verse_ref) is not null
  ),
  constraint no_self_message check (sender_id <> recipient_id)
);

create index direct_messages_conversation_idx
  on public.direct_messages (conversation_key, created_at desc);
create index direct_messages_unread_idx
  on public.direct_messages (recipient_id, read_at) where read_at is null;

alter table public.direct_messages enable row level security;

create policy "participants read their messages"
  on public.direct_messages for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

-- You may only message an accepted friend.
create policy "friends send messages"
  on public.direct_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.are_friends(sender_id, recipient_id)
  );

-- Scoped to the recipient so the only field they can flip is read_at; senders
-- cannot edit a message after it has landed.
create policy "recipients mark messages read"
  on public.direct_messages for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy "senders delete their messages"
  on public.direct_messages for delete to authenticated
  using (sender_id = (select auth.uid()));
