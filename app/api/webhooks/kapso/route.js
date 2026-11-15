import { mexicanWhatsApp } from '../../../../lib/whatsapp-number.mjs';
import { handleReschedule, rescheduleAction } from '../../../../lib/paid-reschedule.mjs';
import { GET as availability } from '../../availability/route.js';
import { invitationDb, replyToInvitation, uuidPattern } from '../../../../lib/panel-invitations.mjs';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createBookingFlowToken, readBookingFlowToken } from '../../../../lib/whatsapp-flow-token.mjs';

import { POST as dispatchNotices } from '../../jobs/booking-notices/route.js';

const numberId = '1142240392297039';

export async function POST(request) {
  const { KAPSO_BOOKING_WEBHOOK_SECRET, KAPSO_PEY_API_KEY, APPOINTMENTS_API_TOKEN,
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (![KAPSO_BOOKING_WEBHOOK_SECRET, KAPSO_PEY_API_KEY, APPOINTMENTS_API_TOKEN,
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY].every(Boolean)) return new Response(null, { status: 503 });

  const raw = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get('x-webhook-signature') || '';
  const expected = createHmac('sha256', KAPSO_BOOKING_WEBHOOK_SECRET).update(raw).digest();
  if (!/^[0-9a-f]{64}$/i.test(signature) || !timingSafeEqual(expected, Buffer.from(signature, 'hex'))) {
    return new Response(null, { status: 401 });
  }

  let body;
  try { body = JSON.parse(raw.toString('utf8')); } catch { return new Response(null, { status: 400 }); }
  const message = body?.message;
  if (request.headers.get('x-webhook-event') !== 'whatsapp.message.received'
    || body?.phone_number_id !== numberId || typeof message?.id !== 'string'
    || !/^([1-9][0-9]{6,14})$/.test(message.from || '')) {
    return new Response(null, { status: 204 });
  }
  const inbound = Number(message.timestamp) * 1000;
  if (mexicanWhatsApp(message.from) && Number.isFinite(inbound) && inbound > 0 && inbound <= Date.now()) {
    await invitationDb('rpc/record_panel_whatsapp_contact', 'POST', {
      contact_phone: message.from.slice(-10), contact_recipient: message.from,
      inbound_at: new Date(inbound).toISOString(),
    }).catch(() => undefined);
  }
  const buttonId = message.interactive?.button_reply?.id || message.button?.payload || message.interactive?.list_reply?.id;
  const reschedule = rescheduleAction(buttonId);
  const invitationReply = typeof buttonId === 'string' && /^inv-(accept|other|reject|bank|link):(.+)$/.exec(buttonId);
  const validInvitation = invitationReply && uuidPattern.test(invitationReply[2]);
  const text = message?.text?.body?.trim().toLowerCase().replace(/[.!]+$/, '');
  const bookingRequest = (message?.type === 'text' && text === 'quiero agendar una valoración dental')
    || (message?.type === 'interactive' && message.interactive?.button_reply?.id === 'pey-rebook');
  let completedBooking;
  if (message?.type === 'interactive' && message.interactive?.type === 'nfm_reply') {
    try {
      const reply = JSON.parse(message.interactive.nfm_reply.response_json);
      const session = readBookingFlowToken(reply.flow_token, APPOINTMENTS_API_TOKEN);
      if (session?.phone === message.from?.slice(-10)) completedBooking = session?.reservationId;
    } catch {
      // Ignore responses unrelated to this booking Flow.
    }
  }
  if ((!bookingRequest || !mexicanWhatsApp(message.from)) && !completedBooking && !validInvitation && !reschedule) return new Response(null, { status: 204 });

  try {
    const claim = await fetch(new URL('/rest/v1/kapso_booking_invites?on_conflict=message_id', SUPABASE_URL), {
      method: 'POST',
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ message_id: message.id }),
      signal: AbortSignal.timeout(5000),
    });
    if (!claim.ok) return new Response(null, { status: 503 });
    if (!(await claim.json()).length) return new Response(null, { status: 204 });

    try {
      const receipt = await fetch(`https://api.kapso.ai/meta/whatsapp/v24.0/${numberId}/messages`, {
        method: 'POST',
        headers: { 'X-API-Key': KAPSO_PEY_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: message.id,
          typing_indicator: { type: 'text' },
        }),
        signal: AbortSignal.timeout(1500),
      });
      if (receipt.ok) await new Promise((resolve) => setTimeout(resolve, 600));
    } catch {
      // The invitation should still go out when the read receipt fails.
    }

    if (reschedule) {
      await handleReschedule(reschedule, message.from, availability);
      return new Response(null, { status: 204 });
    }

    if (validInvitation) {
      await replyToInvitation(invitationReply[2], invitationReply[1], message.from);
      return new Response(null, { status: 204 });
    }

    if (completedBooking) {
      const jobsToken = process.env.BOOKING_JOBS_TOKEN;
      if (jobsToken) {
        const job = new URL('/api/jobs/booking-notices', request.url);
        job.searchParams.set('appointment', completedBooking);
        await dispatchNotices(new Request(job, {
          method: 'POST',
          headers: { authorization: `Bearer ${jobsToken}` },
        }));
      }
      return new Response(null, { status: 204 });
    }

    const sent = await fetch(`https://api.kapso.ai/meta/whatsapp/v23.0/${numberId}/messages`, {
      method: 'POST',
      headers: { 'X-API-Key': KAPSO_PEY_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: message.from, type: 'interactive',
        interactive: {
          type: 'flow', body: { text: '¡Hola! 😊 Qué gusto saludarte. 🦷 Elige el día y la hora que mejor te queden para tu valoración dental.\n\nPara confirmar tu cita, solo necesitamos un pago de *$0.01 MXN*. ✨' },
          action: { name: 'flow', parameters: {
            flow_message_version: '3', flow_id: '1549975093816430', mode: 'published',
            flow_token: createBookingFlowToken(message.from, APPOINTMENTS_API_TOKEN),
            flow_cta: 'Ver horarios', flow_action: 'navigate', flow_action_payload: { screen: 'START' },
          } },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    // The same delivery is never sent twice. A new patient message can retry the invitation.
    return new Response(null, { status: sent.ok ? 204 : 502 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
