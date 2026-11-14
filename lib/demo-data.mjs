// Datos de ejemplo para diseñar el panel. Se reemplazan por Supabase en la etapa 3.
// El estado de la cita y el estado del dinero se guardan por separado (ver README).

export const TIMEZONE = 'America/Mexico_City';
export const SLOT_MINUTES = 45;

export const consultorio = {
  nombre: 'Consultorio Dental Demo',
  dentista: 'Dra. Ana López',
  servicio: 'Valoración inicial',
  precioServicio: 600,
  anticipos: [100, 200, 300],
};

// Horario de atención: lunes a viernes 10:00–19:00, sábado 11:00–15:00, domingo cerrado.
export const horario = {
  0: null,
  1: ['10:00', '19:00'],
  2: ['10:00', '19:00'],
  3: ['10:00', '19:00'],
  4: ['10:00', '19:00'],
  5: ['10:00', '19:00'],
  6: ['11:00', '15:00'],
};

export const pacientes = [
  { id: 'p1', nombre: 'María Fernanda Ruiz', telefono: '5512345678' },
  { id: 'p2', nombre: 'Jorge Hernández', telefono: '5598765432' },
  { id: 'p3', nombre: 'Lucía Martínez', telefono: '5544556677' },
  { id: 'p4', nombre: 'Ricardo Gómez', telefono: '5533221100' },
  { id: 'p5', nombre: 'Sofía Castillo', telefono: '5577889900' },
  { id: 'p6', nombre: 'Daniel Ortega', telefono: '5566778899' },
];

// estadoCita: propuesta | pendiente_pago | confirmada | atendida | inasistencia | cancelada | vencida
// estadoPago: sin_anticipo | pendiente | pagado | revision | devolucion_pendiente
// dia: días hábiles a partir del primer día de atención (0 = hoy si el consultorio abre hoy).
// slot: índice del bloque de 45 minutos dentro del horario de ese día.
export const citas = [
  { id: 'c1', pacienteId: 'p1', dia: 0, slot: 0, estadoCita: 'atendida', anticipo: 200, estadoPago: 'pagado', saldoPagado: true, origen: 'whatsapp' },
  { id: 'c2', pacienteId: 'p2', dia: 0, slot: 1, estadoCita: 'confirmada', anticipo: 200, estadoPago: 'pagado', origen: 'whatsapp' },
  { id: 'c3', pacienteId: 'p3', dia: 0, slot: 3, estadoCita: 'confirmada', anticipo: 100, estadoPago: 'pagado', origen: 'consultorio' },
  { id: 'c4', pacienteId: 'p4', dia: 1, slot: 2, estadoCita: 'pendiente_pago', anticipo: 300, estadoPago: 'pendiente', retencionRestanteMin: 290, origen: 'whatsapp' },
  { id: 'c5', pacienteId: 'p5', dia: 1, slot: 4, estadoCita: 'propuesta', anticipo: 200, estadoPago: 'sin_anticipo', origen: 'consultorio' },
  { id: 'c6', pacienteId: 'p6', dia: 1, slot: 0, estadoCita: 'confirmada', anticipo: 200, estadoPago: 'pagado', origen: 'whatsapp' },
  { id: 'c7', pacienteId: 'p2', dia: 2, slot: 3, estadoCita: 'cancelada', anticipo: 200, estadoPago: 'devolucion_pendiente', origen: 'consultorio', nota: 'Cancelada por el consultorio: ofrecer reagendar o gestionar devolución.' },
  { id: 'c8', pacienteId: 'p3', dia: 3, slot: 5, estadoCita: 'vencida', anticipo: 100, estadoPago: 'revision', origen: 'whatsapp', nota: 'Pago tardío: llegó después de liberar el horario. Revisar antes de reasignar.' },
];

export const bloqueos = [
  { dia: 0, slot: 2, motivo: 'Bloqueo del dentista' },
];

export const cobrosIndependientes = [
  { id: 'k1', pacienteId: 'p1', concepto: 'Limpieza dental', monto: 650, estadoPago: 'pagado', canal: 'push', fecha: 0 },
  { id: 'k2', pacienteId: 'p4', concepto: 'Resina en molar', monto: 900, estadoPago: 'pendiente', canal: 'qr', fecha: 0 },
];
