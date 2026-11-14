import { TIMEZONE, SLOT_MINUTES, horario } from './demo-data.mjs';

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const toHHMM = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// Fecha civil (año, mes, día) de "ahora" en la Ciudad de México.
export function hoyMx(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const [y, m, d] = parts.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

const addDays = (date, n) => new Date(date.getTime() + n * 86400000);

export const SLOT_INTERVAL_MINUTES = SLOT_MINUTES + 15;

// Citas de 45 minutos con 15 minutos de margen.
export function slotsDelDia(date) {
  const rango = horario[date.getUTCDay()];
  if (!rango) return [];
  const [inicio, fin] = rango.map(toMin);
  const slots = [];
  for (let t = inicio; t + SLOT_INTERVAL_MINUTES <= fin; t += SLOT_INTERVAL_MINUTES) {
    slots.push({ inicio: toHHMM(t), fin: toHHMM(t + SLOT_MINUTES) });
  }
  return slots;
}

// Próximos días en que abre el consultorio, empezando hoy.
export function diasDeAtencion(cantidad, desde = hoyMx()) {
  const dias = [];
  for (let i = 0; dias.length < cantidad && i < 30; i++) {
    const d = addDays(desde, i);
    if (horario[d.getUTCDay()]) dias.push(d);
  }
  return dias;
}

export const fechaLarga = (date) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(date);
export const fechaCorta = (date) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'short', day: 'numeric' }).format(date);

export const mxn = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);

export const telefonoBonito = (t) => `${t.slice(0, 2)} ${t.slice(2, 6)} ${t.slice(6)}`;
