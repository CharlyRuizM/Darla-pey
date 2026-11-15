import { whatsappAppointmentPhone } from './whatsapp-number.mjs';
import { diasDeAtencion, fechaCorta } from './agenda.mjs';
import { invitationDb, sendWhatsApp, uuidPattern } from './panel-invitations.mjs';

const display = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City', dateStyle: 'long', timeStyle: 'short',
});
const tell = (recipient, body) => sendWhatsApp(recipient, { type: 'text', text: { body } });

export function rescheduleAction(value) {
  if (typeof value !== 'string') return null;
  const [prefix, id, timestamp, extra] = value.split(':');
  if (!uuidPattern.test(id || '') || extra !== undefined) return null;
  if (prefix === 'pey-move' && timestamp === undefined) return { id };
  if (prefix === 'pey-move-slot' && /^\d{10}$/.test(timestamp || '')) return { id, timestamp: Number(timestamp) };
  return null;
}

export async function handleReschedule(action, recipient, availability) {
  const phone = whatsappAppointmentPhone(recipient);
  const r = await invitationDb(`appointments?id=eq.${action.id}&whatsapp_phone=eq.${phone}&status=eq.confirmed&select=starts_at,confirmed_at`);
  if (!r.ok) throw new Error('booking_lookup_failed');
  const [booking] = await r.json();
  if (!booking?.confirmed_at) return;
  if (Date.parse(booking.starts_at) - Date.now() < 86400000) {
    await tell(recipient, 'Puedes reagendar por aquí hasta 24 horas antes de tu cita. Si necesitas ayuda, escríbenos. 🦷');
    return;
  }

  if (action.timestamp) {
    const start = new Date(action.timestamp * 1000);
    const moved = await invitationDb('rpc/reschedule_paid_appointment', 'POST', {
      booking_id: action.id, booking_phone: phone, new_start: start.toISOString(),
    });
    if (!moved.ok) throw new Error('reschedule_failed');
    const changed = await moved.json();
    await tell(recipient, changed
      ? `¡Listo! 😊 Tu valoración quedó reagendada para el *${display.format(start)}*. Tu anticipo se conservó. 🦷`
      : 'Ese horario ya no está disponible. Tu cita original sigue confirmada. Toca «Reagendar» para elegir otro. 🦷');
    return;
  }

  const days = diasDeAtencion(5);
  const sections = await Promise.all(days.map(async (day) => {
    const date = day.toISOString().slice(0, 10);
    const response = await availability(new Request('https://internal.invalid/api/availability?date=' + date));
    if (!response.ok) throw new Error('availability_failed');
    const { slots } = await response.json();
    return { title: fechaCorta(day), rows: slots.slice(0, 2).map(({ id, title }) => ({
      id: `pey-move-slot:${action.id}:${Date.parse(id) / 1000}`,
      title,
    })) };
  }));
  const available = sections.filter((section) => section.rows.length);
  if (!available.length) {
    await tell(recipient, 'Por ahora no hay horarios libres en los próximos días. Tu cita sigue confirmada. 🦷');
    return;
  }
  const sent = await sendWhatsApp(recipient, { type: 'interactive', interactive: {
    type: 'list',
    body: { text: 'Elige un nuevo horario para tu valoración 😊. Tu anticipo se conserva y tu cita actual sigue confirmada hasta que el cambio quede listo.' },
    action: { button: 'Ver horarios', sections: available },
  } });
  if (!sent.ok) throw new Error('schedule_menu_failed');
}
