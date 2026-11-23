// Guard: nothing in gateway/zalo-hub looks like a real Zalo bot token or key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
function files(dir) {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : [p]; });
}
test('no bot token or base64 master key committed', () => {
  for (const f of files(root)) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/\b\d{5,20}:[A-Za-z0-9_-]{8,128}\b/g)) assert.match(m[0], /FAKE|abc|xyz|123456789/i, `${f}: ${m[0].slice(0, 8)}…`);
    assert.ok(!/ZH_MASTER_KEY\s*=\s*"[A-Za-z0-9+/]{40,}={0,2}"/.test(t), f);
  }
});
