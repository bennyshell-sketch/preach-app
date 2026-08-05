-- ═══════════════════════════════════════════════════════════════════════════
-- RLS behaviour tests.
--
-- These assert the security properties the app depends on, by acting as real
-- authenticated users rather than by reading the policy text. Each block raises
-- on failure, so a non-zero psql exit means a policy regressed.
--
-- Run via supabase/tests/validate.sh --with-tests
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

create or replace function assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if cond is not true then
    raise exception 'ASSERTION FAILED: %', msg;
  end if;
end;
$$;

-- Impersonate an authenticated user the way PostgREST does.
create or replace function act_as(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

-- From here on, behave exactly as PostgREST does for a signed-in request:
-- connect as the authenticator and assume the `authenticated` role, so the
-- policies under test are the ones that actually run in production.
set role authenticated;

-- ─── Fixtures ───────────────────────────────────────────────────────────────

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'carol@test.dev');

\set alice '11111111-1111-1111-1111-111111111111'
\set bob   '22222222-2222-2222-2222-222222222222'
\set carol '33333333-3333-3333-3333-333333333333'

do $$ begin
  perform assert(
    (select count(*) from public.profiles) = 3,
    'signup trigger should create one profile per auth user');

  -- Journals are member-scoped, so this is asserted from inside a session:
  -- Alice sees exactly her own personal journal and nobody else's.
  perform act_as('11111111-1111-1111-1111-111111111111');
  perform assert(
    (select count(*) from public.journals where kind = 'personal') = 1,
    'a user sees exactly their own personal journal, not other users''');
  perform assert(
    (select created_by from public.journals where kind = 'personal')
      = '11111111-1111-1111-1111-111111111111',
    'the visible personal journal belongs to the acting user');
end; $$;

-- ═══ 1. Private study-room notes are invisible to co-members ═══════════════

do $$
declare rid uuid;
begin
  perform act_as('11111111-1111-1111-1111-111111111111');
  rid := (public.create_study_room('Wednesday Deep Dive', null, '2CO.3.14', '2CO.3.18')).id;

  -- Owner invites Bob. Carol, a non-owner, must not be able to.
  perform public.invite_to_room(rid, '22222222-2222-2222-2222-222222222222');

  perform act_as('33333333-3333-3333-3333-333333333333');
  begin
    perform public.invite_to_room(rid, '33333333-3333-3333-3333-333333333333');
    perform assert(false, 'a non-member must not be able to invite themselves in');
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
  end;
  perform act_as('11111111-1111-1111-1111-111111111111');

  insert into public.study_room_notes (room_id, user_id, is_shared, body)
  values (rid, '11111111-1111-1111-1111-111111111111', true,  'Shared: the veil metaphor'),
         (rid, '11111111-1111-1111-1111-111111111111', false, 'Private: I felt convicted');

  perform assert((select count(*) from public.study_room_notes) = 2,
    'author sees both their own shared and private notes');

  -- Bob is a member of the same room.
  perform act_as('22222222-2222-2222-2222-222222222222');
  perform assert((select count(*) from public.study_room_notes) = 1,
    'a co-member must see the shared note and NOT the private one');
  perform assert(
    (select is_shared from public.study_room_notes) = true,
    'the single visible note must be the shared one');

  -- Carol is in no room at all.
  perform act_as('33333333-3333-3333-3333-333333333333');
  perform assert((select count(*) from public.study_room_notes) = 0,
    'a non-member must see no notes from a room they are not in');
end; $$;

-- ═══ 2. Healing-circle anonymity ═══════════════════════════════════════════

do $$
declare
  cid uuid;
  alice_alias text;
  bob_alias text;
  second_circle uuid;
  alice_alias_elsewhere text;
