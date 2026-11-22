import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

function generatedCode() {
  return execFileSync(process.execPath, ['config-core/n8n/build-reactions-code.mjs'], {
    encoding: 'utf8', timeout: 4000,
  });
}
function run(items) {
  const code = generatedCode();
  const wrapped = '(function () {\n' + code + '\n})()';
  return vm.runInNewContext(wrapped, {
    $input: { all: () => items.map((json) => ({json})) },
  }, {timeout: 2000});
}
const event = (text = 'Cảm ơn shop nhé!') => ({
  channel: 'messenger', kind: 'message', messageType: 'text',
  tenantId: 'tenant-a', pageId: '1234567', senderId: '7654321',
  messageId: 'mid.$123', text,
});
const gate = () => ({
  featureEnabled: true, signatureVerified: true, tenantResolved: true,
  pageAuthorized: true, botOwnsThread: true, withinMessagingWindow: true,
  cooldownGranted: true, allowedPageIds: ['1234567'],
});

test('generated n8n Code node uses no credentials and never performs external send', () => {
  const code = generatedCode();
  assert.match(code, /DRY-RUN ONLY/);
  assert.match(code, /metaCallExecuted: false/);
  assert.doesNotMatch(code, /\bfetch\s*\(/);
  assert.doesNotMatch(code, /\baxios\s*\./);
  assert.doesNotMatch(code, /\$\.httpRequest/);
  assert.doesNotMatch(code, /^export /m);
});

test('generated code: direct social intent yields a candidate and a no-send payload', () => {
  const out = run([{event:event(),gate:gate()}]);
  assert.equal(out.length, 1);
  assert.equal(out[0].json.decision.mode, 'reaction_candidate');
  assert.equal(out[0].json.dryRun.sendAllowed, false);
  assert.equal(out[0].json.dryRun.body.payload.reaction, '❤️');
  assert.equal(out[0].json.metaCallExecuted, false);
});

test('generated code: no flag, approval intent, second Fanpage or order returns no reaction', () => {
  const off = gate(); off.featureEnabled = false;
  const other = event(); other.pageId = '2222222';
  const out = run([
    {event:event(),gate:off},
    {event:event('Được, tiếp tục triển khai migration'),gate:gate()},
    {event:other,gate:gate()},
    {event:event('Cảm ơn shop, tôi muốn mua 2 cái'),gate:gate()},
  ]);
  assert.ok(out.every(x=>x.json.decision.mode==='pass_through'));
  assert.ok(out.every(x=>x.json.dryRun===null && x.json.metaCallExecuted===false));
});
