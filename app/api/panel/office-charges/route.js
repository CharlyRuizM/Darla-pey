import { consultorio } from '../../../../lib/demo-data.mjs';
import { timingSafeEqual } from 'node:crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { invitationDb, sendWhatsApp } from '../../../../lib/panel-invitations.mjs';

const respond = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  try {
    const response = await invitationDb('office_charges?select=id,amount_cents,paid_at,created_at&payment_link_id=not.is.null&or=(whatsapp_message_id.not.is.null,paid_at.not.is.null)&order=created_at.desc&limit=30');
    if (!response.ok) throw new Error();
    return respond({ charges: await response.json() }, 200);
  } catch {
    return respond({ error: 'unavailable' }, 503);
  }
}

async function officeTemplateApproved() {
  const response = await fetch('https://api.kapso.ai/meta/whatsapp/v24.0/1416749123556814/message_templates/1685881453247565', {
    headers: { 'X-API-Key': process.env.KAPSO_PEY_API_KEY },
    signal: AbortSignal.timeout(5000), cache: 'no-store',
  });
  if (!response.ok) return false;
  const result = await response.json();
  return (result.data ?? result).status === 'APPROVED';
}

export async function POST(request) {
  const { PANEL_TOKEN, PEY_API_KEY, KAPSO_PEY_API_KEY } = process.env;
  if (!PANEL_TOKEN || !PEY_API_KEY || !KAPSO_PEY_API_KEY) return respond({ error: 'unavailable' }, 503);
  const expected = Buffer.from('Bearer ' + PANEL_TOKEN);
  const actual = Buffer.from(request.headers.get('authorization') || '');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return respond({ error: 'unauthorized' }, 401);
  }
  const { phone, concept, amountCents } = await request.json().catch(() => null) || {};
  const parsed = typeof phone === 'string' ? parsePhoneNumberFromString(phone.trim(), { defaultCountry: 'MX', extract: false }) : undefined;
  const service = typeof concept === 'string' ? concept.trim() : '';
  if (!parsed?.isPossible() || parsed.countryCallingCode !== '52' || !service || service.length > 80
    || /[\r\n\x00-\x1f]/.test(service) || !Number.isInteger(amountCents) || amountCents < 1 || amountCents > 100000000) {
    return respond({ error: 'invalid_request' }, 400);
  }

  try {
    const approved = await officeTemplateApproved().catch(() => false);
    const contacts = await invitationDb('panel_whatsapp_contacts?select=recipient&phone=eq.' + parsed.nationalNumber
      + '&last_inbound_at=gt.' + encodeURIComponent(new Date(Date.now() - 86400000).toISOString()));
    if (!contacts.ok) throw new Error();
    const [contact] = await contacts.json();
    if (!approved && !contact) return respond({ error: 'contact_window_closed' }, 409);
    const id = crypto.randomUUID();
    const saved = await invitationDb('office_charges', 'POST', { id, amount_cents: amountCents });
    if (!saved.ok) throw new Error();
    const landing = 'https://pey-hackathon.ingecarlosrm.workers.dev/pago?tipo=procedimiento';
    const amount = amountCents / 100;
    const created = await fetch('https://api.pey.mx/payment-link/create', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: 'Bearer ' + PEY_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, hasTip: false, clientReferenceId: id, successUrl: landing, backUrl: landing }),
    });
    if (!created.ok) throw new Error();
    const link = await created.json();
    const url = new URL(link.url);
    if (typeof link.id !== 'string' || !link.id || url.origin !== 'https://app.mipey.mx') throw new Error();
    const linked = await invitationDb('office_charges?id=eq.' + id, 'PATCH', { payment_link_id: link.id });
    if (!linked.ok) throw new Error();
    const total = '$' + amount.toFixed(2) + ' MXN';
    const match = /^\/payment-link\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
    if (approved && (!match || url.search || url.hash)) throw new Error('invalid_checkout_path');
    const message = approved ? { type: 'template', template: {
      name: 'cobro_procedimiento', language: { code: 'es_MX' },
      components: [
        { type: 'body', parameters: [consultorio.nombre, service, total].map(text => ({ type: 'text', text })) },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: match[1] }] },
      ],
    } } : { type: 'interactive', interactive: {
      type: 'cta_url',
      body: { text: `¡Hola! 😊 Te escribimos de ${consultorio.nombre}. Te compartimos el cobro por *${service}*.\n\nTotal: *$${amount.toFixed(2)} MXN*. Puedes pagarlo con CoDi desde este enlace. 🦷` },
      action: { name: 'cta_url', parameters: { display_text: 'Abrir link de pago', url: url.href } },
    } };
    const sent = await sendWhatsApp(contact?.recipient || parsed.number.slice(1), message);
    if (!sent.ok) throw new Error();
    const messageId = (await sent.json()).messages?.[0]?.id;
    if (!messageId) throw new Error();
    const recorded = await invitationDb('office_charges?id=eq.' + id, 'PATCH', { whatsapp_message_id: messageId });
    if (!recorded.ok) throw new Error();
    return respond({ id, maskedPhone: '•••• ' + parsed.nationalNumber.slice(-4) }, 201);
  } catch {
    return respond({ error: 'send_unverified' }, 503);
  }
}
