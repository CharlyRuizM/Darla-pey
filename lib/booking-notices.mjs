const dateFormat = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long',
});
const timeFormat = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', currencyDisplay: 'code' });

export function bookingNotice(kind, appointment) {
  const date = new Date(appointment.starts_at);
  const when = `${dateFormat.format(date)} a las ${timeFormat.format(date)}`;
  switch (kind) {
    case 'pending_payment':
      return `¡Gracias! 😊 Apartamos tu horario para el *${when}*.\n\nEn cuanto recibamos tu pago de *${currency.format(appointment.deposit_cents / 100)}*, te confirmaremos la cita por aquí. 🦷`;
    case 'expired':
      return '¡Hola! Aún no recibimos tu pago 😔 y el horario que apartaste volvió a estar disponible.\n\nPero podemos arreglarlo en un minuto 😊. Elige el horario que mejor te quede y vuelve a apartar tu valoración. 🦷';
    case 'confirmed':
      return `¡Listo! 🎉 Recibimos tu pago y tu valoración dental quedó confirmada.\n\n📅 *${when}*\n⏱️ *45 minutos*\n\n¡Nos vemos pronto! 🦷`;
    default:
      throw new Error('Unknown booking notice');
  }
}
