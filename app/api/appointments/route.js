import { timingSafeEqual } from 'node:crypto';

export async function POST(request) {
  const { APPOINTMENTS_API_TOKEN, PEY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!APPOINTMENTS_API_TOKEN || !PEY_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'not_configured' }, { status: 503 });
  }

  const expected = Buffer.from(`Bearer ${APPOINTMENTS_API_TOKEN}`);
  const provided = Buffer.from(request.headers.get('Authorization') || '');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const input = await request.json().catch(() => null);
  const { id, startsAt, phoneNumber, depositCents, paymentMethod = "push" } = input || {};
  if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)
    || typeof startsAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(startsAt)
    || !Number.isFinite(Date.parse(startsAt))
    || !['push', 'link'].includes(paymentMethod)
    || (paymentMethod === 'push' && (typeof phoneNumber !== 'string' || !/^\d{10}$/.test(phoneNumber)))
    || !Number.isInteger(depositCents) || depositCents < 1 || depositCents > 100000000) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }

  const database = (path, method, body) => fetch(new URL(path, SUPABASE_URL), {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  let transactionId;
  const useLink = paymentMethod === "link";
  try {
    const reservation = await database('/rest/v1/rpc/reserve_dental_appointment', 'POST', {
      reservation_id: id, slot_start: new Date(startsAt).toISOString(), amount_cents: depositCents,
    });
    if (!reservation.ok) throw new Error('reservation_failed');
    if (!await reservation.json()) {
      return Response.json({ error: 'slot_unavailable_or_request_already_used' }, { status: 409 });
    }

    const charge = await fetch(useLink ? 'https://api.pey.mx/payment-link/create' : 'https://api.pey.mx/codi/pn', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PEY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(useLink ? {
        amount: depositCents / 100,
        hasTip: false,
        clientReferenceId: id,
        successUrl: 'https://pey-hackathon.ingecarlosrm.workers.dev/pago',
        backUrl: 'https://pey-hackathon.ingecarlosrm.workers.dev/pago',
      } : {
        phoneNumber, amount: depositCents / 100, concept: 'Valoracion dental', expiration: 21600,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!charge.ok) throw new Error('charge_failed');
    const payment = await charge.json();
    transactionId = useLink ? payment.id : payment.transactionId;
    const paymentUrl = useLink ? new URL(payment.url) : null;
    if (paymentUrl && paymentUrl.origin !== 'https://app.mipey.mx') throw new Error('invalid_checkout');
    if (typeof transactionId !== 'string' || !transactionId) throw new Error('missing_transaction');

    const linked = await database(`/rest/v1/appointments?id=eq.${id}&pey_transaction_id=is.null`, 'PATCH', {
      pey_transaction_id: useLink ? `link:${transactionId}` : transactionId,
    });
    if (!linked.ok || (await linked.json()).length !== 1) throw new Error('link_failed');
    return Response.json(useLink
      ? { id, paymentLinkId: transactionId, paymentUrl: paymentUrl.href }
      : { id, transactionId }, { status: 201 });
  } catch {
    // Leave the hold in place when the charge outcome is uncertain.
    return Response.json({ error: 'check_reservation_before_retry', id, transactionId }, { status: 503 });
  }
}
