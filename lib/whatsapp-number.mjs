export function mexicanWhatsApp(number) {
  return /^52(?:1)?[0-9]{10}$/.test(number);
}

export function whatsappContactKey(number) {
  return mexicanWhatsApp(number) ? number.slice(-10) : '+' + number;
}

export function whatsappAppointmentPhone(number) {
  return mexicanWhatsApp(number) ? '52' + number.slice(-10) : number;
}
