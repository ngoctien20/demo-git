// n8n Code node before an HTTP Request node that POSTs to <hub>/v1/send.
// Input item: { chat_id, text, typing? } produced by the shop's reply logic.
// HTTP Request node: Method POST, URL <hub>/v1/send, Body = Raw/JSON "{{$json.body}}",
//   headers x-tien404-connection / x-tien404-ts / x-tien404-signature from this node's output.
// The flow never sees the Zalo bot token; the hub sends with the token it holds.
const crypto = require('crypto');
const FORWARD_KEY = $env.TIEN404_ZALO_HUB_FORWARD_KEY_QA;
const CONNECTION_ID = $env.TIEN404_ZALO_HUB_CONNECTION_QA;

const text = String($json.text || '').slice(0, 2000);
if (!text) throw new Error('EMPTY_TEXT');
const body = JSON.stringify({ connection_id: CONNECTION_ID, chat_id: String($json.chat_id), text, typing: $json.typing === true });
const ts = String(Math.floor(Date.now() / 1000));
const signature = crypto.createHmac('sha256', FORWARD_KEY).update(ts + '.' + body).digest('hex');
return { json: { body, headers: { 'x-tien404-connection': CONNECTION_ID, 'x-tien404-ts': ts, 'x-tien404-signature': signature } } };
