const dayMs = 86400000;
const zone = new Intl.DateTimeFormat('en', {
  timeZone: 'America/Mexico_City', timeZoneName: 'longOffset',
});

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value ? date : null;
}

function mexicoMidnight(day) {
  const date = day.toISOString().slice(0, 10);
  const offset = zone.formatToParts(new Date(+day + 12 * 3600000))
    .find(({ type }) => type === 'timeZoneName').value.slice(3);
  return new Date(date + 'T00:00:00' + (offset || 'Z')).toISOString();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const from = parseDate(searchParams.get('from'));
  const to = parseDate(searchParams.get('to'));
  const respond = (body, status) => Response.json(body, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
  if (!from || !to || to < from || to - from >= 14 * dayMs) {
    return respond({ error: 'invalid_range' }, 400);
  }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return respond({ error: 'unavailable' }, 503);
  try {
    const url = new URL('/rest/v1/appointments', SUPABASE_URL);
    url.searchParams.set('select', 'id,starts_at,hold_until,status,deposit_cents,confirmed_at,whatsapp_phone');
    url.searchParams.append('starts_at', 'gte.' + mexicoMidnight(from));
    url.searchParams.append('starts_at', 'lt.' + mexicoMidnight(new Date(+to + dayMs)));
    url.searchParams.set('order', 'starts_at.asc,id.asc');
    const appointments = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('limit', String(pageSize));
      const response = await fetch(url, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        cache: 'no-store', signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return respond({ error: 'unavailable' }, 503);
      const rows = await response.json();
      for (const { id, starts_at, hold_until, status, deposit_cents, confirmed_at, whatsapp_phone } of rows) {
        const last4 = typeof whatsapp_phone === 'string' ? whatsapp_phone.match(/\d{4}$/)?.[0] : null;
        appointments.push({
          id, starts_at, hold_until, status, deposit_cents, confirmed_at,
          whatsapp_phone: last4 ? `•••• ${last4}` : null,
          patient_name: last4 ? `Paciente ••${last4}` : 'Paciente',
        });
      }
      if (rows.length < pageSize) break;
    }
    const proposals = new URL('/rest/v1/panel_invitations', SUPABASE_URL);
    proposals.searchParams.set('select', 'id,phone,slot_start,deposit_cents');
    proposals.searchParams.set('status', 'eq.sent');
    proposals.searchParams.set('claimed_at', 'is.null');
    proposals.searchParams.append('slot_start', 'gte.' + mexicoMidnight(from));
    proposals.searchParams.append('slot_start', 'lt.' + mexicoMidnight(new Date(+to + dayMs)));
    proposals.searchParams.append('slot_start', 'gt.' + new Date(Date.now() + 21600000).toISOString());
    const offered = await fetch(proposals, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!offered.ok) return respond({ error: 'unavailable' }, 503);
    for (const { id, phone, slot_start, deposit_cents } of await offered.json()) {
      const last4 = phone.slice(-4);
      appointments.push({
        id, starts_at: slot_start, deposit_cents, status: 'invited',
        whatsapp_phone: `•••• ${last4}`, patient_name: `Paciente ••${last4}`,
      });
    }
    return respond({ appointments }, 200);
  } catch {
    return respond({ error: 'unavailable' }, 503);
  }
}
