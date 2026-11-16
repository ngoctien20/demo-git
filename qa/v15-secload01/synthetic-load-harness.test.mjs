import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runSyntheticLoad} from './synthetic-load-harness.mjs';
test('six synthetic levels 1 5 10 25 50 100 and bound total request volume',async()=>{
 const r=await runSyntheticLoad();
 assert.equal(r.contract,'TIEN404_V15_SECLOAD01_SYNTHETIC_CAPACITY_V1');
 assert.deepEqual(r.scenarios.map(x=>x.simulatedConversations),[1,5,10,25,50,100]);
 assert.deepEqual(r.scenarios.map(x=>x.requests),[40,50,60,100,150,200]);
 assert.equal(r.requestCount,600);
});
test('synthetic metrics use measured positive durations but not production RPS',async()=>{
 const r=await runSyntheticLoad();
 assert.equal(r.hardBoundary,'DO_NOT_USE_FOR_PRODUCTION_CAPACITY_CERTIFICATION');
 for(const x of r.scenarios){
  assert.ok(x.durationMs>0&&x.internalMockRps>0);
  assert.ok(x.mockLatencyP50Ms>0&&x.mockLatencyP95Ms>=x.mockLatencyP50Ms);
  assert.ok(x.mockLatencyP99Ms>=x.mockLatencyP95Ms);
  assert.equal(x.actualProductionRps,null);
  assert.equal(x.n8nExecutionP95Ms,null);
  assert.equal(x.metaDeliveryP95Ms,null);
  assert.equal(x.model,'SYNTHETIC_NODEJS_MOCK_NOT_N8N');
 }
});
test('no real orders, provider sends, AI API, or failures are counted in mock benchmark',async()=>{
 const r=await runSyntheticLoad();
 assert.equal(r.providerMessagesSent,0);
 assert.equal(r.paidModelCalls,0);
 assert.equal(r.realOrdersWritten,0);
 assert.equal(r.realDbTransactions,0);
 assert.equal(r.currencyCostEstimate,null);
 for(const x of r.scenarios){
  assert.equal(x.failures,0);
  assert.equal(x.realMetaDeliveries,0);
  assert.equal(x.realAiProviderCalls,0);
  assert.equal(x.realOrdersWritten,0);
  assert.equal(x.requestSuccessPct,100);
 }
});
