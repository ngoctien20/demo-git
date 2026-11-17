import test from 'node:test';
import assert from 'node:assert/strict';
import {auditOwnerPairingContracts,providerClaimNoSendDecision} from './owner-contract-audit.mjs';
const ownerDef="CREATE FUNCTION public.qa_owner_pairing ... auth.uid() ... tenant_memberships ... tm.role='owner' ... identity_status='synthetic_qa' ... enabled_mode='dry_run' ...";
const providerDef="CREATE FUNCTION public.qa_shop_b_zalo_claim ... vault.decrypted_secrets ... x-tien404-pairing ... claim_owner_pairing_v3_synthetic ... 'qa-tenant-b' ...";
const base=()=>({
 ownerFunction:{schema:'public',name:'qa_owner_pairing',securityDefiner:true,searchPath:'""',anonExecute:false,authExecute:true,definition:ownerDef},
 providerFunction:{schema:'public',name:'qa_shop_b_zalo_claim',securityDefiner:true,searchPath:'""',anonExecute:true,authExecute:false,definition:providerDef,nativeProviderSignatureIndependentlyVerified:false},
 trustedIngressAdapterVerified:false,realMerchantOwnerProofVerified:false,independentReviewerVerified:false
});
const denied=x=>{assert.equal(x.status,'NO_GO');for(const k of ['can_trust_real_owner','can_open_anon_rpc','can_run_migration','can_claim_provider_signature_verified','can_send','can_deploy'])assert.equal(x[k],false)};
test('actual known QA design remains synthetic-only and NO-GO',()=>{const r=auditOwnerPairingContracts(base());denied(r);assert.ok(r.issues.includes('NATIVE_ZALO_SIGNATURE_NOT_ESTABLISHED'))});
for(const [label,change,issue] of [
 ['wrong owner name',x=>x.ownerFunction.name='other','OWNER_FUNCTION_IDENTITY_UNVERIFIED'],
 ['owner not definer',x=>x.ownerFunction.securityDefiner=false,'OWNER_FUNCTION_IDENTITY_UNVERIFIED'],
 ['search path drift',x=>x.providerFunction.searchPath='public','DEFINER_SEARCH_PATH_UNEXPECTED'],
 ['anon owner execute',x=>x.ownerFunction.anonExecute=true,'OWNER_EXECUTE_GRANT_DRIFT'],
 ['provider authenticated grant',x=>x.providerFunction.authExecute=true,'PROVIDER_EXECUTE_GRANT_DRIFT'],
 ['missing auth.uid',x=>x.ownerFunction.definition=x.ownerFunction.definition.replace('auth.uid()','no-user-check'),'OWNER_TENANT_AUTHORITY_GUARD_MISSING'],
 ['missing dry run',x=>x.ownerFunction.definition=x.ownerFunction.definition.replace('enabled_mode=\'dry_run\'','mode=live'),'OWNER_SYNTHETIC_ONLY_GUARD_MISSING'],
 ['missing vault',x=>x.providerFunction.definition=x.providerFunction.definition.replace('vault.decrypted_secrets','plain_text'),'PROVIDER_PRIVATE_GATE_MISSING'],
 ['missing scoped claim',x=>x.providerFunction.definition=x.providerFunction.definition.replace('claim_owner_pairing_v3_synthetic','claim_live'),'PROVIDER_SYNTHETIC_ONLY_GUARD_MISSING']
])test('detect '+label,()=>{const x=base();change(x);const r=auditOwnerPairingContracts(x);denied(r);assert.ok(r.issues.includes(issue))});
test('even all checklist booleans true cannot grant provider/DDL access',()=>{const x=base();x.providerFunction.nativeProviderSignatureIndependentlyVerified=true;x.trustedIngressAdapterVerified=true;x.realMerchantOwnerProofVerified=true;x.independentReviewerVerified=true;denied(auditOwnerPairingContracts(x))});
test('missing definitions fail closed',()=>denied(auditOwnerPairingContracts()));
test('null input fail closed',()=>denied(auditOwnerPairingContracts(null)));
test('no webhook is executed from this module',()=>denied(providerClaimNoSendDecision()));
