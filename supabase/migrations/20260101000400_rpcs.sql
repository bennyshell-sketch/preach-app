-- ═══════════════════════════════════════════════════════════════════════════
-- Preach — 005: query RPCs (chapter reader, semantic search, Today feed)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Chapter reader ─────────────────────────────────────────────────────────
-- One round trip for everything the Read tab paints: verse text in the chosen
-- version, the caller's highlights, whether a verse has commentary, and how
-- many cross-references hang off it. Also the exact payload the offline cache
-- stores per chapter.

create or replace function public.get_chapter(
  p_version text,
  p_book text,
  p_chapter integer
)
returns table (
  verse           integer,
  ref             text,
  text            text,
  highlight_color text,
  highlight_note  text,
  has_commentary  boolean,
  cross_ref_count integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select v.verse,
         v.ref,
         v.text,
         h.color,
         h.note,
         (c.ref is not null) as has_commentary,
         coalesce(x.n, 0)::integer as cross_ref_count
    from public.verses v
    left join public.highlights h
           on h.verse_ref = v.ref and h.user_id = auth.uid()
    left join public.verse_commentary c on c.ref = v.ref
    left join lateral (
      select count(*) as n from public.cross_refs cr where cr.from_ref = v.ref
    ) x on true
   where v.version_code = p_version
     and v.book_id = p_book
     and v.chapter = p_chapter
   order by v.verse;
$$;

-- Interlinear words for a whole chapter, joined to the Strong's lexicon so the
-- word popover has its gloss, transliteration and plain-language note without
-- a second round trip.
create or replace function public.get_chapter_words(
  p_book text,
  p_chapter integer
)
returns table (
  ref             text,
  verse           integer,
  -- quoted: `position` is a col_name keyword and cannot appear bare here
  "position"      integer,
  surface         text,
  transliteration text,
  gloss           text,
  strongs_id      text,
  morphology      text,
  lemma           text,
  language        public.original_language,
  plain_note      text,
  strongs_lemma   text,
  strongs_definition text
)
language sql
stable
security invoker
set search_path = public
as $$
  select w.ref,
         w.verse,
         w.position,
         w.surface,
         coalesce(w.transliteration, s.transliteration),
         w.gloss,
         w.strongs_id,
         w.morphology,
         coalesce(w.lemma, s.lemma),
         w.language,
         coalesce(w.plain_note, s.plain_note),
         s.lemma,
         s.definition
    from public.words w
    left join public.strongs_lemmas s on s.id = w.strongs_id
   where w.book_id = p_book and w.chapter = p_chapter
   order by w.verse, w.position;
$$;

-- Cross-references for a verse, resolved to readable text in the caller's
-- chosen version so the sheet can show the quotation, not just the pointer.
create or replace function public.get_cross_refs(
  p_ref text,
  p_version text default 'KJV'
)
returns table (ref text, display_ref text, text text, votes integer)
language sql
stable
security invoker
set search_path = public
as $$
  select cr.to_ref,
         b.short_name || ' ' || v.chapter || ':' || v.verse
           || case when cr.to_ref_end is null then ''
                   else '–' || split_part(cr.to_ref_end, '.', 3) end,
         v.text,
         cr.votes
    from public.cross_refs cr
    join public.verses v
      on v.ref = cr.to_ref and v.version_code = p_version
    join public.books b on b.id = v.book_id
   where cr.from_ref = p_ref
   order by cr.votes desc, cr.to_ref;
$$;

-- ─── Semantic verse search ──────────────────────────────────────────────────
-- True vector similarity over pgvector — the query string is embedded by the
-- `embed-query` Edge Function and the resulting vector is passed in here. This
-- is not a LIKE/trigram match; a search for "God is close when I am grieving"
-- returns Psalm 34:18 without sharing a single word with it.

create or replace function public.search_verses_semantic(
  query_embedding extensions.vector(1536),
  match_count integer default 20,
  min_similarity double precision default 0.15,
  p_version text default 'KJV'
)
returns table (
  ref         text,
  display_ref text,
  text        text,
  similarity  double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select e.ref,
         b.short_name || ' ' || v.chapter || ':' || v.verse,
         v.text,
         1 - (e.embedding <=> query_embedding) as similarity
    from public.verse_search_embeddings e
    join public.verses v on v.ref = e.ref and v.version_code = p_version
    join public.books b on b.id = v.book_id
   where 1 - (e.embedding <=> query_embedding) >= min_similarity
   order by e.embedding <=> query_embedding
   limit match_count;
$$;

-- ─── Today feed ─────────────────────────────────────────────────────────────
-- Deterministic rotation keyed to the calendar day: every user opening the app
-- on the same day sees the same verse and the same blessing, and it does not
-- change on reload. The prototype's `doy % length` rule, moved server-side.

create or replace function public.get_today(
  p_date date default (now() at time zone 'utc')::date,
  p_version text default 'KJV'
)
returns json
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  doy integer := extract(doy from p_date)::integer;
  verse_total integer;
  blessing_total integer;
  dv public.daily_verses;
  bl public.blessings;
  result json;
begin
  select count(*) into verse_total from public.daily_verses;
  select count(*) into blessing_total from public.blessings;

  if verse_total = 0 or blessing_total = 0 then
    return json_build_object('verse', null, 'blessing', null, 'insights', '[]'::json);
  end if;

  select * into dv from public.daily_verses
   order by seq offset (doy % verse_total) limit 1;

  select * into bl from public.blessings
   order by seq offset (doy % blessing_total) limit 1;

  select json_build_object(
    'verse', json_build_object(
      'ref', dv.ref,
      'display_ref', b.short_name || ' ' || v.chapter || ':' || v.verse,
      'text', v.text,
      'original_text', dv.original_text,
      'transliteration', dv.transliteration,
      'badge', dv.badge,
      'version_code', p_version
    ),
    'blessing', json_build_object(
      'ref', bl.ref, 'text', bl.text, 'note', bl.note
    ),
    'insights', coalesce((
      select json_agg(json_build_object('kind', i.kind, 'body', i.body)
                      order by array_position(
                        array['background','scholar','application']::public.insight_kind[], i.kind))
        from public.verse_insights i where i.ref = dv.ref
    ), '[]'::json)
  )
  into result
  from public.verses v
  join public.books b on b.id = v.book_id
  where v.ref = dv.ref and v.version_code = p_version;

  return coalesce(result, json_build_object('verse', null, 'blessing', null, 'insights', '[]'::json));
end;
$$;

-- ─── Friends ────────────────────────────────────────────────────────────────
-- The friend list with each thread's last message and unread count, which the
-- Friends tab needs in one query.

create or replace function public.get_friends()
returns table (
  friendship_id  uuid,
  friend_id      uuid,
  display_name   text,
  avatar_url     text,
  bio            text,
  streak_days    integer,
  show_online    boolean,
  last_message   text,
  last_message_at timestamptz,
  unread_count   integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with mine as (
    select f.id,
           case when f.requester_id = auth.uid() then f.recipient_id else f.requester_id end as friend_id
      from public.friendships f
     where f.status = 'accepted'
       and (f.requester_id = auth.uid() or f.recipient_id = auth.uid())
  )
  select m.id,
         p.id,
         p.display_name,
         p.avatar_url,
         p.bio,
         p.streak_days,
         p.show_online,
         last_msg.preview,
         last_msg.created_at,
         coalesce(unread.n, 0)::integer
    from mine m
    join public.profiles p on p.id = m.friend_id
    left join lateral (
      select coalesce(
               nullif(dm.body, ''),
               case when dm.voice_note_url is not null then '🎤 Voice note' end,
               case when dm.shared_verse_ref is not null then '📖 Shared a verse' end
             ) as preview,
             dm.created_at
        from public.direct_messages dm
       where dm.conversation_key = least(auth.uid()::text, m.friend_id::text) || ':' ||
                                   greatest(auth.uid()::text, m.friend_id::text)
       order by dm.created_at desc
       limit 1
    ) last_msg on true
    left join lateral (
      select count(*) as n
        from public.direct_messages dm
       where dm.recipient_id = auth.uid()
         and dm.sender_id = m.friend_id
         and dm.read_at is null
    ) unread on true
   order by last_msg.created_at desc nulls last, p.display_name;
$$;

-- Accept a pending request. Kept as an RPC so the client has one call for what
-- is conceptually one action.
create or replace function public.respond_to_friend_request(
  p_friendship_id uuid,
  p_accept boolean
)
returns public.friendships
language plpgsql
security invoker
set search_path = public
as $$
declare
  row public.friendships;
begin
  update public.friendships
     set status = case when p_accept then 'accepted' else 'declined' end::public.friendship_status
   where id = p_friendship_id
     and recipient_id = auth.uid()
     and status = 'pending'
  returning * into row;

  if not found then
    raise exception 'no pending request found for this user';
  end if;

  return row;
end;
$$;

create or replace function public.mark_conversation_read(p_friend_id uuid)
returns integer
language sql
security invoker
set search_path = public
as $$
  with updated as (
    update public.direct_messages
       set read_at = now()
     where recipient_id = auth.uid()
       and sender_id = p_friend_id
       and read_at is null
    returning 1
  )
  select count(*)::integer from updated;
$$;

-- Find people to add. Respects the `discoverable` privacy flag, excludes
-- yourself and anyone you already have a friendship row with.
create or replace function public.search_people(p_query text, p_limit integer default 20)
returns table (
  id uuid, display_name text, handle text, avatar_url text, bio text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select p.id, p.display_name, p.handle, p.avatar_url, p.bio
    from public.profiles p
   where p.discoverable = true
     and p.id <> auth.uid()
     and (p.display_name ilike '%' || p_query || '%'
          or p.handle ilike '%' || p_query || '%')
     and not exists (
       select 1 from public.friendships f
        where (f.requester_id = auth.uid() and f.recipient_id = p.id)
           or (f.requester_id = p.id and f.recipient_id = auth.uid())
     )
   order by extensions.similarity(p.display_name, p_query) desc
   limit p_limit;
$$;

-- ─── Shared journals ────────────────────────────────────────────────────────
-- Get-or-create the shared journal for a friend pair, so the 📔 button in a
-- chat always lands somewhere real.

create or replace function public.get_or_create_shared_journal(p_friend_id uuid)
returns public.journals
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.journals;
  me uuid := auth.uid();
  my_name text;
  their_name text;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if not public.are_friends(me, p_friend_id) then
    raise exception 'shared journals are for accepted friends only';
  end if;

  select jr.* into j
    from public.journals jr
    join public.journal_members m1 on m1.journal_id = jr.id and m1.user_id = me
    join public.journal_members m2 on m2.journal_id = jr.id and m2.user_id = p_friend_id
   where jr.kind = 'shared'
   limit 1;

  if found then
    return j;
  end if;

  select display_name into my_name from public.profiles where id = me;
  select display_name into their_name from public.profiles where id = p_friend_id;

  insert into public.journals (kind, title, created_by)
  values ('shared', my_name || ' & ' || their_name, me)
  returning * into j;

  insert into public.journal_members (journal_id, user_id)
  values (j.id, me), (j.id, p_friend_id);

  return j;
end;
$$;

-- ─── Streaks ────────────────────────────────────────────────────────────────
-- Called once per app foreground. Consecutive-day logic, no client clock trust
-- beyond the date itself.

create or replace function public.touch_streak()
returns public.profiles
language plpgsql
security invoker
set search_path = public
as $$
declare
  p public.profiles;
  today date := (now() at time zone 'utc')::date;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then
    raise exception 'no profile';
  end if;

  if p.last_active_on is null then
    update public.profiles set streak_days = 1, last_active_on = today
     where id = p.id returning * into p;
  elsif p.last_active_on = today then
    return p;
  elsif p.last_active_on = today - 1 then
    update public.profiles set streak_days = p.streak_days + 1, last_active_on = today
     where id = p.id returning * into p;
  else
    update public.profiles set streak_days = 1, last_active_on = today
     where id = p.id returning * into p;
  end if;

  return p;
end;
$$;

-- ─── Aggregate counts for the Me tab header ────────────────────────────────

create or replace function public.get_my_stats()
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'streak', coalesce((select streak_days from public.profiles where id = auth.uid()), 0),
    'highlights', (select count(*) from public.highlights where user_id = auth.uid()),
    'journal', (select count(*) from public.journal_entries where author_id = auth.uid()),
    'rooms', (select count(*) from public.study_room_members where user_id = auth.uid()),
    'notes', (select count(*) from public.study_room_notes where user_id = auth.uid())
  );
$$;
