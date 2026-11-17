import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPECTED_RPC_METADATA,PUBLISHED_CALLER_CHAIN,REAL_JWT_UAT_CASES,inspectRpcSurface,inspectCallerChain,inspectRealJwtAdmission} from './rpc-caller-admission.mjs';
test('actual bounded RPC metadata produces review not permission',()=>{
 const x=inspectRpcSurface(EXPECTED_RPC_METADATA);
 assert.equal(x.status,'REVIEW_REQUIRED');assert.equal(x.canRevoke,false);assert.equal(x.canRunRpc,false);assert.equal(x.canDeploy,false);
 assert.ok(x.blockers.includes('ANON_SECURITY_DEFINER_REVIEW_qa_shop_b_zalo_claim'));
 assert.ok(x.blockers.includes('STORE_AUTHORITY_GAP_save_merchant_product'));
});
test('Vault guard observed is not native provider signature proof',()=>{
 const x=inspectRpcSurface(EXPECTED_RPC_METADATA);assert.equal(x.cryptographicProviderSourceVerified,false);
 assert.ok(!x.blockers.includes('PUBLIC_PRIVILEGED_RPC_NO_KNOWN_GATE_qa_shop_b_zalo_claim'));
});
test('known V1 to V2 caller chain is protected from blind revoke',()=>{
 const x=inspectCallerChain(PUBLISHED_CALLER_CHAIN);assert.equal(x.boundedDirectCount,1);assert.equal(x.boundedParentCount,1);assert.equal(x.canRevoke,false);assert.equal(x.callerInventoryExhaustive,false);
});
test('broken published caller chain triggers blocker',()=>{
 assert.ok(inspectCallerChain([]).blockers.includes('KNOWN_PUBLISHED_RPC_CALLER_NOT_CONFIRMED'));
});
for(const key of ['qa_shop_b_zalo_claim','qa_owner_pairing','save_merchant_product']){
 test('deleting known RPC is not clean admission '+key,()=>{
  const x=inspectRpcSurface(EXPECTED_RPC_METADATA.filter(v=>v.name!==key));assert.ok(x.blockers.includes('EXPECTED_RPC_MISSING_'+key));
 });
}
test('unexpected anon security definer without guard flagged',()=>{
 const x=inspectRpcSurface([...EXPECTED_RPC_METADATA,{...EXPECTED_RPC_METADATA[0],name:'unknown_public_rpc',vaultHeaderGuard:false}]);
 assert.ok(x.blockers.includes('PUBLIC_PRIVILEGED_RPC_NO_KNOWN_GATE_unknown_public_rpc'));
});
test('duplicate metadata rejected',()=>{
 const x=inspectRpcSurface([...EXPECTED_RPC_METADATA,EXPECTED_RPC_METADATA[0]]);assert.ok(x.blockers.includes('MALFORMED_OR_DUPLICATE_RPC'));
});
test('16 UAT cases are unique',()=>{assert.equal(REAL_JWT_UAT_CASES.length,16);assert.equal(new Set(REAL_JWT_UAT_CASES.map(x=>x[0])).size,16);assert.equal(REAL_JWT_UAT_CASES.filter(x=>x[2]==='DENY').length,14)});
test('default public JWT admission stays no-go',()=>{
 const x=inspectRealJwtAdmission();assert.equal(x.status,'HOSTED_NO_GO');assert.equal(x.canReadOrder,false);assert.equal(x.canRunHosted,false);
});
test('even self-claimed owner metadata cannot authorize',()=>{
 const x=inspectRealJwtAdmission({testMode:'NO_SEND_READ_ONLY',ownerApproval:'PRIVATE_EXTERNAL_VERIFIER_REQUIRED',m0Status:'NOT_ACCEPTED'});
 assert.equal(x.realJwtVerified,false);assert.equal(x.realStoreABVerified,false);assert.equal(x.canRunHosted,false);assert.equal(x.canRevokeRpc,false);
});
for(const key of ['jwt','access_token','refresh_token','service_role','raw_provider_event','phone','merchant_document','raw_signature','store_id','user_metadata','customer_data']){
 test('reject sensitive input '+key,()=>{
  const x=inspectRealJwtAdmission({testMode:'NO_SEND_READ_ONLY',ownerApproval:'PRIVATE_EXTERNAL_VERIFIER_REQUIRED',m0Status:'NOT_ACCEPTED',[key]:'SENSITIVE_DO_NOT_ECHO_1234'});
  assert.ok(x.blockers.includes('PRIVATE_CREDENTIAL_OR_CLIENT_CLAIM_REJECTED'));
  assert.equal(JSON.stringify(x).includes('SENSITIVE_DO_NOT_ECHO_1234'),false);
 });
}
for(const operation of ['WRITE','SEND','DEPLOY','MIGRATE']){
 test('disallow non-no-send operation '+operation,()=>{
  const x=inspectRealJwtAdmission({testMode:operation});
  assert.ok(x.blockers.includes('ONLY_READ_ONLY_NO_SEND'));
  assert.equal(x.canSend,false);assert.equal(x.canDeploy,false);
 });
}
