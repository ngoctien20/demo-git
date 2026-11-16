'use strict';
/**
 * ADV6E hosted security assessment based solely on MINIMAL READ-ONLY metadata.
 * Public source-only code: no authority issuance, no hosted connection, no
 * provider requests, no use of PRIVATE or user-provided credentials.
 * Even a clean snapshot is never a hosted certificate.
 */
const VERSION='T404_ADV6E_HOSTED_READ_ONLY_METADATA_SNAPSHOT_V1';
const EXPECTED=Object.freeze({
 qa_owner_pairing:'p_shop uuid, p_action text, p_challenge uuid',
 qa_shop_b_zalo_claim:'p_challenge uuid, p_code text, p_sender text, p_event text',
 save_merchant_product:'p_tenant uuid, p_sku text, p_name text, p_price bigint, p_active boolean, p_initial_stock integer, p_expected_updated_at timestamp with time zone'
});
const KEYS=Object.freeze(['contract','scope','observedAtUtc','projectRef',
 'postgresVersion','sqlAuditRole','storeTablesPresent',
 'storeColumnsOnOrdersAndMemberships','actionNoncePrivateSchemaPresent','rpc',
 'alerts','evidenceCaveat']);
const FUNCTION_KEYS=Object.freeze(['name','args','owner','securityDefiner',
 'restrictedSearchPath','anonExecute','authenticatedExecute',
 'mentionsAuthUid','mentionsVault']);
