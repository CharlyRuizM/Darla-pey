import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { whatsappContactKey } from '../../../../lib/whatsapp-number.mjs';
import { consultorio } from '../../../../lib/demo-data.mjs';
import { timingSafeEqual } from 'node:crypto';
import { GET as availability } from '../../availability/route.js';
import { approvedInvitationTemplate, invitationDb, invitationMessage, sendWhatsApp } from '../../../../lib/panel-invitations.mjs';

export async function POST(request) {
  const { PANEL_TOKEN, KAPSO_PEY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (![KAPSO_PEY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY].every(Boolean)) {
    return Response.json({ error: 'unavailable' }, { status: 503 });
  }
  const expected = Buffer.from(`Bearer ${PANEL_TOKEN}`);
  const provided = Buffer.from(request.headers.get('authorization') || '');
  const operator = Boolean(PANEL_TOKEN) && provided.length === expected.length && timingSafeEqual(provided, expected);
  const { phone: enteredPhone, startsAt, depositCents, consent } = await request.json().catch(() => null) || {};
  const start = new Date(startsAt);
  const parsed = typeof enteredPhone === 'string' && /^\+?[0-9]{7,15}$/.test(enteredPhone)
    ? parsePhoneNumberFromString(enteredPhone.startsWith('+') ? enteredPhone : '+52' + enteredPhone)
    : null;
  if (!parsed?.isPossible() || typeof startsAt !== 'string'
    || !/(Z|[+-]\d{2}:\d{2})$/.test(startsAt) || !Number.isFinite(+start)
    || (!operator && consent !== true) || !Number.isInteger(depositCents) || depositCents < 1 || depositCents > consultorio.precioServicio * 100) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  const recipient = parsed.number.slice(1);
  const phone = whatsappContactKey(recipient);
  const phoneFilter = encodeURIComponent(phone);
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(start);
  let invitation;
  try {
    const slots = await availability(new Request(new URL('/api/availability?date=' + day, request.url)));
    if (slots.status !== 400 && !slots.ok) throw new Error('availability_failed');
    if (!slots.ok || !(await slots.json()).slots.some(slot => Date.parse(slot.id) === +start)) {
      return Response.json({ error: 'slot_unavailable' }, { status: 409 });
    }

    const approved = await approvedInvitationTemplate().catch(() => false);
    const recent = phone.startsWith('+') ? null : await invitationDb('panel_whatsapp_contacts?select=recipient&phone=eq.' + phoneFilter
      + '&last_inbound_at=gt.' + encodeURIComponent(new Date(Date.now() - 86400000).toISOString()));
    if (recent && !recent.ok) throw new Error('contact_lookup_failed');
    const [contact] = recent ? await recent.json() : [];
    if (!approved && !contact) return Response.json({ error: 'contact_window_closed' }, { status: 409 });

    if (!operator) {
      const previous = await invitationDb('panel_invitations?select=id&phone=eq.' + phoneFilter
        + '&slot_start=eq.' + encodeURIComponent(start.toISOString())
        + '&status=eq.sent&limit=1');
      if (!previous.ok) throw new Error('invitation_lookup_failed');
      if ((await previous.json()).length) return Response.json({ error: 'wait_before_resending' }, { status: 429 });
    }

    const saved = await invitationDb('panel_invitations', 'POST', {
      phone, slot_start: start.toISOString(), deposit_cents: depositCents, status: 'sent',
    });
    if (!saved.ok) throw new Error('invitation_save_failed');
    [invitation] = await saved.json();
    const sent = await sendWhatsApp(contact?.recipient || recipient, invitationMessage(invitation, approved));
    if (!sent.ok) throw new Error('invitation_send_failed');
    const messageId = (await sent.json()).messages?.[0]?.id;
    if (messageId) {
      await invitationDb('panel_invitations?id=eq.' + invitation.id, 'PATCH', { whatsapp_message_id: messageId })
        .catch(() => undefined);
    }
    return Response.json({ id: invitation.id, status: 'sent' }, { status: 201 });
  } catch {
    if (invitation) {
      await invitationDb('panel_invitations?id=eq.' + invitation.id + '&status=eq.sent&claimed_at=is.null',
        'PATCH', { status: 'failed' }).catch(() => undefined);
    }
    return Response.json({ error: 'send_unverified' }, { status: 503 });
  }
}
