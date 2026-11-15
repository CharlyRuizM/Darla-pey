import { mexicanWhatsApp, whatsappContactKey, whatsappAppointmentPhone } from './whatsapp-number.mjs';
import { createAppointment } from './create-appointment.mjs';
import { consultorio } from './demo-data.mjs';
import { createBookingFlowToken } from './whatsapp-flow-token.mjs';

export const numberId = '1142240392297039';
export const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const kapsoBase = 'https://api.kapso.ai/meta/whatsapp/v24.0/';
const labels = [['accept', 'Aceptar'], ['other', 'Otro horario'], ['reject', 'Rechazar']];

export function invitationDb(path, method = 'GET', body) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  return fetch(new URL('/rest/v1/' + path, SUPABASE_URL), {
    method, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(5000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  });
}

export async function sendWhatsApp(to, message) {
  return fetch(kapsoBase + numberId + '/messages', {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { 'X-API-Key': process.env.KAPSO_PEY_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, ...message }),
  });
}

export async function approvedInvitationTemplate() {
  const result = await fetch(kapsoBase + '1416749123556814/message_templates/1838105370661884', {
    headers: { 'X-API-Key': process.env.KAPSO_PEY_API_KEY },
    signal: AbortSignal.timeout(5000), cache: 'no-store',
  });
  if (!result.ok) return false;
  const json = await result.json();
  return (json.data ?? json).status === 'APPROVED';
}

