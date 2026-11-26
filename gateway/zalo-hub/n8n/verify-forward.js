// n8n Code node ("Run once for each item") right after the Webhook node of a shop flow.
// Webhook node: Respond = Immediately, Raw body = ON (binary "data"), so we verify the exact bytes the hub signed.
// Needs: credential/env with the shop's forward_key (TIEN404_ZALO_HUB_FORWARD_KEY_<SHOP>) and the shop's connection_id.
// Output: the parsed hub event, or throws (n8n stops, nothing is sent to the customer).
const crypto = require('crypto');
const FORWARD_KEY = $env.TIEN404_ZALO_HUB_FORWARD_KEY_QA; // or read from a credential via an HTTP node; never hard-code
const CONNECTION_ID = $env.TIEN404_ZALO_HUB_CONNECTION_QA;

const h = $json.headers || {};
const raw = Buffer.from(await this.helpers.getBinaryDataBuffer(0, 'data')).toString('utf8');
const ts = String(h['x-tien404-ts'] || '');
const sig = String(h['x-tien404-signature'] || '');
if (!FORWARD_KEY || !CONNECTION_ID) throw new Error('HUB_KEY_NOT_CONFIGURED');
if (h['x-tien404-connection'] !== CONNECTION_ID) throw new Error('WRONG_CONNECTION');
if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) throw new Error('STALE');
const want = crypto.createHmac('sha256', FORWARD_KEY).update(ts + '.' + raw).digest('hex');
if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) throw new Error('BAD_SIGNATURE');

const evt = JSON.parse(raw);
if (evt.connection_id !== CONNECTION_ID || evt.channel !== 'zalo_bot') throw new Error('WRONG_CONNECTION');
return { json: { ...evt, source_message_id: evt.event?.message_id } };
