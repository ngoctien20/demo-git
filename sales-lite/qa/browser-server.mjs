import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { fixture } from './fixture.mjs';
import { handler } from '../lib/http.mjs';

const f = await fixture(),
  sessions = new Map(),
  keys = {},
  codes = {};
for (const shop of ['A', 'B']) {
  keys[shop] = randomBytes(32).toString('hex');
  sessions.set(keys[shop], shop);
}
let serve;
const server = http.createServer((req, res) => serve(req, res));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
serve = handler({
  service: f.service,
  verifyQaInbound: f.verify,
  origin,
  bindOwner(req) {
    const token = (req.headers.cookie || '')
      .split(/;\s*/)
      .find((p) => p.startsWith('liteqa='))
      ?.slice(7);
    const shop = sessions.get(token);
    return shop ? (text, event) => f.owner(shop, text, event) : null;
  }
});
for (const shop of ['A', 'B']) {
  const post = async (input) => {
    const res = await fetch(origin + '/qa/inbound', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (res.status !== 200) throw Error('QA ingress HTTP ' + res.status);
    return res.json();
  };
  const q = await post(f.signed(shop, 'buyer-browser', 'F01 x 2'));
  if (q.state !== 'AWAITING_CUSTOMER' || q.proof) throw Error('Unexpected public quote state');
  const confirmation = f.signed(shop, 'buyer-browser', 'xác nhận');
  const saved = await post(confirmation),
    again = await post(confirmation);
  if (
    saved.state !== 'SAVED' ||
    again.state !== 'ALREADY_SAVED' ||
    again.request.code !== saved.request.code ||
    !saved.message.includes(saved.request.code)
  )
    throw Error('HTTP confirmation did not persist exactly once');
  codes[shop] = saved.request.code;
}
// A private pipe connects this fixture to the browser runner; this line never goes to CI logs/artifacts.
process.stdout.write(JSON.stringify({ origin, keys, codes }) + '\n');
process.on('SIGTERM', () => {
  server.closeAllConnections();
  server.close(async () => {
    await f.close();
    process.exit(0);
  });
});
