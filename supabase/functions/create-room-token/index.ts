/**
 * Mint a Daily.co meeting token for a study room.
 *
 * Two things this exists to prevent:
 *   1. The Daily API key reaching a device, where it could be extracted and
 *      used to create rooms against the account.
 *   2. A signed-in user joining a call for a room they are not a member of.
 *      Membership is re-checked here against Postgres; the client's claim that
 *      it is a member is not evidence.
 *
 * Deploy:  supabase functions deploy create-room-token
 * Secrets: supabase secrets set DAILY_API_KEY=…
 */
import { json, preflight, requireUser } from '../_shared/cors.ts';

const DAILY_API = 'https://api.daily.co/v1';
const TOKEN_TTL_SECONDS = 60 * 60 * 2;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const user = await requireUser(req);
  if (!user) return json({ error: 'not authenticated' }, 401);

  const dailyKey = Deno.env.get('DAILY_API_KEY');
  if (!dailyKey) {
    return json(
      {
        error:
          'Live calls are not configured — set the DAILY_API_KEY function secret and ' +
          'EXPO_PUBLIC_DAILY_DOMAIN in the app environment.',
      },
      503,
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  let roomId: string;
  try {
    const body = (await req.json()) as { room_id?: string };
    if (!body.room_id) return json({ error: 'room_id is required' }, 400);
    roomId = body.room_id;
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  // ── Authorisation: is this user actually in this room? ────────────────────
  // Queried with the caller's own JWT, so RLS decides — the function does not
  // get to be more permissive than the database is.
  const membershipRes = await fetch(
    `${supabaseUrl}/rest/v1/study_room_members?room_id=eq.${roomId}&user_id=eq.${user.id}&select=user_id`,
    {
      headers: {
        Authorization: `Bearer ${user.token}`,
        apikey: anonKey,
      },
    },
  );

  const membership = (await membershipRes.json()) as unknown[];
  if (!Array.isArray(membership) || membership.length === 0) {
    return json({ error: 'join the room before starting a call' }, 403);
  }

  // ── Room: read what we have, create it on first use ───────────────────────
  const roomRes = await fetch(
    `${supabaseUrl}/rest/v1/study_rooms?id=eq.${roomId}&select=id,name,daily_room`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
  );
  const rooms = (await roomRes.json()) as { id: string; name: string; daily_room: string | null }[];
  const room = rooms[0];
  if (!room) return json({ error: 'no such room' }, 404);

  let dailyRoomName = room.daily_room;

  if (!dailyRoomName) {
    // Deterministic, unguessable, and stable for this study room.
    dailyRoomName = `preach-${roomId.replace(/-/g, '').slice(0, 24)}`;

    const createRes = await fetch(`${DAILY_API}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dailyKey}`,
      },
      body: JSON.stringify({
        name: dailyRoomName,
        privacy: 'private',
        properties: {
          enable_chat: false, // the room already has notes; two chats is one too many
          enable_screenshare: true,
          start_video_off: true,
          start_audio_off: false,
          // Rooms are cheap; leaving them forever is not. Expire in 24h — a new
          // one is minted on the next call.
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
          eject_at_room_exp: true,
        },
      }),
    });

    if (!createRes.ok) {
      // 409 means it already exists from an earlier call, which is fine.
      if (createRes.status !== 409) {
        const detail = await createRes.text();
        console.error('[create-room-token] room creation failed', detail);
        return json({ error: 'could not create the call room' }, 502);
      }
    }

    await fetch(`${supabaseUrl}/rest/v1/study_rooms?id=eq.${roomId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        daily_room: dailyRoomName,
        call_started_at: new Date().toISOString(),
      }),
    });
  } else {
    await fetch(`${supabaseUrl}/rest/v1/study_rooms?id=eq.${roomId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ call_started_at: new Date().toISOString() }),
    });
  }

  // ── Token: scoped to this room, short-lived ───────────────────────────────
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=display_name`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
  );
  const profiles = (await profileRes.json()) as { display_name: string }[];

  const tokenRes = await fetch(`${DAILY_API}/meeting-tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${dailyKey}`,
    },
    body: JSON.stringify({
      properties: {
        room_name: dailyRoomName,
        user_name: profiles[0]?.display_name ?? 'Member',
        user_id: user.id,
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
        enable_screenshare: true,
      },
    }),
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    console.error('[create-room-token] token mint failed', detail);
    return json({ error: 'could not create a meeting token' }, 502);
  }

  const { token } = (await tokenRes.json()) as { token: string };
  const domain = Deno.env.get('DAILY_DOMAIN') ?? Deno.env.get('EXPO_PUBLIC_DAILY_DOMAIN');

  return json({
    url: `https://${domain}/${dailyRoomName}`,
    token,
    room_name: dailyRoomName,
  });
});
