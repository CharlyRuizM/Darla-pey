import { verifyPeyWebhook } from '../../../../lib/pey-webhook.mjs';

export async function POST(request) {
  const secret = process.env.PEY_WEBHOOK_SECRET;
  if (!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret || '')) {
    return new Response(null, { status: 503 });
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (!verifyPeyWebhook(request.headers, body, secret)) {
    return new Response(null, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(body.toString('utf8'));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!payload || typeof payload.type !== 'string') {
    return new Response(null, { status: 400 });
  }

  const databaseUrl = process.env.SUPABASE_URL;
  const databaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!databaseUrl || !databaseKey) {
    return new Response(null, { status: 503 });
  }

  try {
    const stored = await fetch(
      new URL('/rest/v1/pey_webhook_events?on_conflict=webhook_id', databaseUrl),
      {
        method: 'POST',
        headers: {
          apikey: databaseKey,
          Authorization: `Bearer ${databaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates,return=minimal',
        },
        body: JSON.stringify({ webhook_id: request.headers.get('webhook-id'), payload }),
      },
    );
    return new Response(null, { status: stored.ok ? 204 : 503 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
