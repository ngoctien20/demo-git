'use strict';
/**
 * TIEN404 V15.2-ADV.5D — public metadata preflight + PRIVATE EVIDENCE RECEIPTS.
 * Source only, no Supabase/HTTP/JWT/secret processing. An evidence receipt
 * records an out-of-band fingerprint, NOT the private evidence bytes or
 * authority proof; this module cannot grant Owner rights or release approvals.
 *
 * Never put real JWTs, OAuth callbacks, OTPs, access tokens, customer data,
 * backup archives, signer private keys or Vault values in this input.
 */
const {GATES: ADV5C_GATES}=require('./advanced-merchant-uat-independent-review.cjs');
const CONTRACT='T404_ADV5D_HOSTED_PRIVATE_RECEIPT_GATE_V1';
const HEX64=/^[a-f0-9]{64}$/;
const HEX32=/^[a-f0-9]{32}$/;
const BASELINE=Object.freeze({
  projectRef:'ifxlvrhyjhbzbrkdsida',
  rpc:'public.qa_shop_b_zalo_claim(uuid,text,text,text)',
  digestMd5:'37f127c1475378b2810197961398d945',
  delegated:'tien404_r1_qa.claim_owner_pairing_v3_synthetic(text,text,text,uuid,text,text,text)',
  observedSqlScope:'READ_ONLY_HOSTED_METADATA'
});
const RECEIPT_TYPES=Object.freeze([
 'RPC_AUTHORITY_REVIEW','RPC_CALLER_DEPENDENCY','STORE_MERCHANT_OWNERSHIP',
 'SHOP_A_JWT_RLS','SHOP_B_JWT_RLS','SHOP_C_NEGATIVE_JWT_RLS',
 'SAME_TENANT_CROSS_STORE_DENY','CROSS_TENANT_DENY',
 'BACKUP_RESTORE_APPROVAL','INDEPENDENT_SECURITY_REVIEW'
]);
const expectedFields=(x,fields)=>x&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype&&
 Object.keys(x).length===fields.length&&fields.every(k=>Object.hasOwn(x,k));
const freeze=(x)=>Object.freeze(x);
const invalid=(reason)=>freeze({contract:CONTRACT,status:'REJECTED',reason,
 evidenceAuthenticated:false,independentApproval:false,canTestRealJwt:false,
 releaseAuthorized:false,canChangeRpcGrant:false,canChangeHostedRls:false,
 canUseCustomerData:false,canSendProviderMessage:false});
/**
 * Only metadata already retrieved through read-only SQL. Never source code,
 * Vault values, tokens, caller IDs, request body or table rows.
 */
