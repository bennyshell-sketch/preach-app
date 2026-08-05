/**
 * Populate a development database with per-user content: accounts, a friendship
 * or two, a study room with notes, journal entries with tasks, and highlights.
 *
 *   npm run seed
 *   npm run seed -- --emails you@example.com,friend@example.com
 *
 * This is deliberately NOT part of supabase/seed.sql. That file is scripture
 * and devotional content and is safe to apply anywhere; this creates auth users
 * and is only ever appropriate against a local or staging project. It refuses
 * to run against anything that does not look local unless --force is passed.
 */
import { config } from 'dotenv';

import { serviceClient } from '../ingest/client';

config();

const DEFAULT_EMAILS = [
  'jordan@preach.test',
  'marcus@preach.test',
  'priya@preach.test',
];

const PASSWORD = 'preach-dev-password';

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const local = /localhost|127\.0\.0\.1|host\.docker\.internal/.test(url);

  if (!local && !process.argv.includes('--force')) {
    throw new Error(
      `${url} does not look like a local Supabase.\n` +
        '  This script creates real auth users and sample content. If you genuinely\n' +
        '  want that on a remote project, re-run with --force.',
    );
  }

  const db = serviceClient();
  const emails = (argValue('--emails') ?? DEFAULT_EMAILS.join(',')).split(',').map((e) => e.trim());

  console.log('▸ accounts');
  const users: { id: string; email: string; name: string }[] = [];

  for (const email of emails) {
    const name = titleCase(email.split('@')[0]);

    const { data, error } = await db.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (error) {
      // Re-running the seed should be harmless.
      if (!/already/i.test(error.message)) throw new Error(`${email}: ${error.message}`);

      const { data: existing } = await db.auth.admin.listUsers();
      const found = existing.users.find((u) => u.email === email);
      if (!found) throw new Error(`${email} exists but could not be read back`);
      users.push({ id: found.id, email, name });
      console.log(`  · ${email} (existing)`);
      continue;
    }

    users.push({ id: data.user!.id, email, name });
    console.log(`  + ${email} / ${PASSWORD}`);
  }

  const [me, marcus, priya] = users;
  if (!me) throw new Error('no users were created');

  console.log('▸ profiles');
  await db
    .from('profiles')
    .update({
      bio: 'Pursuing wisdom, one verse at a time.',
      denomination: 'Non-denominational',
      notes_public: true,
      streak_days: 14,
      last_active_on: new Date().toISOString().slice(0, 10),
    })
    .eq('id', me.id);

  if (marcus) {
    await db
      .from('profiles')
      .update({ bio: 'Studying Romans this month', notes_public: true, streak_days: 21 })
      .eq('id', marcus.id);
  }
  if (priya) {
    await db
      .from('profiles')
      .update({ bio: 'Early church history enthusiast', notes_public: true, streak_days: 14 })
      .eq('id', priya.id);
  }

  // ── Friendships ─────────────────────────────────────────────────────────
  if (marcus) {
    console.log('▸ friendship (accepted) with', marcus.name);
    await db.from('friendships').upsert(
      { requester_id: me.id, recipient_id: marcus.id, status: 'accepted' },
      { onConflict: 'requester_id,recipient_id' },
    );

    const conversation: {
      sender_id: string;
      recipient_id: string;
      body?: string;
      shared_verse_ref?: string;
    }[] = [
      {
        sender_id: marcus.id,
        recipient_id: me.id,
        body: 'Did you see 2 Cor 3:17 today? That freedom verse was everything.',
      },
      {
        sender_id: me.id,
        recipient_id: marcus.id,
        body: "Yes! The Greek word eleutheria — that's freeborn citizen freedom, not just 'no rules'",
      },
      {
        sender_id: marcus.id,
        recipient_id: me.id,
        shared_verse_ref: 'GAL.5.1',
        body: 'This pairs with it perfectly.',
      },
    ];
    for (const message of conversation) {
      await db.from('direct_messages').insert(message);
    }
  }

  // A pending request, so the Requests tab has something real in it.
  if (priya) {
    console.log('▸ friend request (pending) from', priya.name);
    await db.from('friendships').upsert(
      { requester_id: priya.id, recipient_id: me.id, status: 'pending', favourite_ref: 'PRO.27.17' },
      { onConflict: 'requester_id,recipient_id' },
    );
  }

  // ── Study room ──────────────────────────────────────────────────────────
  console.log('▸ study room');
  const { data: room, error: roomError } = await db
    .from('study_rooms')
    .insert({
      name: 'Wednesday Deep Dive',
      description: 'Working through 2 Corinthians together',
      verse_ref: '2CO.3.14',
      verse_ref_end: '2CO.3.18',
      created_by: me.id,
    })
    .select()
    .single();
  if (roomError) throw new Error(roomError.message);

  await db.from('study_room_members').insert(
    [
      { room_id: room.id, user_id: me.id, role: 'owner' as const },
      ...(marcus ? [{ room_id: room.id, user_id: marcus.id, role: 'member' as const }] : []),
      ...(priya ? [{ room_id: room.id, user_id: priya.id, role: 'member' as const }] : []),
    ],
  );

  await db.from('study_room_notes').insert([
    ...(marcus
      ? [{
          room_id: room.id,
          user_id: marcus.id,
          is_shared: true,
          body: 'The veil metaphor connects to Moses in Ex 34:33 — Paul is doing a brilliant intertextual reversal.',
          verse_ref: '2CO.3.14',
        }]
      : []),
    ...(priya
      ? [{
          room_id: room.id,
          user_id: priya.id,
          is_shared: true,
          body: "Paul uses spatial language — 'where' not 'if'. The Spirit's presence is geographical. Grace has coordinates.",
          verse_ref: '2CO.3.17',
        }]
      : []),
    {
      room_id: room.id,
      user_id: me.id,
      is_shared: true,
      body: "So 'turned to the Lord' in v.16 is the moment of unveiling — relational, not ritualistic.",
      verse_ref: '2CO.3.16',
    },
    {
      room_id: room.id,
      user_id: me.id,
      is_shared: false,
      body: 'This resonates deeply — the shift from trying harder to simply turning toward Him. Freedom as access, not achievement.',
      verse_ref: '2CO.3.17',
    },
  ]);

  // ── Highlights ──────────────────────────────────────────────────────────
  console.log('▸ highlights');
  await db.from('highlights').upsert(
    [
      {
        user_id: me.id,
        verse_ref: '2CO.3.17',
        book_id: '2CO',
        chapter: 3,
        color: 'rgba(255,200,50,0.32)',
        note: 'The IS here is so powerful — not metaphor, not comparison. He IS the Spirit.',
      },
      {
        user_id: me.id,
        verse_ref: '2CO.3.18',
        book_id: '2CO',
        chapter: 3,
        color: 'rgba(80,180,255,0.22)',
        note: null,
      },
      {
        user_id: me.id,
        verse_ref: 'PSA.23.4',
        book_id: 'PSA',
        chapter: 23,
        color: 'rgba(80,200,140,0.22)',
        note: 'He switches from talking about God to talking to God right here, in the valley.',
      },
    ],
    { onConflict: 'user_id,verse_ref' },
  );

  // ── Journal ─────────────────────────────────────────────────────────────
  console.log('▸ journal entries');
  const { data: journal } = await db
    .from('journals')
    .select('id')
    .eq('created_by', me.id)
    .eq('kind', 'personal')
    .single();

  if (journal) {
    const { data: entry } = await db
      .from('journal_entries')
      .insert({
        journal_id: journal.id,
        author_id: me.id,
        title: 'Finding peace in the waiting',
        body: 'I have been praying about a situation for three months and still no clear answer. But this morning in Psalm 23, I found something that settled me deeply — the valley is walked through, not around, and not alone.',
        linked_verses: ['PSA.23.4', 'ISA.40.31'],
        study_plan: 'Psalms of Trust (5-day)',
      })
      .select()
      .single();

    if (entry) {
      await db.from('journal_tasks').insert([
        {
          entry_id: entry.id,
          user_id: me.id,
          label: 'Read Psalm 23 every morning this week',
          done: true,
          position: 0,
        },
        {
          entry_id: entry.id,
          user_id: me.id,
          label: 'Memorise Isaiah 40:31 by Friday',
          done: false,
          due_at: new Date(Date.now() + 4 * 86_400_000).toISOString(),
          remind_at: new Date(Date.now() + 86_400_000).toISOString(),
          position: 1,
        },
      ]);
    }

    await db.from('journal_entries').insert({
      journal_id: journal.id,
      author_id: me.id,
      title: 'On forgiveness — wrestling with it',
      body: "Someone I trusted hurt me deeply and I've been sitting with a lot of anger. I asked God this morning what to do with all of this, and kept landing back on the word 'turn'.",
      linked_verses: ['2CO.3.16'],
    });
  }

  console.log('\n✓ development data seeded');
  console.log(`\n  Sign in as any of these (password: ${PASSWORD}):`);
  for (const user of users) console.log(`    ${user.email}`);
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

main().catch((err) => {
  console.error('\n✗', err.message);
  process.exit(1);
});
