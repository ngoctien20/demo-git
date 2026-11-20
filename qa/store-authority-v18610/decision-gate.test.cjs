'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const data=require('./n8n-rpc-static-audit.json');
const gate=require('./decision-gate.cjs');
const clone=()=>structuredClone(data);
const run=gate.assess;
const assertNoGrant=(r)=>{
  assert.equal(r.status,'NO_GO');
  for(const key of ['revokeZaloRpcAnonExecuteAllowed','applySupabaseMigrationAllowed',
   'changeProductRpcAllowed','rewirePublishedMessengerAllowed','grantStoreAuthorityAllowed',
   'realOwnerAbUatApproved','providerSendAllowed','productionReady'])assert.equal(r[key],false,key);
};
test('bundled evidence is valid source-only with complete current n8n list scan',()=>{assert.equal(gate.validate(data),true);assert.equal(gate.cohortsValid(data.scope),true)});
test('171/171 inspected, 22 active, 149 inactive; exact single literal RPC reference',()=>{assert.equal(data.scope.totalGraphDetailsRead,171);assert.equal(data.scope.activeListed,22);assert.equal(data.scope.inactiveListed,149);assert.equal(data.literalRpcReferences.length,1)});
test('one literal published caller is Zalo Shop B, no execution proof',()=>{const x=data.literalRpcReferences[0];assert.equal(x.rpc,'qa_shop_b_zalo_claim');assert.equal(x.actualRpcExecutionVerified,false);assert.equal(x.scope,'published');assert.equal(x.active,true)});
test('previous direct-call absences never prove external no-callers',()=>{assert.deepEqual(data.noDirectLiteralReferencesFoundFor,['save_merchant_product','qa_owner_pairing']);assert.ok(data.doesNotProve.includes('NO_EXTERNAL_RENDER_OR_CLOUDFLARE_CALLERS'))});
test('plain valid evidence always denies live release',()=>assertNoGrant(run()));
test('all-green backup/approval/role flags still cannot authorize live work',()=>{
 const s=clone();for(const k of Object.keys(s.backup)){if(typeof s.backup[k]==='boolean')s.backup[k]=true};for(const k of Object.keys(s.decisions)){if(typeof s.decisions[k]==='boolean')s.decisions[k]=true};const r=run(s);assertNoGrant(r)
});
test('no backup entitlement or PITR proof',()=>{const b=data.backup;assert.equal(b.planTierVerified,false);assert.equal(b.pitrEnabledVerified,false);assert.equal(b.restoreDrillPassed,false)});
test('recommended Store SKU is not a user approval',()=>assert.equal(data.decisions.storeLocalSku,'RECOMMENDED_NOT_APPROVED'));
test('tenant owner and store_owner remain distinct',()=>{assert.equal(data.decisions.tenantOwnerRole,'owner');assert.equal(data.decisions.canonicalStoreOwnerRole,'store_owner')});
test('source-only results never leak secrets or user identifiers',()=>{
 const s=JSON.stringify(run());for(const k of ['authorization','email','refreshToken','accessToken','secret','phone','customerId','jwt','sessionId'])assert.ok(!s.includes(k),k)
});
test('no production or provider effect occurred',()=>assert.ok(Object.values(data.safety).every(x=>x===0)));
test('zero scan gaps with ordered cohorts',()=>{const c=data.scope.scanCohorts;assert.equal(c[0].start,0);assert.equal(c.at(-1).end,170)});
for(const [label,path,value] of [
 ['version','version','V18.6.9'],['classification','classification','AUTHORITATIVE_BACKUP_PROOF'],['method','method','CLIENT_ASSERTED'],
 ['workflow-count','scope.totalListed',170],['inspected','scope.totalGraphDetailsRead',170],['active','scope.activeListed',21],
 ['inactive','scope.inactiveListed',148],['failures','scope.readFailures',1],
 ['cohort-gap','scope.scanCohorts.2.start',37],['cohort-overlap','scope.scanCohorts.3.start',53],
 ['cohort-size','scope.scanCohorts.5.inspected',17],['cohort-count','scope.scanCohorts.8.rpcMatches',1],
 ['rpc-name','literalRpcReferences.0.rpc','save_merchant_product'],
 ['rpc-workflow','literalRpcReferences.0.workflowId','different-id'],
 ['rpc-node','literalRpcReferences.0.nodeName','unknown node'],
 ['rpc-parent','literalRpcReferences.0.parentPublishedWorkflowId','wrong-id'],
 ['rpc-executed','literalRpcReferences.0.actualRpcExecutionVerified',true],
 ['rpc-scope','literalRpcReferences.0.scope','draft'],
 ['sku-constraint','supabase.skuConstraint','UNIQUE(tenant_id,store_id,sku)'],
 ['supabase-schema','supabase.canonicalStoreTables',2],
 ['backup-status','backup.status','VERIFIED_BACKUP'],
 ['role-owner','decisions.canonicalStoreOwnerRole','owner'],
 ['ref-pg','decisions.disposableFullDmlPgtapPr',420],
 ['effect','safety.supabaseMigrationsApplied',1]
]){
 test(`tampering ${label} invalidates audit and refuses deployment`,()=>{
  const s=clone();const p=path.split('.');let x=s;for(let i=0;i<p.length-1;i++)x=x[p[i]];x[p.at(-1)]=value;
  assertNoGrant(run(s));assert.equal(gate.validate(s),false,label)
 });
}
test('unknown/corrupt snapshot always fails closed',()=>{for(const x of [null,[],{},'invalid',0,NaN])assertNoGrant(run(x))});
test('empty missing cohorts always fails closed',()=>{const s=clone();s.scope.scanCohorts=[];assertNoGrant(run(s))});
test('an added second direct caller invalidates old snapshot rather than pretending completeness',()=>{const s=clone();s.literalRpcReferences.push({...s.literalRpcReferences[0],workflowId:'another'});assert.equal(gate.validate(s),false);assertNoGrant(run(s))});
test('provider send and real UAT cannot be enabled through optional input',()=>{const s=clone();s.extra={force:true,productionReady:true};assertNoGrant(run(s))});
