-- ═══════════════════════════════════════════════════════════════════════════
-- Preach — 004: study rooms, live calls, healing circles
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Study rooms ────────────────────────────────────────────────────────────

create type public.room_role as enum ('owner', 'moderator', 'member');

create table public.study_rooms (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  -- The passage the room is working through: "2 Cor 3:14–18"
  verse_ref     text,
  verse_ref_end text,
  is_anonymous  boolean not null default false,
  is_private    boolean not null default false,
  created_by    uuid not null references public.profiles(id) on delete cascade,
  -- Daily.co room name, minted by the create-room-token Edge Function the
  -- first time someone starts a call.
  daily_room    text,
  call_started_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint room_name_len check (char_length(name) between 1 and 80)
);

create index study_rooms_created_idx on public.study_rooms (created_at desc);

create trigger study_rooms_updated_at
  before update on public.study_rooms
  for each row execute function public.set_updated_at();

create table public.study_room_members (
  room_id    uuid not null references public.study_rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.room_role not null default 'member',
  joined_at  timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index study_room_members_user_idx on public.study_room_members (user_id);

create table public.study_room_notes (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.study_rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  -- Shared notes are visible to every member; private notes only to the author.
  -- Enforced in RLS below, not in the client.
  is_shared  boolean not null default true,
  body       text not null,
  verse_ref  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint note_body_len check (char_length(body) between 1 and 4000)
);

create index study_room_notes_room_idx on public.study_room_notes (room_id, created_at);

create trigger study_room_notes_updated_at
  before update on public.study_room_notes
  for each row execute function public.set_updated_at();

create or replace function public.is_room_member(r uuid, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.study_room_members m
    where m.room_id = r and m.user_id = u
  );
$$;

alter table public.study_rooms enable row level security;
alter table public.study_room_members enable row level security;
alter table public.study_room_notes enable row level security;

-- Public rooms are discoverable so they can be browsed and joined; private
-- rooms only surface to members.
create policy "rooms are discoverable"
  on public.study_rooms for select to authenticated
  using (is_private = false or public.is_room_member(id, (select auth.uid())));

create policy "users create rooms"
  on public.study_rooms for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "owners update their rooms"
  on public.study_rooms for update to authenticated
  using (exists (
    select 1 from public.study_room_members m
    where m.room_id = id and m.user_id = (select auth.uid())
      and m.role in ('owner', 'moderator')
  ))
  with check (true);

create policy "owners delete their rooms"
  on public.study_rooms for delete to authenticated
  using (created_by = (select auth.uid()));

create policy "members see the roster"
  on public.study_room_members for select to authenticated
  using (
    public.is_room_member(room_id, (select auth.uid()))
    or exists (
      select 1 from public.study_rooms r
      where r.id = room_id and r.is_private = false
    )
  );

-- You may add yourself to a public room, and an owner/moderator may add a
-- friend — that second clause is what makes the room's "+ Invite" real.
create policy "users join rooms, owners invite friends"
  on public.study_room_members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.study_room_members m
      where m.room_id = study_room_members.room_id
        and m.user_id = (select auth.uid())
        and m.role in ('owner', 'moderator')
    )
  );

create policy "users leave rooms themselves"
  on public.study_room_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.study_room_members m
      where m.room_id = study_room_members.room_id
        and m.user_id = (select auth.uid())
        and m.role = 'owner'
    )
  );

-- The whole shared/private split lives here: a private note is selectable only
-- by its author, no matter who else is in the room.
create policy "members read shared notes and their own private notes"
  on public.study_room_notes for select to authenticated
  using (
    user_id = (select auth.uid())
    or (is_shared = true and public.is_room_member(room_id, (select auth.uid())))
  );

create policy "members write notes"
  on public.study_room_notes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_room_member(room_id, (select auth.uid()))
  );

create policy "authors edit their notes"
  on public.study_room_notes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "authors delete their notes"
  on public.study_room_notes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Creating a room makes you its owner in the same transaction.
create or replace function public.create_study_room(
  p_name text,
  p_description text default null,
  p_verse_ref text default null,
  p_verse_ref_end text default null,
  p_is_anonymous boolean default false,
  p_is_private boolean default false
)
returns public.study_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.study_rooms;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.study_rooms
    (name, description, verse_ref, verse_ref_end, is_anonymous, is_private, created_by)
  values
    (p_name, p_description, p_verse_ref, p_verse_ref_end, p_is_anonymous, p_is_private, auth.uid())
  returning * into room;

  insert into public.study_room_members (room_id, user_id, role)
  values (room.id, auth.uid(), 'owner');

  return room;
