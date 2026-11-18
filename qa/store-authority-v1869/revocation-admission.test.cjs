'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {assess,assessBundled,K}=require('./revocation-admission.cjs');
const data=require('./caller-evidence.json');
const copy=()=>JSON.parse(JSON.stringify(data));
function noGo(x){assert.equal(x.status,'NO_GO');for(const [k,v] of Object.entries(x))if(k.endsWith('Allowed')||k==='productionReady'||k==='oauthLiveAllowed'||k==='verifiedExecutionOfRpc'||k==='validatedRealOwnerSessions')assert.equal(v,false,k)}
test('bundled metadata has no release authority',()=>noGo(assessBundled()));
test('source reports 170 n8n workflows, 22 active inspected',()=>{assert.equal(data.n8n.workflowsListed,170);assert.equal(data.n8n.activeWorkflows,22);assert.equal(data.n8n.activeWorkflowsGraphInspected,22)});
test('n8n active scan does not prove other callers absent',()=>assert.equal(data.n8n.activeGraphScanDoesNotProveAllCallersFound,true));
test('inactive nodes not comprehensively audited',()=>assert.equal(data.n8n.inactiveWorkflowsNotExhaustivelyInspected,true));
test('source clearly distinguishes Graph from execution',()=>{assert.equal(data.classification,'PARTIAL_RUNTIME_GRAPH_AND_METADATA_NOT_EXECUTION_PROOF');assert.equal(data.n8n.claimCaller.newWebhookExecutionVerified,false);assert.equal(data.n8n.executionMetadata.doesNotProveRpcRan,true)});
test('current published parent Zalo Bot is linked',()=>{assert.equal(data.n8n.claimCaller.parentWorkflowId,'yIJk8LvJoLF40Z62');assert.equal(data.n8n.claimCaller.parentCallerNode,'Zalo V2 Shadow (Owner Gate Only)');assert.equal(data.n8n.claimCaller.parentActive,true);assert.equal(data.n8n.claimCaller.parentCallerEnabled,true)});
test('current published child shadow has active RPC call',()=>{assert.equal(data.n8n.claimCaller.childWorkflowId,'OgDZNSAvKEvhnAvn');assert.equal(data.n8n.claimCaller.childRpcNode,'Submit pending claim for Shop B');assert.equal(data.n8n.claimCaller.childActive,true);assert.equal(data.n8n.claimCaller.childRpcNodeEnabled,true)});
test('HTTP POST to correct QA claim RPC only',()=>{assert.equal(data.n8n.claimCaller.httpMethod,'POST');assert.equal(data.n8n.claimCaller.rpcName,'qa_shop_b_zalo_claim');assert.equal(data.n8n.claimCaller.requestSource,'SUPABASE_REST_RPC_ENDPOINT')});
test('anonymous EXECUTE RPC is SECURITY DEFINER',()=>{assert.equal(data.supabase.publicClaimAnonExecutable,true);assert.equal(data.supabase.publicClaimSecurityDefiner,true)});
test('Vault header guard exists but does not prove Webhook source',()=>{assert.equal(data.supabase.publicClaimVaultHeaderGuardObserved,true);assert.equal(data.n8n.claimCaller.pageOrOwnerSessionVerified,false)});
test('real product writer lacks Store scope',()=>assert.equal(data.supabase.privilegedProductWriterStoreScoped,false));
test('real schema Store still absent',()=>{assert.equal(data.supabase.canonicalStoreTableCount,0);assert.equal(data.supabase.commerceStoreIdColumns,0);assert.equal(data.supabase.restrictivePublicPolicies,0)});
test('Store-local SKU is only recommendation',()=>{assert.equal(data.decisions.recommendedSkuScope,'STORE_LOCAL');assert.equal(data.decisions.skuScopeD02,'PENDING_OWNER_APPROVAL')});
test('tenant owner and store_owner are distinct scopes',()=>{assert.equal(data.decisions.canonicalStoreRole,'store_owner');assert.equal(data.decisions.tenantOwnerRole,'owner');assert.notEqual(data.decisions.tenantOwnerRole,data.decisions.canonicalStoreRole)});
test('there is no approved role mapping',()=>assert.equal(data.decisions.mappingApproved,false));
test('backup/restore evidence absent',()=>assert.equal(data.decisions.backupAndRestoreProven,false));
test('Render live source not verified',()=>assert.equal(data.decisions.renderDeployedWriterSourcesReviewed,false));
test('no actions actually performed by this candidate',()=>assert.ok(Object.values(data.safety).every(v=>v===false)));
test('caller blocks blind RPC revoke',()=>{const r=assessBundled();noGo(r);assert.ok(r.blockers.includes(K.ACTIVE_RPC_CALLER))});
test('restore proof blocks migration',()=>{const r=assessBundled();assert.ok(r.blockers.includes(K.BACKUP));noGo(r)});
test('absence of Store authority blocks Store UAT',()=>{const r=assessBundled();assert.ok(r.blockers.includes(K.STORE_SCHEMA))});
test('source-only claims cannot approve live Meta',()=>{const r=assessBundled();assert.equal(r.oauthLiveAllowed,false)});
for(const [label,patch] of Object.entries({
 invalidNull:null,invalidArray:[],invalidVersion:{...copy(),version:'V18.6.10'},
 invalidClass:{...copy(),classification:'HOSTED_VERIFIED'},
 malformedCount:{...copy(),n8n:{...copy().n8n,activeWorkflows:0}},
 missingChild:{...copy(),n8n:{...copy().n8n,claimCaller:null}},
 fakeRpc:{...copy(),n8n:{...copy().n8n,claimCaller:{...copy().n8n.claimCaller,rpcName:'not_real'}}},
 fakeHttp:{...copy(),n8n:{...copy().n8n,claimCaller:{...copy().n8n.claimCaller,httpMethod:'GET'}}},
 fakeSafety:{...copy(),safety:{...copy().safety,providerMessagesSent:true}}
}))test('malformed '+label+' cannot approve anything',()=>{const r=assess(patch);noGo(r);assert.equal(r.code,K.INVALID)});
for(const [label,change] of Object.entries({
 ownerDecided:{decisions:{...copy().decisions,skuScopeD02:'APPROVED_STORE_LOCAL'}},
 roleDecided:{decisions:{...copy().decisions,roleContractApproved:true,mappingApproved:true,lastActiveStoreOwnerProtectionApproved:true}},
 backupClaimed:{decisions:{...copy().decisions,backupAndRestoreProven:true}},
 renderClaimed:{decisions:{...copy().decisions,renderDeployedWriterSourcesReviewed:true}},
 schemaClaimed:{supabase:{...copy().supabase,canonicalStoreTableCount:2,commerceStoreIdColumns:6,restrictivePublicPolicies:6}},
 noActiveCallerClaimed:{n8n:{...copy().n8n,claimCaller:{...copy().n8n.claimCaller,parentActive:false,childActive:false}}},
 allProofsClaimed:{decisions:{...copy().decisions,skuScopeD02:'APPROVED_STORE_LOCAL',roleContractApproved:true,mappingApproved:true,lastActiveStoreOwnerProtectionApproved:true,backupAndRestoreProven:true,renderDeployedWriterSourcesReviewed:true,rpcCallerInventoryComplete:true},supabase:{...copy().supabase,canonicalStoreTableCount:2,commerceStoreIdColumns:6,restrictivePublicPolicies:6,privilegedProductWriterStoreScoped:true},n8n:{...copy().n8n,activeGraphScanDoesNotProveAllCallersFound:false,claimCaller:{...copy().n8n.claimCaller,parentActive:false,childActive:false,possiblePrivateQaWrite:false,pageOrOwnerSessionVerified:true}}}
}))test('self-declared '+label+' still cannot authorize release',()=>{const x=assess({...copy(),...change});noGo(x);assert.ok(x.blockers.includes(K.PRIVATE_APPROVAL))});
test('output never includes token, email, header, or identity',()=>{const s=JSON.stringify(assessBundled());for(const key of ['accessToken','refreshToken','sessionId','privateEmail','jwt','password','clientSecret','rawHeader'])assert.equal(s.includes(key),false,key)});
test('no source fixture secrets, PII or token values',()=>{const s=JSON.stringify(data);assert.doesNotMatch(s,/Bearer\s+|@gmail\.com|@example\.com|api[_-]?key|\beyJ[a-zA-Z0-9_-]{24,}/i)});
test('no deployment, network client, SQL writer exported',()=>{const m=require('./revocation-admission.cjs');for(const k of ['deploy','migrate','run','publish','revoke','grant','callRpc'])assert.equal(Object.hasOwn(m,k),false)});
test('source remains pure node metadata without http modules',()=>{const s=fs.readFileSync(path.join(__dirname,'revocation-admission.cjs'),'utf8');assert.doesNotMatch(s,/\brequire\(['"](?:https?|undici|child_process|pg)['"]\)/);assert.doesNotMatch(s,/\bfetch\s*\(/)});
