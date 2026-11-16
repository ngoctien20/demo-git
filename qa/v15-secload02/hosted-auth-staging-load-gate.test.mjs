import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {reviewSecLoad02,concurrentExecutionMax} from './hosted-auth-staging-load-gate.mjs';
const dir=dirname(fileURLToPath(import.meta.url));
const h=JSON.parse(readFileSync(join(dir,'hosted-store-rls-privrpc-readonly-ledger.json'),'utf8'));
const m=JSON.parse(readFileSync(join(dir,'real-inactive-n8n-bounded-manual-4200-4203.json'),'utf8'));
const decision=(a=h,b=m)=>reviewSecLoad02(a,b);
const noGo=r=>{
 assert.equal(r.verdict,'NO_GO');
 assert.equal(r.hostedMultiStoreReleased,false);
 assert.equal(r.executePrivilegedRpcs,false);
 assert.equal(r.modifyRls,false);
 assert.equal(r.productionLoadCertified,false);
 assert.equal(r.authorizedProviderSends,0);
 assert.equal(r.publishWorkflow,false);
 assert.equal(r.actualParallelExecutionCapacityVerified,false);
};
test('current hosted and real inactive n8n evidence return NO-GO with specific risks',()=>{
 const r=decision();noGo(r);
 assert.equal(r.sourceAuditStatus,'VERIFIED_METADATA_ONLY');
 assert.equal(r.stagingManualSmokeStatus,'4_OF_4_PASS_NO_CONCURRENCY');
 assert.equal(r.actualSimultaneouslyRunning,1);
 assert.deepEqual(r.exactManualExecutionIds,['4200','4201','4202','4203']);
 assert.deepEqual(r.observedN8NRunDurationsMs,[1809,1747,123,120]);
});
test('canonical Store and Store Membership do not exist in hosted staging',()=>{
 assert.equal(h.canonicalStoreTablesPresent,false);
 assert.equal(h.storeMembershipsPresent,false);
 assert.equal(h.publicCommerceStoreColumnsPresent,false);
 assert.equal(h.publicStoreScopedPoliciesPresent,false);
 assert.ok(decision().risks.includes('P0_HOSTED_STORE_AUTHORITY_UNAVAILABLE'));
});
test('positive: all 20 public tables have RLS, no RLS-off anon SELECT',()=>{
 assert.equal(h.publicTablesRlsEnabledCount,20);
 assert.equal(h.publicTablesCheckedCount,20);
 assert.equal(h.publicTablesWithRlsOffAndAnonSelect,0);
 assert.ok(decision().positives.includes('PUBLIC_SCHEMA_RLS_CONFIGURATION_ON'));
});
test('tenant-level RLS cannot certify same-tenant store A/B isolation',()=>{
 assert.equal(h.policies.length,8);
 for(const p of h.policies){
  assert.equal(p.rls,true);
  assert.equal(p.forceRls,true);
  assert.equal(p.policyCount,1);
  assert.equal(p.authUidPolicyCount,1);
  assert.equal(p.storeIdPolicyCount,0);
  assert.ok(!p.ownerCols.includes('store_id'));
 }
 noGo(decision());
});
test('save_merchant_product writes products scoped by tenant, not canonical Store',()=>{
 const fn=h.rpc.find(x=>x.name==='save_merchant_product');
 assert.equal(fn.authenticatedCallable,true);
 assert.equal(fn.usesAuthUid,true);
 assert.equal(fn.checksOwnerManagerRole,true);
 assert.equal(fn.usesHardcodedTwoTenantAllowlist,true);
 assert.equal(fn.writesProductsUsingTenantId,true);
 assert.equal(fn.writesProductsUsingStoreId,false);
 assert.ok(decision().risks.includes('P0_PRODUCT_WRITES_LACK_STORE_SCOPING'));
});
test('anon-accessible Zalo RPC has Vault/header/HMAC guard, exploitation not proven',()=>{
 const z=h.rpc.find(x=>x.name==='qa_shop_b_zalo_claim');
 assert.equal(z.anonCallable,true);
 assert.equal(z.usesAuthUid,false);
 assert.equal(z.validatesHeaderSecret,true);
 assert.equal(z.usesVaultSecret,true);
 assert.equal(z.usesHmacSenderEvent,true);
 assert.equal(h.securityDefinerExploitProven,false);
 noGo(decision());
});
test('owner RPC uses authenticated auth.uid + active member + expiring challenge',()=>{
 const o=h.rpc.find(x=>x.name==='qa_owner_pairing');
 assert.equal(o.authenticatedCallable,true);
 assert.equal(o.usesAuthUid,true);
 assert.equal(o.checksActiveTenantMembership,true);
 assert.equal(o.checksOwnerRole,true);
 assert.equal(o.checksChallengeExpiryAndAttemptLimit,true);
});
test('all three SECURITY DEFINER postgres owners use pinned function SHA and search_path',()=>{
 assert.equal(h.rpc.length,3);
 for(const x of h.rpc){
  assert.equal(x.owner,'postgres');
  assert.equal(x.securityDefiner,true);
  assert.equal(x.setsSearchPath,true);
  assert.match(x.codeSha256,/^[a-f0-9]{64}$/);
 }
 assert.equal(h.privilegedRpcDynamicSqlDetected,false);
});
test('future function change or incorrect role must trigger independent re-audit',()=>{
 for(const [n,key,val] of [
  ['save_merchant_product','writesProductsUsingStoreId',true],
  ['qa_shop_b_zalo_claim','validatesHeaderSecret',false],
  ['qa_owner_pairing','checksActiveTenantMembership',false],
 ]){
  const x=structuredClone(h);x.rpc.find(r=>r.name===n)[key]=val;
  const r=decision(x);noGo(r);
  assert.equal(r.reasons[0].endsWith('CHANGED')||r.reasons[0].endsWith('UNVERIFIED'),true);
 }
});
test('unexpected hosted store schema requires re-audit, not automatic GO',()=>{
 for(const key of ['canonicalStoreTablesPresent','storeMembershipsPresent','publicCommerceStoreColumnsPresent']){
  const x={...h,[key]:true};
  const r=decision(x);noGo(r);
  assert.deepEqual(r.reasons,['LIVE_STORE_AUTHORITY_CHANGED_NEEDS_REAUDIT']);
 }
});
test('privileged RPCs were inspected without business RPC calls, SQL writes or customer rows',()=>{
 assert.equal(h.hostedSchemaChangePerformed,false);
 assert.equal(h.rpcInvoked,false);
 assert.equal(h.customerRowsRead,false);
 assert.equal(h.passwordsOrTokensExported,false);
 const r=decision();noGo(r);
 assert.ok(r.positives.includes('HOSTED_READ_ONLY'));
});
test('QA workflow is inactive 2-node Manual→Code with no webhook or credentials',()=>{
 assert.equal(m.workflowId,'ZHJmhlRwAiNEtujb');
 assert.equal(m.active,false);
 assert.equal(m.publishedVersion,null);
 assert.equal(m.nodeCount,2);
 for(const n of ['credentialNodes','webhookNodes','externalProviderNodes',
 'merchantBusinessToolNodes','metaSends','orderWrites','paidModelCalls']){
 assert.equal(m[n],0,n);
 }
});
test('all four actual executions succeeded without provider/model/orders',()=>{
 assert.equal(m.acceptedExecutions,4);
 for(const x of m.executions){
  assert.equal(x.status,'success');
  assert.equal(x.outputPass,true);
  assert.equal(x.mode,'manual');
  assert.equal(x.realProviderSends,0);
  assert.equal(x.ordersWritten,0);
  assert.equal(x.paidModelCalls,0);
  assert.equal(x.productionWebhookLoad,0);
 }
});
test('observed 3 submitted concurrent calls are serial, so capacity is unknown',()=>{
 assert.deepEqual(m.plannedConcurrentCalls,[1,3]);
 assert.equal(m.actualObservedPairwiseExecutionOverlaps,0);
 assert.equal(concurrentExecutionMax(m.executions),1);
 assert.equal(m.actualVerifiedSimultaneouslyRunningExecutions,1);
 assert.equal(m.stagingConcurrentLoadCertified,false);
 assert.equal(m.cloudConcurrencyLimitCertified,false);
 assert.equal(m.actualProductionRps,null);
 assert.equal(m.extendedFiveConcurrentBatchNotRun,true);
 noGo(decision());
});
test('a fabricated 5-way overlap cannot obtain live release from a local JSON edit',()=>{
 const x=structuredClone(m);
 x.actualVerifiedSimultaneouslyRunningExecutions=5;
 noGo(decision(h,x));
 assert.deepEqual(decision(h,x).reasons,['PARALLEL_LOAD_NOT_PROVEN']);
});
test('a fabricated completed fifth run cannot obtain release',()=>{
 const x=structuredClone(m);
 x.executions.push({...x.executions[0],id:'4204'});
 noGo(decision(h,x));
 assert.deepEqual(decision(h,x).reasons,['QA_MANUAL_WORKFLOW_CHANGED']);
});
test('interval overlap detector counts actual overlapping intervals',()=>{
 const x=[{startedAt:'2026-01-01T00:00:00.000Z',stoppedAt:'2026-01-01T00:00:02.000Z'},
  {startedAt:'2026-01-01T00:00:01.000Z',stoppedAt:'2026-01-01T00:00:03.000Z'},
  {startedAt:'2026-01-01T00:00:03.000Z',stoppedAt:'2026-01-01T00:00:04.000Z'}];
 assert.equal(concurrentExecutionMax(x),2);
});
test('invalid execution intervals are fail-closed',()=>{
 for(const xs of [[{startedAt:'bad',stoppedAt:'2020-01-01'}],
  [{startedAt:'2026-01-01T00:00:01Z',stoppedAt:'2026-01-01T00:00:00Z'}]]){
  assert.throws(()=>concurrentExecutionMax(xs),/INVALID_EXECUTION_INTERVAL/);
 }
});
test('private Page/PSID/customer identifiers absent from public read-only ledger',()=>{
 const raw=readFileSync(join(dir,'hosted-store-rls-privrpc-readonly-ledger.json'),'utf8')+
 readFileSync(join(dir,'real-inactive-n8n-bounded-manual-4200-4203.json'),'utf8');
 for(const term of ['"psid"','"page_id"','"access_token"','"app_secret"',
  '"customer_name"','"customer_phone"','"jwt"','"headers"','"secret_value"']){
  assert.equal(raw.includes(term),false,term);
 }
});
test('SQL preflight is metadata-only, without business function calls or DDL/DML',()=>{
 const sql=readFileSync(join(dir,'hosted-rls-privrpc-READ_ONLY_PREFLIGHT.sql'),'utf8');
 const statements=sql.split('\n').filter(x=>!x.trim().startsWith('--')).join('\n');
 assert.match(statements,/BEGIN TRANSACTION READ ONLY;/);
 assert.match(statements,/COMMIT;/);
 assert.doesNotMatch(statements,/^\s*(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE|COPY|CALL)\s/im);
 assert.doesNotMatch(statements,/^\s*SELECT\s+public\.(qa_shop_b_zalo_claim|save_merchant_product|qa_owner_pairing)\(/im);
 assert.match(statements,/has_function_privilege/);
 assert.match(statements,/pg_policies/);
});
test('source reporting cannot turn private owner approval or missing Store proof into release',()=>{
 const r=decision();noGo(r);
 assert.ok(r.requiresPrivateOperatorApproval.includes('PRIVATE_N8N_FULL_BACKUP_AND_ROLLBACK'));
 assert.ok(r.requiresPrivateOperatorApproval.includes('EXPLICIT_PRODUCTION_CUTOVER'));
 assert.ok(r.risks.some(x=>x.startsWith('P0_')));
});
