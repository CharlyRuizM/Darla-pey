import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const MAX_AGE_SECONDS = 15 * 60;

export function createBookingFlowToken(recipient, secret, now = Date.now()) {
  if (!secret || typeof recipient !== 'string' || !/^52(?:1)?[0-9]{10}$/.test(recipient)) {
    throw new Error('Expected a Mexican WhatsApp recipient and a signing secret');
  }

  const phone = recipient.slice(-10);
  const expires = Math.floor(now / 1000) + MAX_AGE_SECONDS;
  const claims = ['pey-booking', phone, expires, randomUUID()].join('.');
  const signature = createHmac('sha256', secret).update(claims).digest('hex');
  return claims + '.' + signature;
}

export function readBookingFlowToken(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string') return null;
  const match = /^(pey-booking\.([0-9]{10})\.([0-9]{10})\.([a-f0-9-]{36}))\.([a-f0-9]{64})$/.exec(token);
  if (!match) return null;

  const [, claims, phone, expires, reservationId, signature] = match;
  const remaining = Number(expires) - Math.floor(now / 1000);
  if (remaining <= 0 || remaining > MAX_AGE_SECONDS) return null;

  const expected = createHmac('sha256', secret).update(claims).digest();
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), expected)) return null;
  return { phone, reservationId };
}
