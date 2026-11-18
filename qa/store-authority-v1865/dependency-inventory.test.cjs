'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const x=require('./dependency-inventory.json');
test('partial audit cannot be upgraded to zero-callers proof',()=>{assert.equal(x.scope,'READ_ONLY_STATIC_AUDIT_PARTIAL');assert.equal(x.doesNotProveNoCallers,true);assert.ok(x.remainingSourcesNotAudited.length>=5)});
test('3 RPC grants evidence preserved, never trigger privilege revocation',()=>{assert.equal(x.rpcObservations.length,3);assert.equal(x.approvedToRevokeGrants,false);assert.ok(x.rpcObservations.every(x=>x.securityDefiner===true))});
test('n8n evidence explicitly bounded to eight workflow graphs',()=>{assert.equal(x.n8nInspectedWorkflows.length,8);assert.ok(x.n8nInspectedWorkflows.every(x=>x.directNamedRpcParameterReferences===0))});
test('real UAT and production remain blocked',()=>{assert.equal(x.liveSessionEvidence,false);assert.equal(x.sameTenantStoreRlsVerified,false);assert.equal(x.productionReady,false);assert.equal(x.approvedForRealMeta,false)});
test('no token or secret values read',()=>assert.equal(x.noAccessTokenOrSecretValuesRead,true));
