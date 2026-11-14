import crypto from 'crypto';

export function verifyPeyWebhook(headers, body, secret, now = Date.now()) {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signatures = headers.get('webhook-signature');
  if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300) return false;

  const key = Buffer.from(secret.slice('whsec_'.length), 'base64');
  const expected = crypto.createHmac('sha256', key)
    .update(`${id}.${timestamp}.`)
    .update(body)
    .digest();

  return signatures.split(/\s+/).some((entry) => {
    const [version, encoded] = entry.split(',');
    if (version !== 'v1' || !encoded) return false;
    const actual = Buffer.from(encoded, 'base64');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  });
}
