const proposalStates = {
  sent: 'propuesta', accepted: 'aceptada', rejected: 'rechazada',
  reschedule_requested: 'otro_horario', failed: 'envio_fallido', expired: 'vencida',
};
const noticeEvents = {
  pending_payment: 'Aviso de horario apartado',
  confirmed: 'Aviso de confirmación',
  expired: 'Aviso de vencimiento',
};
const responses = {
  accepted: 'Propuesta aceptada', rejected: 'Propuesta rechazada',
  reschedule_requested: 'Pidió otro horario', failed: 'Envío sin confirmar',
};

export function historyEntry(row) {
  const proposal = row.entry_key.startsWith('invitation:');
  const events = [];
  const add = (label, at, note) => events.push({ label, at: at || null, note: note || null });
  if (row.invitation_id) {
    add(row.invitation_status === 'failed' ? 'Intento de envío de propuesta' : 'Propuesta enviada',
      row.invited_at, 'Registro de la propuesta');
    if (responses[row.invitation_status]) add(responses[row.invitation_status], row.responded_at);
  }
  if (!proposal) {
    add('Reserva creada', row.sort_at, row.estimated ? 'Hora estimada a partir del apartado' : null);
    add('Apartado hasta', row.hold_until);
    if (row.confirmed_at) add('Pago recibido y cita confirmada', row.confirmed_at);
  }
  if (row.status === 'expired') add(proposal ? 'Propuesta vencida' : 'Reserva vencida', proposal
    ? new Date(Date.parse(row.starts_at) - 21600000).toISOString() : row.hold_until);
  if (row.status === 'cancelled') add('Cita cancelada');
  for (const notice of row.notices || []) {
    if (noticeEvents[notice.kind]) add(noticeEvents[notice.kind],
      notice.claimed_at || notice.created_at,
      notice.claimed_at ? 'Procesado para envío · entrega sin verificar' : 'En cola');
  }
  events.sort((a, b) => (a.at || '9999').localeCompare(b.at || '9999'));
  const last4 = /^\d{4}$/.test(row.last4 || '') ? row.last4 : null;
  return {
    key: row.entry_key,
    startsAt: row.starts_at,
    holdUntil: row.hold_until,
    nombre: last4 ? `Paciente ••${last4}` : 'Paciente',
    telefono: last4 ? `•••• ${last4}` : null,
    anticipo: row.deposit_cents / 100,
    estadoCita: proposal ? proposalStates[row.status] : ({
      confirmed: 'confirmada', pending_payment: 'pendiente_pago',
      expired: 'vencida', cancelled: 'cancelada',
    })[row.status],
    estadoPago: row.confirmed_at ? 'pagado' : row.status === 'pending_payment' ? 'pendiente' : 'sin_anticipo',
    origen: row.invitation_id ? 'Propuesta del consultorio' : 'El paciente agendó por WhatsApp',
    events,
  };
}
