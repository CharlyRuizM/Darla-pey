import { historyEntry } from '../../../../lib/panel-history.mjs';

const statuses = new Set(['all', 'confirmed', 'pending', 'closed', 'proposals']);
const entryKey = /^(appointment|invitation):[0-9a-f-]{36}$/;

export async function GET(request) {
  const respond = (body, status = 200) => Response.json(body, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'all';
  if (!statuses.has(status)) return respond({ error: 'invalid_status' }, 400);
  let beforeAt = null;
  let beforeKey = null;
  const cursor = searchParams.get('cursor');
  if (cursor) {
    try {
      if (!/^[A-Za-z0-9_-]{1,256}$/.test(cursor)) throw new Error();
      const [filter, at, key] = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      if (filter !== status || !Number.isFinite(Date.parse(at)) || !entryKey.test(key)) throw new Error();
      beforeAt = at;
      beforeKey = key;
    } catch { return respond({ error: 'invalid_cursor' }, 400); }
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!SUPABASE_URL || !key) return respond({ error: 'history_unavailable' }, 503);
  try {
    const response = await fetch(new URL('/rest/v1/rpc/panel_history', SUPABASE_URL), {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ history_filter: status, before_at: beforeAt, before_key: beforeKey }),
      cache: 'no-store', signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error();
    const { entries, has_invitations } = await response.json();
    const page = entries.slice(0, 30);
    const last = page.at(-1);
    const nextCursor = entries.length > 30
      ? Buffer.from(JSON.stringify([status, last.sort_at, last.entry_key])).toString('base64url')
      : null;
    return respond({ entries: page.map(historyEntry), nextCursor, hasInvitations: has_invitations });
  } catch { return respond({ error: 'history_unavailable' }, 503); }
}
