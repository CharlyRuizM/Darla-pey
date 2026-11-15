import { createAppointment } from '../../../lib/create-appointment.mjs';
import { timingSafeEqual } from 'node:crypto';
import { readBookingFlowToken } from '../../../lib/whatsapp-flow-token.mjs';

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

  const flowSession = readBookingFlowToken(input?.flowToken, APPOINTMENTS_API_TOKEN);
  const whatsappPhone = flowSession?.reservationId === id ? '52' + flowSession.phone : null;
  return createAppointment({ id, startsAt, depositCents, phoneNumber, paymentMethod, whatsappPhone });
}
