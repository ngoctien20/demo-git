'use strict';
/**
 * TIEN404 V15.2 ADV.5E — source-only RPC remediation DECISION PACK, not executor.
 * There is intentionally no code path to trigger Supabase writes, migrations,
 * JWT issuance, back-ups, GRANT changes, real queries or external network.
 * A private reviewer signature or user-provided "approved" field here is NOT
 * a trusted host action. All live gates require external verification & approval.
 */
const {checkHostedRpcMetadata,evaluateHostedStoreReadiness,checkPrivateReceipt,BASELINE}=require('./advanced-hosted-rpc-store-private-intake.cjs');
const CONTRACT='T404_ADV5E_RPC_REMEDIATION_AND_JWT_HOSTED_GATE_V1';
const DECISION='NO_GO_HOSTED_EXECUTION_OR_PRODUCTION';
const SCOPES=Object.freeze(['RPC_SECURITY_CHANGE','HOSTED_STORE_SCHEMA_CHANGE','REAL_JWT_RLS_TEST',
 'BACKUP_OR_RESTORE','CHANNEL_PUBLIC_RELEASE']);
const OPTIONS=Object.freeze({
 KEEP_AND_HARDEN:Object.freeze({
  status:'PROPOSED_ALTERNATIVE_NOT_AUTHORIZED',risk:'PRIVILEGED_ANON_ENTRY_REMAINS',
  need:'Independently verify caller identity, rate limits, Vault claim, nonce replay, function grants and provider callback'}),
 MIGRATE_PRIVATE_GATEWAY:Object.freeze({
  status:'PREFERRED_DESIGN_NOT_AUTHORIZED',risk:'BREAKING_CHANGE_IF_CALLERS_EXIST',
  need:'Inventory all callers, shadow synthetic gateway, signed provider ingress, durable nonce, independent review and reversible cutover'}),
 ISOLATE_TEMPORARILY:Object.freeze({
  status:'EMERGENCY_OPTION_NOT_AUTHORIZED',risk:'BREAKS_OWNER_PAIRING_IF_CALLED',
  need:'Separate incident authority, verified exploit/abuse evidence, impact assessment and tested rollback'})
});
const REQUIREMENTS=Object.freeze([
 Object.freeze({id:'R01_RPC_FINGERPRINT',area:'RPC',need:'Hosted function hash & ACL must match audited baseline'}),
 Object.freeze({id:'R02_TRUSTED_INBOUND_IDENTITY',area:'RPC',need:'Verified provider request origin and server-only secret source, not user-controlled JSON'}),
 Object.freeze({id:'R03_CALLER_INVENTORY',area:'RPC',need:'Reviewed n8n/Worker/backend callers & fallback path'}),
 Object.freeze({id:'R04_INDEPENDENT_SECURITY_AUTHORITY',area:'APPROVAL',need:'Independent reviewer verified in a private trust domain'}),
 Object.freeze({id:'R05_OWNER_G23_CONSENT',area:'APPROVAL',need:'Real merchant Owner & Store/Channel scope proven'}),
 Object.freeze({id:'R06_BACKUP_RESTORE_RECOVERY',area:'RECOVERY',need:'Encrypted authorized backup & restore drill independently certified'}),
 Object.freeze({id:'R07_STORE_SCHEMA_AND_MIGRATION',area:'SCHEMA',need:'Approved Store ownership schema, constraints, policy plan and checkpoint'}),
 Object.freeze({id:'R08_DB_ROLE_AND_JWT_ISSUER',area:'AUTH',need:'Supabase Auth-issued signed session JWT, not self-signed/decode-only JWT'}),
 Object.freeze({id:'R09_REAL_SAME_TENANT_DENY',area:'AUTH',need:'Same-tenant Shop A->B and B->A denial with authenticated Data API'}),
 Object.freeze({id:'R10_CROSS_TENANT_DENY',area:'AUTH',need:'Store C negative cases using distinct tenant JWT'}),
 Object.freeze({id:'R11_REPLAY_AND_REVOCATION',area:'SECURITY',need:'Durable nonce, replay, challenge expiry, revocation tests on safe fixture'}),
 Object.freeze({id:'R12_OPERATION_BOUNDARIES',area:'APPROVAL',need:'Separate operation-specific authorization: RPC, DDL/RLS, JWT testing, backup, release'}),
 Object.freeze({id:'R13_QA_FIXTURES_AND_NON_PROD_DATA',area:'QA',need:'Approved synthetic Store A/B/C test users & no production customer data'}),
 Object.freeze({id:'R14_ROLLBACK_VERIFIED',area:'RECOVERY',need:'Restore entrypoint and verifiable rollback drill with responsible operator'}),
 Object.freeze({id:'R15_BILLING_SENDING_NO_GO',area:'RELEASE',need:'Billing limits, provider permissions, live-send release approval remain separate'})
]);
const JWT_CASES=Object.freeze([
 {id:'JWT01',actor:'ShopA_Manager',target:'ShopA_Catalog',expected:'ALLOW_OWN_FIXTURE'},
 {id:'JWT02',actor:'ShopA_Manager',target:'ShopB_Catalog_SAME_TENANT',expected:'DENY'},
 {id:'JWT03',actor:'ShopB_Manager',target:'ShopA_Orders_SAME_TENANT',expected:'DENY'},
 {id:'JWT04',actor:'ShopC_Manager',target:'ShopA_Orders_CROSS_TENANT',expected:'DENY'},
 {id:'JWT05',actor:'ShopA_Revoked',target:'ShopA_Orders',expected:'DENY_AFTER_REVOCATION'},
 {id:'JWT06',actor:'ExpiredOrBadJWT',target:'ShopA_Catalog',expected:'AUTH_REJECT_OR_NO_ROWS'},
 {id:'JWT07',actor:'AnonNoMembership',target:'ShopA_Orders',expected:'DENY'},
 {id:'JWT08',actor:'ShopA_Manager',target:'ShopB_OrderInsert_SAME_TENANT',expected:'WITH_CHECK_DENY'},
 {id:'JWT09',actor:'ShopA_Manager',target:'ShopB_ProductUpdate_SAME_TENANT',expected:'USING_AND_WITH_CHECK_DENY'},
 {id:'JWT10',actor:'ReplayOfOwnerChallenge',target:'QA_Pairing',expected:'DURABLE_REPLAY_DENY'},
 {id:'JWT11',actor:'CrossStoreScopedRPC',target:'ShopB_PrivateReceipt',expected:'DENY'},
 {id:'JWT12',actor:'ServiceRoleInBrowser',target:'FrontendAssets',expected:'NO_SECRET_EXPOSURE'}
].map(Object.freeze));
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const DENY_REASON=Object.freeze({
 BASELINE_MISMATCH:'RPC_OR_HOSTED_STORE_PROOF_NOT_VERIFIED',
 UNTRUSTED_APPROVAL:'PRIVATE_AUTHORIZATION_NOT_VERIFIED',
 NOT_APPROVED:'NO_OPERATION_SPECIFIC_AUTHORIZATION',
 SCHEMA_MISSING:'HOSTED_STORE_OWNER_SCHEMA_MISSING',
 REAL_JWT_MISSING:'REAL_SIGNED_JWT_NEGATIVE_CASES_NOT_CERTIFIED'
});
function createGate({rpc,store,option='MIGRATE_PRIVATE_GATEWAY',receipts=[],authorizationClaims}={}){
 if(!Object.hasOwn(OPTIONS,option))return Object.freeze({status:'REJECTED',reason:'UNSUPPORTED_REMEDIATION_OPTION',releaseAuthorized:false});
 if(!Array.isArray(receipts)||receipts.length>15)return Object.freeze({status:'REJECTED',reason:'INVALID_RECEIPT_ARRAY',releaseAuthorized:false});
 const checked=receipts.map(checkPrivateReceipt);
 if(checked.some(x=>x.status==='REJECTED'))return Object.freeze({status:'REJECTED',reason:'MALFORMED_PRIVATE_METADATA_RECEIPT',releaseAuthorized:false});
 if(new Set(checked.map(x=>x.evidenceSha256)).size!==checked.length)
  return Object.freeze({status:'REJECTED',reason:'DUPLICATE_RECEIPT_DIGEST',releaseAuthorized:false});
 const rpcCheck=checkHostedRpcMetadata(rpc),storeCheck=evaluateHostedStoreReadiness(store);
 // Never interpret authorizationClaims as a real signature or an approval.
 // It may contain arbitrary hostile fields and is not output or logged.
 const suppliedClaim=authorizationClaims!==undefined;
 const phase=rpcCheck.status==='PRIVILEGED_ANON_RPC_REVIEW_REQUIRED'?
  'INVENTORY_AND_PRIVATE_AUTHORITY_REVIEW_ONLY':'REBASELINE_RPC_FIRST';
 const prerequisites=REQUIREMENTS.map(x=>Object.freeze({id:x.id,area:x.area,
  requirement:x.need,status:'PENDING_INDEPENDENT_ATTESTATION'}));
 const execution=Object.freeze(SCOPES.map(scope=>Object.freeze({
  scope,status:'BLOCKED',approvalEvidenceVerified:false,authorizationLeaseIssued:false,
  executable:false,requiresSeparateExplicitApproval:true})));
 return Object.freeze({
  contract:CONTRACT,lifecycle:'CANDIDATE',mode:'SOURCE_ONLY_NO_SEND',
  decision:DECISION,preferredOption:'MIGRATE_PRIVATE_GATEWAY',
  optionRequested:option,optionAssessment:OPTIONS[option],
  currentRpcFingerprint:BASELINE.digestMd5, rpcReviewStatus:rpcCheck.status,
  storeReadinessStatus:storeCheck.status,phase,
  approvalClaimsSupplied:suppliedClaim,approvalClaimsTrusted:false,
  publicReceiptCount:checked.length,independentEvidenceVerified:false,
  prerequisites:Object.freeze(prerequisites),executionScopes:execution,
  jwtTestMatrix:JWT_CASES,
  signedJwtExecutionAuthorized:false,realJwtTestPerformed:false,
  migrationOrGrantAuthorized:false,backupAuthorized:false,
  providerMessageAuthorized:false,customerDataAuthorized:false,
  independentOwnerG23Verified:false,productionReleaseAuthorized:false,
  hostedExecutionAuthorized:false,releaseAuthorized:false,
  hostedReads:0,hostedWrites:0,providerSends:0,realModelCalls:0,
  paidSpendVnd:0
 });
}
function inspectHostReviewResult(x){
 // Accepts anonymous, PUBLIC metadata only, not a cryptographic proof.
 // Even a perfectly matching report is not permission to run anything.
 if(!exact(x,['contract','rpcSourceMd5','jwtCaseStatuses','operatorAction',
  'independentSecuritySignerVerified','merchantOwnerVerified','rollbackReady']))
  return Object.freeze({status:'REJECTED',reason:'HOST_REVIEW_SCHEMA_INVALID',authorized:false});
 if(x.contract!==CONTRACT||x.rpcSourceMd5!==BASELINE.digestMd5||
  !exact(x.jwtCaseStatuses,Object.values(JWT_CASES).map(z=>z.id))||
  Object.values(x.jwtCaseStatuses).some(v=>!['NOT_RUN','PASS','FAIL','BLOCKED'].includes(v))||
  !SCOPES.includes(x.operatorAction)||typeof x.independentSecuritySignerVerified!=='boolean'||
  typeof x.merchantOwnerVerified!=='boolean'||typeof x.rollbackReady!=='boolean')
  return Object.freeze({status:'REJECTED',reason:'HOST_REVIEW_EVIDENCE_INVALID',authorized:false});
 return Object.freeze({status:'RECEIPT_METADATA_ONLY',authorized:false,
  allTestsClaimedPass:Object.values(x.jwtCaseStatuses).every(z=>z==='PASS'),
  privateSignerVerified:false,merchantOwnerVerified:false,rollbackIndependentlyCertified:false,
  metadataCannotAuthorizeHostedWork:true,executionAuthorized:false,productionReleaseAuthorized:false});
}
module.exports=Object.freeze({CONTRACT,DECISION,SCOPES,OPTIONS,REQUIREMENTS,JWT_CASES,DENY_REASON,createGate,inspectHostReviewResult});