function checkHostedRpcMetadata(x){
 const fields=['projectRef','signature','functionDigestMd5','ownerRole','securityDefiner',
  'searchPathRestricted','anonExecute','anonExplicitGrant','publicExecute',
  'authenticatedExecute','vaultGuardPresent','callerInputValidated',
  'hmacPresent','delegatedPrivateInvoker','observedScope'];
 if(!expectedFields(x,fields))return invalid('RPC_METADATA_SCHEMA_INVALID');
 if(x.projectRef!==BASELINE.projectRef||x.signature!==BASELINE.rpc||
  !HEX32.test(x.functionDigestMd5)||x.ownerRole!=='postgres'||
  x.observedScope!=='READ_ONLY_HOSTED_METADATA')return invalid('RPC_BASELINE_OR_PROVENANCE_MISMATCH');
 const flags=fields.filter(k=>typeof x[k]==='boolean');
 if(flags.length!==10)return invalid('RPC_FLAG_TYPE_INVALID');
 if(x.functionDigestMd5!==BASELINE.digestMd5)return freeze({
  ...invalid('FUNCTION_BODY_DRIFT_REQUIRES_REAUDIT'),
  fingerprintObserved:x.functionDigestMd5});
 const mitigations=freeze({
  searchPathRestricted:x.searchPathRestricted,
  vaultGuardPresent:x.vaultGuardPresent,
  callerInputValidated:x.callerInputValidated,
  hmacPresent:x.hmacPresent,
  delegatedPrivateInvoker:x.delegatedPrivateInvoker
 });
 const directExposure=x.securityDefiner&&x.anonExecute;
 return freeze({contract:CONTRACT,status:directExposure?
  'PRIVILEGED_ANON_RPC_REVIEW_REQUIRED':'RPC_ACCESS_CHANGED_REAUDIT_REQUIRED',
  fingerprint:BASELINE.digestMd5,aclGrantToAnon:x.anonExplicitGrant,
  anonExecute:x.anonExecute,publicExecute:x.publicExecute,
  authenticatedExecute:x.authenticatedExecute,definerOwnerRole:x.ownerRole,
  mitigations,knownExploitDemonstrated:false,
  bypassProven:false,attackerAuthenticated:false,
  evidenceAuthenticated:false,independentApproval:false,
  canCallRpc:false,canChangeRpcGrant:false,releaseAuthorized:false
 });
}
/** Carefully limited receipt catalog for privately stored proofs. */
function checkPrivateReceipt(x){
 const fields=['contract','type','evidenceSha256','receiptNonce','issuerClass',
  'obtainedAt','privateStoreVerifiedOutOfBand','reviewedByIndependentAuthority'];
 if(!expectedFields(x,fields)||x.contract!==CONTRACT||
  !RECEIPT_TYPES.includes(x.type)||!HEX64.test(x.evidenceSha256)||
  !HEX32.test(x.receiptNonce)||!['OWNER_OPERATOR','SECURITY_REVIEWER','TEST_OPERATOR','BACKUP_OPERATOR'].includes(x.issuerClass)||
  typeof x.obtainedAt!=='string'||!/^20\d{2}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(x.obtainedAt)||
  Number.isNaN(Date.parse(x.obtainedAt))||
  x.privateStoreVerifiedOutOfBand!==true && x.privateStoreVerifiedOutOfBand!==false||
  typeof x.reviewedByIndependentAuthority!=='boolean')
    return invalid('PRIVATE_RECEIPT_SCHEMA_OR_DIGEST_INVALID');
 // The two Boolean assertions are just untrusted JSON, NEVER proof.
 return freeze({contract:CONTRACT,status:'METADATA_RECEIPT_ACCEPTED_PENDING_PRIVATE_REVIEW',
   type:x.type,evidenceSha256:x.evidenceSha256,
   independentReviewClaimed:x.reviewedByIndependentAuthority,
   privateStorageClaimed:x.privateStoreVerifiedOutOfBand,
   independentReviewVerified:false,privateStorageVerified:false,
   verifiedByTrustedSystem:false,canTestRealJwt:false,
   hostedRlsCertified:false,ownerG23Certified:false,releaseAuthorized:false});
}
function evaluateHostedStoreReadiness(x){
 if(!expectedFields(x,['projectRef','tables','storeScopedColumns','rlsEnabled',
  'signedJwtProofActuallyPerformed','sameTenantNegativeCasesPassed',
  'crossTenantNegativeCasesPassed','observedScope'])||
  x.projectRef!==BASELINE.projectRef||x.observedScope!=='READ_ONLY_HOSTED_METADATA'||
  !expectedFields(x.tables,['stores','storeMemberships'])||
  !expectedFields(x.storeScopedColumns,['orders','products','orderItems'])||
  !expectedFields(x.rlsEnabled,['orders','products','orderItems'])||
  [...Object.values(x.tables),...Object.values(x.storeScopedColumns),
   ...Object.values(x.rlsEnabled),
   x.signedJwtProofActuallyPerformed,x.sameTenantNegativeCasesPassed,
   x.crossTenantNegativeCasesPassed].some(v=>typeof v!=='boolean'))
    return invalid('HOSTED_STORE_METADATA_SCHEMA_INVALID');
 const structuralMissing=Object.values(x.tables).some(v=>!v)||Object.values(x.storeScopedColumns).some(v=>!v);
 const rlsMissing=Object.values(x.rlsEnabled).some(v=>!v);
 const claimedProof=x.signedJwtProofActuallyPerformed&&
   x.sameTenantNegativeCasesPassed&&x.crossTenantNegativeCasesPassed;
 return freeze({
  contract:CONTRACT,status:structuralMissing?'STORE_SCHEMA_MISSING':
   rlsMissing?'STORE_RLS_INCOMPLETE':
   claimedProof?'PRIVATE_JWT_PROOF_REQUIRES_TRUSTED_INDEPENDENT_VERIFICATION':
   'REAL_HOSTED_JWT_NEGATIVE_PROOF_REQUIRED',
  structurallyReady:!structuralMissing,rlsEnabledAll:!rlsMissing,
  claimedJwtProof:claimedProof,realJwtProofIndependentlyVerified:false,
  canTestRealJwt:false,tenantScopedRlsIsNotStoreRls:true,
  canChangeHostedRls:false,canChangeStoreSchema:false,
  storeAorBAccessCertified:false,releaseAuthorized:false});
}
function buildDecision({rpc,store,receipts=[]}={}){
 const rpcResult=checkHostedRpcMetadata(rpc);
 const storeResult=evaluateHostedStoreReadiness(store);
 if(!Array.isArray(receipts)||receipts.length>20)return invalid('RECEIPT_LIST_INVALID');
 const inspected=receipts.map(checkPrivateReceipt);
 if(inspected.some(r=>r.status==='REJECTED'))return invalid('UNTRUSTED_OR_INVALID_RECEIPT');
 const seen=new Set();
 for(const entry of inspected){
  if(seen.has(entry.evidenceSha256))return invalid('DUPLICATE_EVIDENCE_FINGERPRINT');
  seen.add(entry.evidenceSha256);
 }
 return freeze({
  contract:CONTRACT,lifecycle:'CANDIDATE',
  status:'PRIVATE_REVIEW_INTAKE_ONLY',decision:'NO_GO_HOSTED_OR_PRODUCTION',
  rpcStatus:rpcResult.status,storeStatus:storeResult.status,
  receiptTypes:freeze(inspected.map(x=>x.type)),
  receiptCount:inspected.length,
  privateEvidenceBytesReceived:false,realJwtOrOtpReceived:false,
  independentAttestationAccepted:false,merchantOwnerVerified:false,
  securityP0Cleared:false,jwtRlsCertified:false,
  gates:freeze(ADV5C_GATES.map(g=>freeze({...g}))),
  releaseAuthorized:false,publicStagingAuthorized:false,
  canChangeRpcGrant:false,canChangeHostedRls:false,
  canCreateOrReadCustomerOrder:false,
  providerSends:0,hostedWrites:0,paidModelCalls:0,paidSpendVnd:0
 });
}
module.exports=freeze({CONTRACT,BASELINE,RECEIPT_TYPES,
 checkHostedRpcMetadata,checkPrivateReceipt,evaluateHostedStoreReadiness,buildDecision});
