// Exercises the exact isolated QA entrypoint, including real migration SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { runSelfServeQA } from '../qa/runtime-check.mjs';
import { makeD1 } from './d1-shim.mjs';

test('isolated runtime entrypoint requires its QA key and exposes only safe health metadata', async () => {
  const env = { ZH_QA_RUN_KEY:'qa'.repeat(24), ZH_DB:makeD1() };
  const health = await worker.fetch(new Request('https://qa.example.test/health'),env);
  assert.equal((await health.json()).outbound_mode,'IN_MEMORY_STUB_ONLY');
  const unauthorized = await worker.fetch(new Request('https://qa.example.test/qa/run',{method:'POST'}),env);
  assert.equal(unauthorized.status,401);
  const absentRoute = await worker.fetch(new Request('https://qa.example.test/v1/lite/connect',{method:'POST'}),env);
  assert.equal(absentRoute.status,404);
  assert.equal(env.ZH_DB.sqlite.prepare('SELECT COUNT(*) n FROM zh_connections').get().n,0);
});

test('isolated runtime performs the two-shop self-service scenario with no real outbound call', async () => {
  const originalFetch=globalThis.fetch;
  let realCalls=0;
  globalThis.fetch=async()=>{realCalls++;throw new Error('REAL_NETWORK_FORBIDDEN');};
  try {
    const report=await runSelfServeQA({ZH_DB:makeD1()});
    assert.equal(report.ok,true,JSON.stringify(report.checks));
    assert.equal(report.totals.failed,0);
    assert.equal(report.totals.checks,20);
    assert.equal(report.observations.n8n_forward_attempts,0);
    assert.equal(report.observations.unexpected_provider_attempts,0);
    assert.equal(realCalls,0);
    const exported=JSON.stringify(report);
    assert.doesNotMatch(exported,/FAKE_QA_|secret_token|token_sealed|pairing_code/);
    assert.equal(report.ai_smoke.status,'NOT_REQUESTED');
  } finally { globalThis.fetch=originalFetch; }
});
