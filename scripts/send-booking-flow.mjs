import { createBookingFlowToken } from '../lib/whatsapp-flow-token.mjs';

const { KAPSO_PEY_API_KEY, APPOINTMENTS_API_TOKEN } = process.env;
const recipient = process.argv[2];
if (!KAPSO_PEY_API_KEY || !APPOINTMENTS_API_TOKEN || !/^52(?:1)?[0-9]{10}$/.test(recipient || '')) {
  throw new Error('Configura las dos claves e indica el WhatsApp del destinatario en formato internacional.');
}

const response = await fetch('https://api.kapso.ai/meta/whatsapp/v23.0/1142240392297039/messages', {
  method: 'POST',
  headers: { 'X-API-Key': KAPSO_PEY_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'interactive',
    interactive: {
      type: 'flow',
      body: { text: 'Elige un horario para tu valoración dental.' },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_id: '1549975093816430',
          flow_token: createBookingFlowToken(recipient, APPOINTMENTS_API_TOKEN),
          flow_cta: 'Elegir horario',
          flow_action: 'navigate',
          mode: 'draft',
          flow_action_payload: { screen: 'START' },
        },
      },
    },
  }),
  signal: AbortSignal.timeout(15000),
});

if (!response.ok) throw new Error('Kapso respondió HTTP ' + response.status);
console.log('Kapso aceptó el envío del Flow.');