begin
  -- Circles are curated: seeded by the service role, joined by users. There is
  -- deliberately no INSERT policy, so the fixtures come from validate.sh.
  select id into cid from public.healing_circles where topic = 'Grief & Loss';
  select id into second_circle from public.healing_circles where topic = 'Anxiety & Fear';
  perform assert(cid is not null and second_circle is not null, 'circle fixtures present');

  perform act_as('11111111-1111-1111-1111-111111111111');
  alice_alias := (public.join_healing_circle(cid)).anon_alias;
  perform public.post_circle_message(cid, 'I lost my mom six months ago.');

  perform act_as('22222222-2222-2222-2222-222222222222');
  bob_alias := (public.join_healing_circle(cid)).anon_alias;

  -- Bob can read the message...
  perform assert((select count(*) from public.circle_messages where circle_id = cid) = 1,
    'a circle member can read circle messages');

  -- ...but cannot resolve who wrote it.
  perform assert((select count(*) from public.circle_message_authors) = 0,
    'authorship rows must be invisible to everyone but the author');
  perform assert((select count(*) from public.circle_members where user_id <> auth.uid()) = 0,
    'a member must not be able to read another member''s alias mapping');

  -- The alias is stable within a circle...
  perform act_as('11111111-1111-1111-1111-111111111111');
  perform assert((public.join_healing_circle(cid)).anon_alias = alice_alias,
    'rejoining the same circle returns the same alias');
  perform assert((select count(*) from public.circle_message_authors) = 1,
    'an author can still see their own authorship row');

  -- ...and unlinkable across circles.
  alice_alias_elsewhere := (public.join_healing_circle(second_circle)).anon_alias;
  perform assert(alice_alias_elsewhere is distinct from alice_alias,
    'the same person must not carry one alias between circles');

  -- Posting without joining is refused.
  perform act_as('33333333-3333-3333-3333-333333333333');
  begin
    perform public.post_circle_message(cid, 'sneaking in');
    perform assert(false, 'posting to a circle you have not joined must fail');
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
  end;
end; $$;

-- ═══ 3. Direct messages are friends-only and thread-scoped ═════════════════

do $$
declare fid uuid;
begin
  perform act_as('11111111-1111-1111-1111-111111111111');
  insert into public.friendships (requester_id, recipient_id)
  values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
  returning id into fid;

  -- Not friends yet: the message must be rejected.
  begin
    insert into public.direct_messages (sender_id, recipient_id, body)
    values ('11111111-1111-1111-1111-111111111111',
            '22222222-2222-2222-2222-222222222222', 'hi');
    perform assert(false, 'messaging before acceptance must be blocked');
  exception when insufficient_privilege then null;
  end;

  -- The requester must not be able to accept their own request.
  begin
    perform public.respond_to_friend_request(fid, true);
    perform assert(false, 'requester must not accept their own request');
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
  end;

  -- The recipient accepts.
  perform act_as('22222222-2222-2222-2222-222222222222');
  perform public.respond_to_friend_request(fid, true);
  perform assert(public.are_friends(
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222'),
    'acceptance should make the pair friends in both directions');

  -- Now messaging works.
  perform act_as('11111111-1111-1111-1111-111111111111');
  insert into public.direct_messages (sender_id, recipient_id, body)
  values ('11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222', 'That freedom verse hit different');

  perform assert((select count(*) from public.direct_messages) = 1,
    'sender sees their own message');

  -- Carol is a third party and must see nothing.
  perform act_as('33333333-3333-3333-3333-333333333333');
  perform assert((select count(*) from public.direct_messages) = 0,
    'a third party must not read someone else''s conversation');
end; $$;

-- ═══ 4. Highlights and journals are private to their owner ════════════════

do $$
declare shared_j uuid;
begin
  perform act_as('11111111-1111-1111-1111-111111111111');
  insert into public.highlights (user_id, verse_ref, book_id, chapter, color, note)
  values ('11111111-1111-1111-1111-111111111111', '2CO.3.17', '2CO', 3,
          'rgba(255,200,50,0.32)', 'The IS here is so powerful');

  perform act_as('22222222-2222-2222-2222-222222222222');
  perform assert((select count(*) from public.highlights) = 0,
    'highlights must be private to their owner');

  -- A shared journal is readable and writable by BOTH friends.
  perform act_as('11111111-1111-1111-1111-111111111111');
  shared_j := (public.get_or_create_shared_journal('22222222-2222-2222-2222-222222222222')).id;
  insert into public.journal_entries (journal_id, author_id, title, body, linked_verses)
  values (shared_j, '11111111-1111-1111-1111-111111111111', 'Our study',
          'Starting 2 Corinthians together', array['2CO.3.17']);

  perform act_as('22222222-2222-2222-2222-222222222222');
  perform assert(
    (select count(*) from public.journal_entries where journal_id = shared_j) = 1,
    'the co-author must see entries in a shared journal');

  -- ...and can edit the other person's entry, which is the point of co-authoring.
  update public.journal_entries set body = body || ' — adding my notes'
   where journal_id = shared_j;
  perform assert((select body from public.journal_entries where journal_id = shared_j)
                 like '%adding my notes%',
    'a co-author must be able to edit shared entries');

  -- Carol sees nothing of it.
  perform act_as('33333333-3333-3333-3333-333333333333');
  perform assert((select count(*) from public.journal_entries) = 0,
    'a non-member must not read a shared journal');
end; $$;

-- ═══ 5. Idempotent-safe cleanup ════════════════════════════════════════════

do $$ begin
  raise notice 'All RLS assertions passed.';
end; $$;
