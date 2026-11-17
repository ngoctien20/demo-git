import test from 'node:test';
import assert from 'node:assert/strict';
import {BASELINE,REQUIRED_PROVIDER_PROOFS,REQUIRED_JWT_PROOFS,assessGlobalCallerCoverage,assessProviderEvidence,assessPrivateJwtUat} from './external-caller-provider-jwt-gates.mjs';
test('observed inventory is not global caller certification',()=>{
 const r=assessGlobalCallerCoverage(BASELINE);assert.equal(r.status,'GLOBAL_CALLER_NO_GO');assert.equal(r.canRevokeRpc,false);assert.equal(r.globalCallerInventoryAccepted,false);
});
test('claimed complete caller inventory cannot authorize revoke',()=>{
 const r=assessGlobalCallerCoverage({...BASELINE,allProductionDeploymentsMapped:true,allWorkerDynamicRpcPathsReviewed:true,thirdPartyAndInactiveCallersIndependentlyReconciled:true});assert.equal(r.canRevokeRpc,false);assert.ok(r.issues.includes('INDEPENDENT_CROSS_PLATFORM_CALLER_ATTESTATION_REQUIRED'));
});
for(const k of Object.keys(BASELINE)){
 test('drift in '+k+' requires recheck',()=>{const v=BASELINE[k];const r=assessGlobalCallerCoverage({...BASELINE,[k]:typeof v==='number'?v+1:'FORGED'});assert.equal(r.status,'GLOBAL_CALLER_NO_GO');assert.ok(r.issues.includes('RECHECK_'+k.toUpperCase()))});
}
for(const provider of ['messenger','zalo']){
 test(provider+' native provider proof absent',()=>{const r=assessProviderEvidence(provider);assert.equal(r.canPair,false);assert.equal(r.actualProviderSignatureVerified,false)});
 test(provider+' self-reported all true still NO GO',()=>{const receipt=Object.fromEntries(REQUIRED_PROVIDER_PROOFS.map(k=>[k,true]));const r=assessProviderEvidence(provider,receipt);assert.equal(r.status,'NATIVE_SIGNATURE_NO_GO');assert.equal(r.canReadCustomerOrder,false);assert.equal(r.canSend,false)});
 for(const k of REQUIRED_PROVIDER_PROOFS)test(provider+' missing '+k+' denied',()=>{
  const receipt=Object.fromEntries(REQUIRED_PROVIDER_PROOFS.map(k=>[k,true]));receipt[k]=false;const r=assessProviderEvidence(provider,receipt);assert.ok(r.issues.includes('MISSING_'+k.toUpperCase()));
 });
}
for(const k of ['jwt','token','rawPayload','signature','secret','pageAccessToken','senderId','customerPhone','merchantId'])
 test('provider sensitive field '+k+' denied without echo',()=>{const r=assessProviderEvidence('zalo',{[k]:'PRIVATE_DO_NOT_ECHO_123'});assert.ok(r.issues.includes('SENSITIVE_OR_UNTRUSTED_INPUT_REJECTED'));assert.equal(JSON.stringify(r).includes('PRIVATE_DO_NOT_ECHO_123'),false)});
test('invalid provider denied',()=>{const r=assessProviderEvidence('fake');assert.ok(r.issues.includes('INVALID_PROVIDER'))});
test('private JWT defaults fail closed',()=>{const r=assessPrivateJwtUat();assert.equal(r.canReadOrders,false);assert.equal(r.canDeploy,false)});
test('claimed all JWT conditions cannot authorize',()=>{const r=assessPrivateJwtUat(Object.fromEntries(REQUIRED_JWT_PROOFS.map(k=>[k,true])));assert.equal(r.status,'PRIVATE_JWT_NO_GO');assert.equal(r.realSessionAdmitted,false);assert.equal(r.canReadOrders,false)});
for(const k of REQUIRED_JWT_PROOFS)test('missing JWT proof '+k+' denied',()=>{const r=assessPrivateJwtUat({});assert.ok(r.issues.includes('MISSING_'+k.toUpperCase()))});
for(const k of ['jwtA','jwtB','refreshToken','userId','storeId','customerId','authHeader','privateOwnerLedger','serviceRoleKey'])
 test('reject private JWT evidence field '+k,()=>{const r=assessPrivateJwtUat({[k]:'PRIVATE_DO_NOT_ECHO_555'});assert.ok(r.issues.includes('PRIVATE_INPUT_REJECTED'));assert.ok(!JSON.stringify(r).includes('PRIVATE_DO_NOT_ECHO_555'))});
test('all negative gates deny mutation & send',()=>{const a=assessGlobalCallerCoverage(),b=assessProviderEvidence('messenger'),c=assessPrivateJwtUat();assert.equal(a.canChangePrivilege,false);assert.equal(b.canSend,false);assert.equal(c.canWriteOrders,false);assert.equal(c.canIssueJwt,false)});
