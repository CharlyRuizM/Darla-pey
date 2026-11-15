import { slotsDelDia } from './agenda.mjs';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function panelAppointments(rows, days, now) {
  return rows.flatMap((row) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(row.starts_at))
      .map(({ type, value }) => [type, value]));
    const day = days.findIndex((date) => date.toISOString().slice(0, 10) ===
      `${parts.year}-${parts.month}-${parts.day}`);
    if (day < 0) return [];
    const time = `${parts.hour}:${parts.minute}`;
    const slot = slotsDelDia(days[day]).findIndex(({ inicio }) => inicio === time);
    const remaining = Math.max(0, Math.ceil((Date.parse(row.hold_until) - now) / 60000));
    const paid = row.status === 'confirmed' || (row.status === 'cancelled' && Boolean(row.confirmed_at));
    const states = {
      invited: ['propuesta', 'sin_anticipo'],
      confirmed: ['confirmada', 'pagado'],
      cancelled: ['cancelada', paid ? 'pagado' : 'sin_anticipo'],
      expired: ['vencida', 'sin_anticipo'],
      pending_payment: Date.parse(row.hold_until) > now
        ? ['pendiente_pago', 'pendiente'] : ['vencida', 'sin_anticipo'],
    };
    const [estadoCita, estadoPago] = states[row.status] || ['vencida', 'sin_anticipo'];
    return [{
      id: row.id, dia: day, slot, hora: time, origen: 'whatsapp',
      anticipo: row.deposit_cents / 100, estadoCita, estadoPago,
      retencionRestanteMin: remaining, pacienteId: row.id,
      paciente: { id: row.id, telefono: row.whatsapp_phone || '—', nombre: row.patient_name },
    }];
  });
}
