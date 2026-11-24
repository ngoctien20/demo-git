const crypto = require('crypto');
const digest = $input.first().json.computed_hmac;
const headers = $('Webhook1').first().json.headers ?? {};
const signature = headers['x-hub-signature-256'];
let verified = false;
if (typeof digest === 'string' && /^[0-9a-f]{64}$/.test(digest) &&
    typeof signature === 'string' && /^sha256=[0-9a-f]{64}$/.test(signature)) {
  const expected = Buffer.from(digest, 'hex');
  const received = Buffer.from(signature.slice(7), 'hex');
  verified = crypto.timingSafeEqual(expected, received);
}
return [{ json: { verified } }];
