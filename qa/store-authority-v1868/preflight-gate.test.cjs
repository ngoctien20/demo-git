'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {evaluate,evaluateBundled,DENIAL,ALL_APPROVAL_KEYS}=require('./preflight-gate.cjs');
const original=require('./staging-metadata.snapshot.json');
const copy=()=>JSON.parse(JSON.stringify(original));
const checkBlocked=(o)=>{assert.equal(o.status,'BLOCKED');assert.equal(o.deployApproved,false);assert.equal(o.databaseMutationApproved,false);assert.equal(o.accessGrantChangeApproved,false);assert.equal(o.privilegedRpcChangeApproved,false);assert.equal(o.publishedWorkflowChangeApproved,false);assert.equal(o.realOwnerABApproved,false);assert.equal(o.productionReady,false);assert.equal(o.externalAttestationRequired,true)};
test('bundled staging facts are fail-closed',()=>{const x=evaluateBundled();checkBlocked(x);assert.equal(x.validMetadata,true);assert.ok(x.blockers.length>=9)});
test('snapshot owns six explicit Commerce table names',()=>assert.deepEqual(original.expectedCommerceTables,['products','customers','orders','order_items','conversations','messages']));
test('real staging 0 of 2 Store registries',()=>assert.equal(original.canonicalTablesFound,0));
test('real staging 0 of 6 store_id columns',()=>assert.equal(original.commerceTablesWithStoreId,0));
test('real staging 0 restrictive public policies',()=>assert.equal(original.publicRestrictivePolicies,0));
test('actual product sku is tenant-scoped',()=>assert.equal(original.productSkuConstraint,'UNIQUE (tenant_id, sku)'));
test('two aggregates, no personal data',()=>assert.equal(original.commerceRowsAggregate.products+original.commerceRowsAggregate.orders,4));
test('privileged product writer has both DML paths',()=>{assert.equal(original.privilegedProductWriter.performsInsert,true);assert.equal(original.privilegedProductWriter.performsUpdate,true);assert.equal(original.privilegedProductWriter.storeAware,false)});
test('writer caller graph explicitly incomplete',()=>assert.equal(original.privilegedProductWriter.callerInventoryExhaustive,false));
test('Render and Worker real Auth are not claimed verified',()=>{assert.equal(original.otherPaths.renderDeployedSourceVerified,false);assert.equal(original.otherPaths.realSupabaseAuthOnWorkerVerified,false)});
test('Messenger DEMO stays independent of Commerce',()=>{assert.equal(original.otherPaths.publishedMessengerDemoWriters,3);assert.equal(original.otherPaths.demoSeparateFromCommerce,true)});
test('SKU, backup and real Auth await approval',()=>assert.equal(original.approval.skuScopeD02Approved||original.approval.backupRestoreVerified||original.approval.ownerABRealSessionsVerified,false));
for(const [n,v] of Object.entries({blank:null,list:[],untrusted:{...copy(),source:'WEB_CLIENT_BODY'},wrongScope:{...copy(),scope:'auth'},missingBody:{...copy(),approval:null},writeClaim:{...copy(),privilegedProductWriter:{...copy().privilegedProductWriter,stagingSchemaWriteExecuted:true}},wrongTypes:{...copy(),publicRestrictivePolicies:'6'},wrongNames:{...copy(),expectedCommerceTables:['products']},negative:{...copy(),canonicalTablesFound:-1}})){
 test('invalid '+n+' snapshot denied',()=>{const r=evaluate(v);checkBlocked(r);assert.equal(r.validMetadata,false);assert.deepEqual(r.blockers,['SNAPSHOT_INVALID'])});
}
for(const [n,patch,expected] of [
 ['store tables',{canonicalTablesFound:2},DENIAL.COMMERCE_STORE_SCOPE_MISSING],
 ['store columns',{commerceTablesWithStoreId:6},DENIAL.STORE_TABLES_MISSING],
 ['rls',{publicRestrictivePolicies:6},DENIAL.STORE_TABLES_MISSING],
 ['more rows',{commerceRowsAggregate:{...copy().commerceRowsAggregate,products:400}},DENIAL.STORE_TABLES_MISSING],
 ['save rpc store aware',{privilegedProductWriter:{...copy().privilegedProductWriter,storeAware:true}},DENIAL.RPC_CALLER_INVENTORY_INCOMPLETE],
 ['render proof',{otherPaths:{...copy().otherPaths,renderDeployedSourceVerified:true}},DENIAL.LIVE_AUTH_WORKER_UNVERIFIED]
]){
 test('partial '+n+' progress still blocked',()=>{const r=evaluate({...copy(),...patch});checkBlocked(r);assert.ok(r.blockers.includes(expected))});
}
test('even all snapshot approvals and evidence flags cannot authorize deployment',()=>{
 const v=copy();v.canonicalTablesFound=2;v.commerceTablesWithStoreId=6;v.publicRestrictivePolicies=6;
 v.productSkuConstraint='UNIQUE NULLS NOT DISTINCT (tenant_id, store_id, sku)';
 Object.assign(v.privilegedProductWriter,{storeAware:true,callerInventoryExhaustive:true});
 Object.assign(v.otherPaths,{renderDeployedSourceVerified:true,realSupabaseAuthOnWorkerVerified:true});
 for(const k of ALL_APPROVAL_KEYS)v.approval[k]=true;
 const r=evaluate(v);checkBlocked(r);assert.deepEqual(r.blockers,['INDEPENDENT_ATTESTATION_REQUIRED']);
});
test('no live changes can be inferred from pure module import',()=>{let x=require('./preflight-gate.cjs');assert.equal(typeof x.evaluate,'function');assert.equal(Object.hasOwn(x,'publish'),false);assert.equal(Object.hasOwn(x,'migrate'),false)});
test('the metadata SQL consists only of SELECT statements',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'read-only-preflight.sql'),'utf8');
 const cleaned=sql.split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
 const stmts=cleaned.split(';').map(s=>s.trim()).filter(Boolean);
 assert.equal(stmts.length,7);for(const st of stmts)assert.match(st,/^SELECT\s/i);
 assert.doesNotMatch(cleaned,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE|COPY|DO|CALL|EXECUTE|SET|MERGE)\s/i);
});
test('metadata SQL avoids private schemas and secret key values',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'read-only-preflight.sql'),'utf8');
 for(const s of ['auth.users','vault.decrypted_secrets','app_private.audit_events','service_role','refresh_token','customer.phone'])assert.equal(sql.includes(s),false,s);
});
test('no private IDs or email addresses bundled in snapshot',()=>{
 const str=JSON.stringify(original);assert.doesNotMatch(str,/\b[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}\b/);
 assert.doesNotMatch(str,/@gmail\.com|@example\.com|Bearer\s+|SUPABASE_SERVICE_ROLE/i);
});
