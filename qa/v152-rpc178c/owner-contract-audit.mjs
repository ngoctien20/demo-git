/**
 * RPC17.8C — read-only Owner Pairing SQL security admission.
 * Analyzer works on supplied textual definitions; findings are not exploit claims.
 * Never returns an authorization to call SECURITY DEFINER or to execute DDL.
 */
const BLOCK=(issues)=>Object.freeze({
 status:'NO_GO',issues:Object.freeze([...issues]),
 can_trust_real_owner:false,can_open_anon_rpc:false,can_run_migration:false,
 can_claim_provider_signature_verified:false,can_send:false,can_deploy:false
});
const safeText=v=>typeof v==='string'&&v.length>=80&&v.length<50000;
export function auditOwnerPairingContracts(contracts={}){
 const issues=[];
 const owner=contracts.ownerFunction;
 const provider=contracts.providerFunction;
 if(!safeText(owner?.definition)||!safeText(provider?.definition))return BLOCK(['FUNCTION_DEFINITION_MISSING']);
 if(owner.schema!=='public'||owner.name!=='qa_owner_pairing'||owner.securityDefiner!==true)issues.push('OWNER_FUNCTION_IDENTITY_UNVERIFIED');
 if(provider.schema!=='public'||provider.name!=='qa_shop_b_zalo_claim'||provider.securityDefiner!==true)issues.push('PROVIDER_FUNCTION_IDENTITY_UNVERIFIED');
 if(owner.searchPath!=='""'||provider.searchPath!=='""')issues.push('DEFINER_SEARCH_PATH_UNEXPECTED');
 if(owner.anonExecute!==false||owner.authExecute!==true)issues.push('OWNER_EXECUTE_GRANT_DRIFT');
 if(provider.anonExecute!==true||provider.authExecute!==false)issues.push('PROVIDER_EXECUTE_GRANT_DRIFT');
 const a=owner.definition.toLowerCase(),b=provider.definition.toLowerCase();
 if(!a.includes('auth.uid()')||!a.includes('tenant_memberships')||!a.includes("tm.role='owner'"))issues.push('OWNER_TENANT_AUTHORITY_GUARD_MISSING');
 if(!a.includes("identity_status='synthetic_qa'")||!a.includes("enabled_mode='dry_run'"))issues.push('OWNER_SYNTHETIC_ONLY_GUARD_MISSING');
 if(!b.includes('vault.decrypted_secrets')||!b.includes('x-tien404-pairing'))issues.push('PROVIDER_PRIVATE_GATE_MISSING');
 if(!b.includes("claim_owner_pairing_v3_synthetic")||!b.includes("'qa-tenant-b'"))issues.push('PROVIDER_SYNTHETIC_ONLY_GUARD_MISSING');
 // Vault shared secret validates a private caller; it is NOT native Zalo provider signature proof.
 // Do not mistake 'x-tien404-pairing' for signed Zalo sender identity.
 if(provider.nativeProviderSignatureIndependentlyVerified!==true)issues.push('NATIVE_ZALO_SIGNATURE_NOT_ESTABLISHED');
 if(contracts.trustedIngressAdapterVerified!==true)issues.push('TRUSTED_PROVIDER_INGRESS_NOT_ATTESTED');
 if(contracts.realMerchantOwnerProofVerified!==true)issues.push('REAL_STORE_OWNER_NOT_ATTESTED');
 if(contracts.independentReviewerVerified!==true)issues.push('INDEPENDENT_SECURITY_ACCEPTANCE_MISSING');
 return BLOCK(issues.length?issues:['AUTHENTICATED_PRIVATE_HOSTED_REPLAY_UAT_REQUIRED']);
}
export function providerClaimNoSendDecision(){return BLOCK(['PROVIDER_WEBHOOK_NOT_EXECUTED']);}