const REQUIRED_EVIDENCE=Object.freeze([
 'REAL_CONTROLLER_AUTHORITY_PRIVATE_REGISTRAR_ATTESTATION',
 'INDEPENDENT_SECURITY_REVIEWER_HUMAN_AUTHORITY',
 'AUTHORIZED_BACKUP_OPERATOR_AND_ONE_TIME_SCOPED_DECISION',
 'ENCRYPTED_STAGING_BACKUP_AND_SEPARATELY_AUTHORIZED_ISOLATED_RESTORE',
 'CANONICAL_STORES_AND_STORE_MEMBERSHIP_SCHEMA_INDEPENDENTLY_APPROVED',
 'TWO_REAL_NON_BYPASS_OWNER_SESSIONS_WITH_CROSS_STORE_DENIAL',
 'PRIVATE_DB_RUNTIME_ROLE_APPROVED_WITHOUT_BYPASSRLS',
 'HOSTED_ATOMIC_NONCE_AND_BUSINESS_EFFECT_IDEMPOTENCY_PROOF',
 'RPC_FUNCTION_BODY_CALLER_DEPENDENCY_AND_ROLLBACK_REVIEW',
 'VERIFIED_PROVIDER_CHANNEL_ACCOUNT_AND_CUSTOMER_CONSENT'
]);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const readOnly=()=>Object.freeze({
 exportAuthorized:false,restoreAuthorized:false,grantAuthorized:false,
 revokeAuthorized:false,migrationAuthorized:false,
 liveProviderSendAuthorized:false,realCommerceWriteAuthorized:false,
 hostedCertificationIssued:false,productionReleaseAuthorized:false
});
const returnResult=(valid,problems,observedAtUtc)=>Object.freeze({
 contract:'T404_ADV6E_HOSTED_SECURITY_READINESS_REPORT_V1',
 status:valid?'SECURITY_REVIEW_REQUIRED_NO_GO':'UNTRUSTED_OR_STALE_SNAPSHOT_NO_GO',
 validReadOnlyShape:valid,
 observedAtUtc:valid?observedAtUtc:null,
 findings:Object.freeze([...new Set(problems)]),
 requiredIndependentEvidence:REQUIRED_EVIDENCE,
 metadataSourceCryptographicallyVerified:false,
 securityReviewerAuthorityVerified:false,
 actualHostedOwnerRlsCertified:false,
 actualHostedActionNonceCertified:false,
 rpcFunctionBehaviorCertified:false,
 ...readOnly()
});
function assess(snapshot,{now=Date.now()}={}){
 if(!Number.isSafeInteger(now)||now<=0)
  return returnResult(false,['INVALID_ASSESSMENT_CLOCK'],null);
 if(!exact(snapshot,KEYS)||snapshot.contract!==VERSION||
    snapshot.scope!=='SUPABASE_STAGING_METADATA_ONLY_NOT_AUTH_PROOF'||
    snapshot.projectRef!=='ifxlvrhyjhbzbrkdsida'||
    !/^17\.\d{1,2}$/.test(snapshot.postgresVersion)||
    snapshot.sqlAuditRole!=='postgres'||
    snapshot.evidenceCaveat!=='CATALOG_METADATA_NOT_SIGNED_NO_FUNCTION_BODY_REVIEW_NO_OWNER_JWT_PROOF')
  return returnResult(false,['HOSTED_METADATA_PROVENANCE_OR_SCOPE_INVALID'],null);
 const recorded=Date.parse(snapshot.observedAtUtc);
 if(typeof snapshot.observedAtUtc!=='string'||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(snapshot.observedAtUtc)||
    !Number.isFinite(recorded)||recorded>now+5*60000||
    now-recorded>24*3600000)
  return returnResult(false,['HOSTED_METADATA_SNAPSHOT_STALE_OR_FUTURE'],null);
 if(!Number.isSafeInteger(snapshot.storeTablesPresent)||
    snapshot.storeTablesPresent<0||snapshot.storeTablesPresent>2||
    !Number.isSafeInteger(snapshot.storeColumnsOnOrdersAndMemberships)||
    snapshot.storeColumnsOnOrdersAndMemberships<0||
    snapshot.storeColumnsOnOrdersAndMemberships>2||
    typeof snapshot.actionNoncePrivateSchemaPresent!=='boolean')
  return returnResult(false,['HOSTED_STORE_OR_NONCE_METADATA_INVALID'],null);
 if(!Array.isArray(snapshot.rpc)||snapshot.rpc.length!==3)
  return returnResult(false,['EXPECTED_RPC_CATALOG_INCOMPLETE'],null);
 const names=new Set(),issues=[];
 for(const f of snapshot.rpc){
  if(!exact(f,FUNCTION_KEYS)||!Object.hasOwn(EXPECTED,f.name)||
     f.args!==EXPECTED[f.name]||names.has(f.name)||
     typeof f.owner!=='string'||f.owner.length>64||
     !['securityDefiner','restrictedSearchPath','anonExecute',
       'authenticatedExecute','mentionsAuthUid','mentionsVault']
       .every(k=>typeof f[k]==='boolean'))
    return returnResult(false,['RPC_SIGNATURE_OR_PRIVILEGE_SNAPSHOT_UNTRUSTED'],null);
  names.add(f.name);
  if(f.owner==='postgres'&&f.securityDefiner&&f.anonExecute)
    issues.push('P0_ANON_CALLABLE_PRIVILEGED_RPC');
  if(f.owner==='postgres'&&f.securityDefiner&&f.authenticatedExecute)
    issues.push('P0_AUTHENTICATED_CALLABLE_PRIVILEGED_RPC_REVIEW');
  if(f.securityDefiner&&!f.restrictedSearchPath)
    issues.push('P0_SECURITY_DEFINER_SEARCH_PATH_REVIEW');
  if(f.owner!=='postgres')issues.push('RPC_OWNER_CHANGED_REVIEW_REQUIRED');
  if(!f.securityDefiner)issues.push('RPC_SECURITY_MODE_CHANGED_REVIEW_REQUIRED');
 }
 if(names.size!==3)
  return returnResult(false,['EXPECTED_RPC_SET_INCOMPLETE'],null);
 if(!exact(snapshot.alerts,[
   'anonSecurityDefinerCallable','authenticatedSecurityDefinerCallable',
   'leakedPasswordProtectionDisabled'])||
   !Number.isSafeInteger(snapshot.alerts.anonSecurityDefinerCallable)||
   !Number.isSafeInteger(snapshot.alerts.authenticatedSecurityDefinerCallable)||
   typeof snapshot.alerts.leakedPasswordProtectionDisabled!=='boolean')
  return returnResult(false,['SECURITY_ADVISOR_SHAPE_INVALID'],null);
 const discoveredAnon=snapshot.rpc.filter(f=>f.securityDefiner&&f.anonExecute).length;
 const discoveredAuth=snapshot.rpc.filter(f=>f.securityDefiner&&f.authenticatedExecute).length;
 if(discoveredAnon!==snapshot.alerts.anonSecurityDefinerCallable||
    discoveredAuth!==snapshot.alerts.authenticatedSecurityDefinerCallable)
  return returnResult(false,['SECURITY_ADVISOR_AND_PG_CATALOG_DISAGREE'],null);
 if(snapshot.storeTablesPresent!==2||snapshot.storeColumnsOnOrdersAndMemberships!==2)
  issues.push('P0_SAME_TENANT_STORE_OWNERSHIP_SCHEMA_NOT_READY');
 if(!snapshot.actionNoncePrivateSchemaPresent)
  issues.push('P0_HOSTED_PRIVATE_ACTION_NONCE_NOT_READY');
 if(snapshot.alerts.leakedPasswordProtectionDisabled)
  issues.push('P1_LEAKED_PASSWORD_PROTECTION_DISABLED');
 // Real source attestation, permission of callers, auth JWT evidence, backup
 // custody and controlled remediation approval all MUST happen externally.
 issues.push('INDEPENDENT_PRIVATE_AUTHORITY_AND_REAL_HOSTED_PROOFS_MISSING');
 return returnResult(true,issues,snapshot.observedAtUtc);
}
const deny=()=>{throw Error('ADV6E_HOSTED_EXECUTION_NOT_IMPLEMENTED')};
module.exports=Object.freeze({VERSION,EXPECTED,REQUIRED_EVIDENCE,assess,
 authorizeBackup:deny,restoreBackup:deny,signApproval:deny,
 updatePrivilege:deny,applyMigration:deny,sendMessage:deny,executeOrder:deny});
