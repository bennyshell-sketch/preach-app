/**
 * Deliver a push notification through the Expo push service.
 *
 * Called by Postgres triggers (public.dispatch_push) on new direct messages,
 * friend requests, and study-room activity. Authenticated with the service-role
 * key, because the trigger is the caller, not a user.
 *
 * Deploy: supabase functions deploy send-push --no-verify-jwt
 *
 * `--no-verify-jwt` is required: pg_net presents the service-role key as a
 * bearer token, which the gateway's user-JWT check would reject. The function
 * verifies that key itself, below.
 */
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

interface PushPayload {
  kind: string;
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  // Only the service role may fan out notifications; anything else could spam
  // any user in the project.
  const auth = req.headers.get('Authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: PushPayload;
  try {
    payload = (await req.json()) as PushPayload;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${payload.user_id}&select=expo_push_token`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
  );
  const profiles = (await profileRes.json()) as { expo_push_token: string | null }[];
  const token = profiles[0]?.expo_push_token;

  // No token is the normal case for someone who declined notifications or has
  // only ever used a simulator. Not an error.
  if (!token) {
    return new Response(JSON.stringify({ skipped: 'no push token' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(EXPO_PUSH_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify({
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      channelId: 'default',
      priority: 'high',
    }),
  });

  const result = (await res.json()) as {
    data?: { status: string; details?: { error?: string } };
  };

  // A device that has been wiped or had the app removed reports
  // DeviceNotRegistered. Clear the token so we stop trying forever.
  if (result.data?.details?.error === 'DeviceNotRegistered') {
    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${payload.user_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ expo_push_token: null }),
    });
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
