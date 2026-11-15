import { timingSafeEqual } from 'node:crypto';
import { bookingNotice } from '../../../../lib/booking-notices.mjs';

export async function POST(request) {
  const { BOOKING_JOBS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KAPSO_PEY_API_KEY } = process.env;
  if (![BOOKING_JOBS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KAPSO_PEY_API_KEY].every(Boolean)) {
    return new Response(null, { status: 503 });
  }
  const actual = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${BOOKING_JOBS_TOKEN}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return new Response(null, { status: 401 });
  }
  const appointmentId = new URL(request.url).searchParams.get('appointment');
  if (appointmentId !== null && !/^[0-9a-f-]{36}$/i.test(appointmentId)) {
    return new Response(null, { status: 400 });
  }
  const db = (path, method, body) => fetch(new URL('/rest/v1/' + path, SUPABASE_URL), {
    method, body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation' },
  });
  try {
    if (!appointmentId) {
      const expired = await db('rpc/expire_booking_holds', 'POST', {});
      if (!expired.ok) throw new Error('expiration_failed');
    }
    const scope = appointmentId ? `&appointment_id=eq.${appointmentId}&kind=in.(pending_payment,confirmed)` : '';
    const rows = await db('booking_notices?claimed_at=is.null&select=appointment_id,kind,appointments(status,starts_at,deposit_cents,whatsapp_phone)&order=created_at.asc&limit=10' + scope, 'GET');
    if (!rows.ok) throw new Error('notice_list_failed');
    let failures = 0;
    for (const { appointment_id, kind, appointments: appointment } of await rows.json()) {
      const claim = await db(`booking_notices?appointment_id=eq.${appointment_id}&kind=eq.${kind}&claimed_at=is.null`,
        'PATCH', { claimed_at: new Date().toISOString() });
      if (!claim.ok) { failures++; continue; }
      if (!(await claim.json()).length || appointment?.status !== kind) continue;
      const body = bookingNotice(kind, appointment);
      const message = kind === 'expired'
        ? { type: 'interactive', interactive: { type: 'button', body: { text: body },
          action: { buttons: [{ type: 'reply', reply: { id: 'pey-rebook', title: 'Ver horarios' } }] } } }
        : kind === 'confirmed'
          ? { type: 'interactive', interactive: { type: 'button', body: { text: body },
            action: { buttons: [{ type: 'reply', reply: { id: 'pey-move:' + appointment_id, title: 'Reagendar' } }] } } }
          : { type: 'text', text: { body } };
      try {
        const sent = await fetch('https://api.kapso.ai/meta/whatsapp/v23.0/1142240392297039/messages', {
          method: 'POST', signal: AbortSignal.timeout(5000),
          headers: { 'X-API-Key': KAPSO_PEY_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: appointment.whatsapp_phone, ...message }),
        });
        if (!sent.ok) failures++;
      } catch { failures++; }
    }
    return Response.json({ failures }, { status: failures ? 502 : 200 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