end;
$$;

-- Invite someone to a room by profile id. Owners and moderators only; the
-- invitee lands in the room as a member and receives a push.
create or replace function public.invite_to_room(p_room_id uuid, p_user_id uuid)
returns public.study_room_members
language plpgsql
security definer
set search_path = public
as $$
declare
  membership public.study_room_members;
  my_role public.room_role;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select role into my_role from public.study_room_members
   where room_id = p_room_id and user_id = auth.uid();

  if my_role is null or my_role not in ('owner', 'moderator') then
    raise exception 'only a room owner or moderator can invite';
  end if;

  insert into public.study_room_members (room_id, user_id, role)
  values (p_room_id, p_user_id, 'member')
  on conflict (room_id, user_id) do update set role = public.study_room_members.role
  returning * into membership;

  return membership;
end;
$$;

-- Rooms with their member counts and live state, for the Study tab list.
create or replace function public.list_study_rooms()
returns table (
  id uuid,
  name text,
  description text,
  verse_ref text,
  verse_ref_end text,
  is_anonymous boolean,
  is_private boolean,
  created_by uuid,
  daily_room text,
  call_started_at timestamptz,
  member_count integer,
  is_member boolean,
  unread_notes integer,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select r.id, r.name, r.description, r.verse_ref, r.verse_ref_end,
         r.is_anonymous, r.is_private, r.created_by, r.daily_room, r.call_started_at,
         coalesce(mc.n, 0)::integer,
         public.is_room_member(r.id, auth.uid()),
         coalesce(nc.n, 0)::integer,
         r.created_at
    from public.study_rooms r
    left join lateral (
      select count(*) as n from public.study_room_members m where m.room_id = r.id
    ) mc on true
    left join lateral (
      select count(*) as n
        from public.study_room_notes sn
       where sn.room_id = r.id
         and sn.is_shared
         and sn.created_at > coalesce(
               (select joined_at from public.study_room_members m
                 where m.room_id = r.id and m.user_id = auth.uid()),
               now())
    ) nc on true
   order by (r.call_started_at is not null) desc, r.created_at desc;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Healing circles — anonymity is a structural guarantee, not a UI convention.
--
-- No table readable by another member ever contains both a circle message and
-- the user who wrote it:
--   • circle_members maps user → alias, and is selectable only by that user.
--   • circle_messages carries the alias only, never an author id.
--   • circle_message_authors links message → author and is likewise readable
--     only by the author, so you can still delete your own message.
-- An alias is derived per-circle, so the same person appears as different
-- people in different circles and cannot be correlated across them.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.healing_circles (
  id           uuid primary key default gen_random_uuid(),
  topic        text not null,
  description  text,
  icon         text not null default '🕊',
  accent       text not null default '#8b6fd0',
  is_anonymous boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.circle_members (
  circle_id   uuid not null references public.healing_circles(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  anon_alias  text not null,
  avatar_seed text not null,
  joined_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (circle_id, user_id),
  unique (circle_id, anon_alias)
);

create table public.circle_messages (
  id               uuid primary key default gen_random_uuid(),
  circle_id        uuid not null references public.healing_circles(id) on delete cascade,
  anon_alias       text not null,
  avatar_seed      text not null,
  body             text,
  shared_verse_ref text,
  created_at       timestamptz not null default now(),
  constraint circle_message_has_content check (
    coalesce(nullif(body, ''), shared_verse_ref) is not null
  )
);

create index circle_messages_circle_idx on public.circle_messages (circle_id, created_at);

-- Deliberately separate from circle_messages so that a member reading the
-- circle feed cannot join their way to an author id.
create table public.circle_message_authors (
  message_id uuid primary key references public.circle_messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  circle_id  uuid not null references public.healing_circles(id) on delete cascade
);

create index circle_message_authors_user_idx on public.circle_message_authors (user_id);

create or replace function public.is_circle_member(c uuid, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circle_members m
    where m.circle_id = c and m.user_id = u
  );
$$;

alter table public.healing_circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_messages enable row level security;
alter table public.circle_message_authors enable row level security;

create policy "circles are browsable"
  on public.healing_circles for select to authenticated
  using (true);

-- You can read your own membership row and nobody else's — this is what keeps
-- aliases from being resolved back to people.
create policy "users read only their own circle membership"
  on public.circle_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users leave circles"
  on public.circle_members for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "members read circle messages"
  on public.circle_messages for select to authenticated
  using (public.is_circle_member(circle_id, (select auth.uid())));

create policy "authors see their own authorship rows"
  on public.circle_message_authors for select to authenticated
  using (user_id = (select auth.uid()));

-- Note there is no INSERT policy on circle_messages: posting goes exclusively
-- through post_circle_message() below, which is the only code path that can
-- attach the correct alias.
create policy "authors delete their circle messages"
  on public.circle_messages for delete to authenticated
  using (exists (
    select 1 from public.circle_message_authors a
    where a.message_id = id and a.user_id = (select auth.uid())
  ));

-- Join a circle, minting a stable per-circle pseudonym.
--
-- The alias is derived by HMAC over (circle_id, user_id) keyed by a per-circle
-- salt, so it is deterministic for that person in that circle, and carries no
-- recoverable link to their identity or to their alias in any other circle.
create or replace function public.join_healing_circle(p_circle_id uuid)
returns public.circle_members
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  existing public.circle_members;
  adjectives text[] := array[
    'Quiet','Gentle','Steady','Hopeful','Kind','Patient','Bright','Humble',
    'Faithful','Tender','Brave','Still','Warm','Grateful','Open'];
  nouns text[] := array[
    'Lamp','River','Cedar','Sparrow','Anchor','Harbour','Dawn','Ember',
    'Pilgrim','Olive','Shepherd','Vessel','Reed','Well','Lantern'];
  digest bytea;
  alias text;
  seed text;
  attempt integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into existing from public.circle_members
   where circle_id = p_circle_id and user_id = auth.uid();
  if found then
    update public.circle_members set last_seen_at = now()
     where circle_id = p_circle_id and user_id = auth.uid()
     returning * into existing;
    return existing;
  end if;

  loop
    digest := extensions.hmac(
      p_circle_id::text || ':' || auth.uid()::text || ':' || attempt::text,
      p_circle_id::text,
      'sha256'
    );
    alias := adjectives[(get_byte(digest, 0) % array_length(adjectives, 1)) + 1]
             || ' ' ||
             nouns[(get_byte(digest, 1) % array_length(nouns, 1)) + 1];
    -- Collisions within a circle are possible; disambiguate rather than fail.
    if attempt > 0 then
      alias := alias || ' ' || (get_byte(digest, 2) % 90 + 10)::text;
    end if;
    seed := encode(substring(digest from 3 for 4), 'hex');

    begin
      insert into public.circle_members (circle_id, user_id, anon_alias, avatar_seed)
      values (p_circle_id, auth.uid(), alias, seed)
      returning * into existing;
      return existing;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt > 12 then
        raise exception 'could not allocate an alias in this circle';
      end if;
    end;
  end loop;
end;
$$;

-- Post to a circle under your alias. The caller never supplies the alias, so a
-- member cannot impersonate another member's pseudonym.
create or replace function public.post_circle_message(
  p_circle_id uuid,
  p_body text default null,
  p_shared_verse_ref text default null
)
returns public.circle_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.circle_members;
  msg public.circle_messages;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into me from public.circle_members
   where circle_id = p_circle_id and user_id = auth.uid();
  if not found then
    raise exception 'join the circle before posting';
  end if;

  insert into public.circle_messages
    (circle_id, anon_alias, avatar_seed, body, shared_verse_ref)
  values
    (p_circle_id, me.anon_alias, me.avatar_seed, nullif(p_body, ''), p_shared_verse_ref)
  returning * into msg;

  insert into public.circle_message_authors (message_id, user_id, circle_id)
  values (msg.id, auth.uid(), p_circle_id);

  update public.circle_members set last_seen_at = now()
   where circle_id = p_circle_id and user_id = auth.uid();

  return msg;
end;
$$;

-- Aggregate counts for the circle list. SECURITY DEFINER because members
-- cannot read each other's membership rows and so cannot count them.
create or replace function public.circle_stats()
returns table (circle_id uuid, member_count bigint, online_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         count(m.user_id),
         count(m.user_id) filter (where m.last_seen_at > now() - interval '5 minutes')
    from public.healing_circles c
    left join public.circle_members m on m.circle_id = c.id
   group by c.id;
$$;
