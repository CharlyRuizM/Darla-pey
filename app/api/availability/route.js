import { hoyMx, slotsDelDia, SLOT_INTERVAL_MINUTES } from '../../../lib/agenda.mjs';

export async function GET(request) {
  const date = new URL(request.url).searchParams.get('date') || '';
  const day = new Date(date + 'T12:00:00Z');
  const now = new Date();
  const today = hoyMx(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+day)
      || day.toISOString().slice(0, 10) !== date || day < today
      || day - today >= 30 * 86400000) {
    return Response.json({ error: 'invalid_date' }, { status: 400 });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'unavailable' }, { status: 503 });
  }

  // The booking horizon uses the current UTC-06:00 offset in Mexico City.
  const start = new Date(date + 'T00:00:00-06:00');
  const end = new Date(+start + 86400000);
  try {
    const url = new URL('/rest/v1/appointments', SUPABASE_URL);
    url.searchParams.set('select', 'starts_at');
    url.searchParams.append('starts_at', 'gt.' + new Date(+start - SLOT_INTERVAL_MINUTES * 60000).toISOString());
    url.searchParams.append('starts_at', 'lt.' + end.toISOString());
    url.searchParams.set('or', '(status.eq.confirmed,and(status.eq.pending_payment,hold_until.gt.' + now.toISOString() + '))');
    const response = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('availability_failed');
    const occupied = (await response.json()).map((row) => Date.parse(row.starts_at));
    const slots = slotsDelDia(day).map(({ inicio, fin }) => ({
      id: date + 'T' + inicio + ':00-06:00', title: inicio + '–' + fin,
    })).filter(({ id }) => {
      const time = Date.parse(id);
      return time > +now + 21600000 && !occupied.some((other) => Math.abs(other - time) < SLOT_INTERVAL_MINUTES * 60000);
    });
    return Response.json({ date, slots }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503 });
  }
}