export function invitationMessage(invitation, approved) {
  const date = new Date(invitation.slot_start);
  const timezone = { timeZone: 'America/Mexico_City' };
  const day = new Intl.DateTimeFormat('es-MX', { ...timezone, dateStyle: 'full' }).format(date);
  const time = new Intl.DateTimeFormat('es-MX', { ...timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  const amount = '$' + (invitation.deposit_cents / 100).toFixed(2) + ' MXN';
  const payload = (action) => `inv-${action}:${invitation.id}`;
  if (approved) return { type: 'template', template: {
    name: 'propuesta_valoracion', language: { code: 'es_MX' },
    components: [
      { type: 'body', parameters: [consultorio.nombre, day, time, amount].map(text => ({ type: 'text', text })) },
      ...labels.map(([action], index) => ({ type: 'button', sub_type: 'quick_reply', index: String(index),
        parameters: [{ type: 'payload', payload: payload(action) }] })),
    ],
  } };
  return { type: 'interactive', interactive: {
    type: 'button',
    body: { text: `¡Hola! 😊 ${consultorio.nombre} tiene un horario para tu valoración dental el *${day} a las ${time}*. 🦷\n\nPara confirmar tu cita, solo necesitamos un anticipo de *${amount}*. Puedes reagendar hasta 24 horas antes. Si cancelas, el anticipo no se devuelve.\n\n¿Te queda bien?` },
    action: { buttons: labels.map(([action, title]) => ({ type: 'reply', reply: { id: payload(action), title } })) },
  } };
}

function sendBookingFlow(to, text) {
  return sendWhatsApp(to, { type: 'interactive', interactive: {
    type: 'flow', body: { text }, action: { name: 'flow', parameters: {
      flow_message_version: '3', flow_id: '1549975093816430', mode: 'published',
      flow_token: mexicanWhatsApp(to) ? createBookingFlowToken(to, process.env.APPOINTMENTS_API_TOKEN) : crypto.randomUUID(),
      flow_cta: 'Ver horarios', flow_action: 'navigate', flow_action_payload: { screen: 'START' },
    } },
  } });
}

export async function replyToInvitation(id, action, recipient) {
  const base = 'panel_invitations?id=eq.' + id;
  const update = async (body) => {
    const response = await invitationDb(base, 'PATCH', body);
    if (!response.ok) throw new Error('invitation_update_failed');
  };
  const owned = base + '&phone=eq.' + encodeURIComponent(whatsappContactKey(recipient));
  // Older invitations recorded a claim when the patient only asked to see other times.
  const available = owned + '&or=(and(status.eq.sent,claimed_at.is.null),status.eq.reschedule_requested)';
  async function explainClosed() {
    const lookup = await invitationDb(owned + '&select=status');
    if (!lookup.ok) throw new Error('invitation_lookup_failed');
    const [row] = await lookup.json();
    if (!row) return;
    const body = {
      accepted: 'Esta propuesta ya se usó para apartar tu cita. Revisa los mensajes de pago y confirmación en este chat. 🦷',
      rejected: 'Esta propuesta ya quedó rechazada. Si quieres agendar, escríbenos y con gusto te ayudamos. 😊',
      expired: 'Ese horario ya no está disponible. Puedes pedirnos otra fecha por aquí. 🦷',
      failed: 'No pudimos verificar esta solicitud. Escríbenos y te ayudamos a revisarla. 🦷',
    }[row.status] || 'Tu solicitud ya se está procesando. En un momento tendrás noticias por aquí. 🦷';
    await sendWhatsApp(recipient, { type: 'text', text: { body } });
  }
  if (action === 'accept') {
    const lookup = await invitationDb(available);
    if (!lookup.ok) throw new Error('invitation_lookup_failed');
    const [invitation] = await lookup.json();
    if (!invitation) return explainClosed();
    const amount = '$' + (invitation.deposit_cents / 100).toFixed(2) + ' MXN';
    const localPhone = mexicanWhatsApp(recipient);
    await sendWhatsApp(recipient, { type: 'interactive', interactive: {
      type: 'button',
      body: { text: localPhone ? `¡Gracias! 😊 Elige cómo pagar tu anticipo de *${amount}*. Si eliges el aviso, te llegará una notificación para autorizar el cobro en tu banco. También puedes pedir un link de pago. Cuando recibamos tu pago, te confirmaremos la cita por aquí. 🦷` : `¡Gracias! 😊 Solicita el link para pagar tu anticipo de *${amount}* con CoDi. Te confirmaremos la cita por aquí cuando recibamos el pago. 🦷` },
      action: { buttons: [
        ...(localPhone ? [{ type: 'reply', reply: { id: 'inv-bank:' + id, title: 'Aviso en mi banco' } }] : []),
        { type: 'reply', reply: { id: 'inv-link:' + id, title: 'Solicitar link' } },
      ] },
    } });
    return;
  }
  if (action === 'bank' && !mexicanWhatsApp(recipient)) return;
  const next = { bank: 'sent', link: 'sent', other: 'reschedule_requested', reject: 'rejected' };
  const claim = await invitationDb(available, 'PATCH',
    { claimed_at: action === 'other' ? null : new Date().toISOString(), status: next[action] });
  if (!claim.ok) throw new Error('invitation_claim_failed');
  const [invitation] = await claim.json();
  if (!invitation) return explainClosed();
  if (action === 'other') {
    await sendBookingFlow(recipient, 'Claro 😊. Elige otro horario para tu valoración. Si reservas desde el formulario de la demo, el anticipo es de $0.01 MXN. 🦷');
    return;
  }
  if (action === 'reject') {
    await sendWhatsApp(recipient, { type: 'text', text: { body: 'Gracias por avisarnos 😊. Si quieres agendar una valoración más adelante, aquí estaremos. 🦷' } });
    return;
  }
  const appointmentId = crypto.randomUUID();
  const result = await createAppointment({
    id: appointmentId, startsAt: invitation.slot_start, phoneNumber: invitation.phone,
    depositCents: invitation.deposit_cents, paymentMethod: action === 'link' ? 'link' : 'push',
    whatsappPhone: whatsappAppointmentPhone(recipient),
  });
  if (result.status === 201) {
    await update({ status: 'accepted', appointment_id: appointmentId });
    if (action === 'link') {
      const { paymentUrl } = await result.json();
      await sendWhatsApp(recipient, { type: 'interactive', interactive: {
        type: 'cta_url',
        body: { text: '¡Tu horario está apartado! 😊 Abre el link para pagar tu anticipo con CoDi. En cuanto recibamos el pago, te confirmaremos la cita por aquí. 🦷' },
        action: { name: 'cta_url', parameters: { display_text: 'Abrir link de pago', url: paymentUrl } },
      } });
    }
  } else if (result.status === 409) {
    await update({ status: 'expired' });
    await sendBookingFlow(recipient, 'Ese horario ya no está disponible 😔. Puedes elegir otro para tu valoración. El anticipo del formulario de la demo es de $0.01 MXN. 🦷');
  } else {
    await update({ status: 'failed' });
    await sendWhatsApp(recipient, { type: 'text', text: { body: 'No pudimos verificar el envío del anticipo. Revisa si recibiste la solicitud en tu banco y escríbenos para ayudarte. 🦷' } });
  }
}
