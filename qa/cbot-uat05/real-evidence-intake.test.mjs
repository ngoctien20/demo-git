import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 CONTRACT,EVIDENCE_KINDS,auditRealEvidence,intakePrivateVaultReference,
 releaseHostedOrderReader,issueMerchantChannelOwnership,revokeLegacyClaim
} from './real-evidence-intake.mjs';
const observed=JSON.parse(readFileSync(new URL('./observed-hosted-authority-metadata.json',import.meta.url),'utf8'));
const receipt=(kind=EVIDENCE_KINDS[0],patch={})=>({
 kind,vault_ref:'EVID-PRIVATE-REFERENCE-01',vault_ref_sha256:'a'.repeat(64),
 operator_role:'BACKUP_OPERATOR',reviewer_role:'SECURITY_REVIEWER',
 source_class:'PRIVATE_OFFLINE_OPERATOR_REFERENCE',receipt_status:'PENDING_INDEPENDENT_REVIEW',...patch
});
const fail=(fn,code)=>assert.throws(fn,{code});
const blocked=(r)=>{for(const k of ['hostedStoreOrderReadAllowed','nativeMetaPageSendAllowed','nativeZaloOaSendAllowed',
  'privilegedRpcRevokeAllowed','hostedStoreMigrationAllowed','fullPrivateRecoveryAccepted','productionReleaseAllowed']){
 assert.equal(r[k],false,k);
}};
test('01 audit contract and source provenance',()=>assert.equal(CONTRACT,'T404_CBOT_UAT05_EVIDENCE_GATE_V1'));
test('02 real staging metadata is recorded as a bound observation',()=>{
 const r=auditRealEvidence(observed);assert.equal(r.project,'TIEN404_STAGING');
 assert.ok(r.observedPassed.includes('STAGING_BUSINESS_ROW_COUNTS_OBSERVED'));
});
test('03 hosted 3 users and 5 sessions require full Auth backup',()=>{
 const r=auditRealEvidence(observed);
 assert.ok(r.observedPassed.includes('AUTH_METADATA_PRESENT_3_USERS_5_SESSIONS'));
 assert.ok(r.blockers.includes('FULL_AUTH_STORAGE_ACL_OFFSITE_RESTORE_NOT_INDEPENDENTLY_PROVEN'));
});
test('04 zero Storage objects does not imply independent full recovery',()=>{
 const r=auditRealEvidence(observed);
 assert.ok(r.observedPassed.includes('HOSTED_STORAGE_METADATA_ZERO_AT_AUDIT_TIME'));
 assert.equal(r.fullPrivateRecoveryAccepted,false);
});
test('05 canonical Store missing blocks real read',()=>{
 const r=auditRealEvidence(observed);
 assert.ok(r.blockers.includes('NO_CANONICAL_HOSTED_STORE_OWNERSHIP'));blocked(r);
});
test('06 old public privileged RPC still exposed',()=>{
 const r=auditRealEvidence(observed);
 assert.ok(r.blockers.includes('PUBLIC_PRIVILEGED_LEGACY_RPC_STILL_EXPOSED'));
});
test('07 Messenger webhook receipt does not certify native Page owner',()=>{
 const r=auditRealEvidence(observed);
 assert.ok(r.observedPassed.includes('MESSENGER_LIVE01_SIGNED_WEBHOOK_RECEIPT_OBSERVED'));
 assert.ok(r.blockers.includes('META_NATIVE_PAGE_APP_AND_MERCHANT_OWNER_NOT_ATTESTED'));blocked(r);
});
test('08 user-confirmed Messenger visibility is not Commerce UAT',()=>{
 const r=auditRealEvidence(observed);
 assert.ok(r.blockers.includes('HOSTED_COMMERCE_ORDER_READ_ONLY_PILOT_NOT_AUTHORIZED'));
});
test('09 Zalo Bot is not Zalo OA native ownership',()=>{
 const r=auditRealEvidence(observed);
 assert.ok(r.blockers.includes('ZALO_OA_NATIVE_APP_OWNER_OAUTH_NOT_ATTESTED'));
});
test('10 externally authenticated customer linking absent',()=>{
 const r=auditRealEvidence(observed);
 assert.ok(r.blockers.includes('CROSS_CHANNEL_CUSTOMER_LINK_NOT_ATTESTED'));
});
test('11 23 read Worker scripts only establish bounded literal scan',()=>{
 const r=auditRealEvidence(observed);
 assert.ok(r.observedPassed.includes('CONNECTED_CLOUDFLARE_WORKER_SOURCE_SCAN_23_OF_23'));
 assert.ok(r.blockers.includes('EXTERNAL_DYNAMIC_PAGES_WORKERS_AND_MANUAL_CALLERS_NOT_CLOSED'));
});
test('12 no exact legacy literal in Workers cannot certify zero callers',()=>{
 const r=auditRealEvidence(observed);
 assert.ok(r.observedPassed.includes('NO_EXACT_LEGACY_RPC_LITERAL_IN_SCANNED_WORKERS'));
 assert.equal(r.privilegedRpcRevokeAllowed,false);
});
test('13 7 PostgREST events with 0 literal path cannot certify absence',()=>{
 const r=auditRealEvidence(observed);
 assert.ok(r.observedPassed.includes('NO_LEGACY_RPC_LITERAL_IN_BOUNDED_SELECTED_LOG_ATTRIBUTES'));
 assert.ok(r.blockers.includes('SHORT_RETAINED_LOG_WINDOW_CANNOT_PROVE_ZERO_CALLERS'));
});
test('14 partial evidence set still releases no hosted operation',()=>{
 const r=auditRealEvidence(observed,{privateReferences:[receipt()]});
 assert.equal(r.privateReferencesReceived,1);blocked(r);
});
test('15 valid reference only accepted with private-review status',()=>{
 const r=intakePrivateVaultReference(receipt());
 assert.equal(r.status,'OPAQUE_REFERENCE_RECEIVED_NOT_AUTHORIZED');
 assert.equal(r.private_full_restore_certified,false);
});
test('16 eight unique valid opaque references still never certify a recovery',()=>{
 const refs=EVIDENCE_KINDS.map((kind,i)=>receipt(kind,{
  vault_ref:'EVID-PRIVATE-REFERENCE-'+String(i+1).padStart(2,'0'),
  vault_ref_sha256:(i+1).toString(16).repeat(64)
 }));
 const r=auditRealEvidence(observed,{privateReferences:refs,claimedApproval:true});
 assert.equal(r.privateReferencesReceived,8);assert.equal(r.awaitingPrivateEvidenceKinds.length,0);
 assert.equal(r.claimedApprovalIgnored,true);blocked(r);
});
test('17 duplicate private evidence kind denied',()=>{
 const x=receipt(),y=receipt(x.kind,{vault_ref:'EVID-OTHER-REFERENCE-999'});
 fail(()=>auditRealEvidence(observed,{privateReferences:[x,y]}),'DUPLICATED_PRIVATE_EVIDENCE_KIND');
});
test('18 unexpected raw id or secret properties in receipt rejected',()=>{
 fail(()=>intakePrivateVaultReference({...receipt(),access_token:'EXAMPLE_NOT_A_REAL_SECRET'}),'REDACTED_RECEIPT_EXACT_SCHEMA_REQUIRED');
});
test('19 extra raw backup path property rejected',()=>{
 fail(()=>intakePrivateVaultReference({...receipt(),archive_path:'C:\\PRIVATE\\FULL.backup'}),'REDACTED_RECEIPT_EXACT_SCHEMA_REQUIRED');
});
test('20 vault reference must be opaque not a URL',()=>{
 fail(()=>intakePrivateVaultReference(receipt(undefined,{vault_ref:'https://vault/private'})),'RECEIPT_REFERENT_OR_PROVENANCE_UNVERIFIED');
});
test('21 private reference digest must be 64 lowercase hex chars',()=>{
 fail(()=>intakePrivateVaultReference(receipt(undefined,{vault_ref_sha256:'bad'})),'RECEIPT_REFERENT_OR_PROVENANCE_UNVERIFIED');
});
test('22 a self-certified approved flag cannot impersonate reviewer',()=>{
 fail(()=>intakePrivateVaultReference(receipt(undefined,{receipt_status:'APPROVED'})),'RECEIPT_REFERENT_OR_PROVENANCE_UNVERIFIED');
});
test('23 spoofed external source class cannot be treated as private evidence',()=>{
 fail(()=>intakePrivateVaultReference(receipt(undefined,{source_class:'META_API_DIRECT'})),'RECEIPT_REFERENT_OR_PROVENANCE_UNVERIFIED');
});
test('24 reviewer must be distinct operator role and named',()=>{
 fail(()=>intakePrivateVaultReference(receipt(undefined,{reviewer_role:'BACKUP_OPERATOR'})),'RECEIPT_REFERENT_OR_PROVENANCE_UNVERIFIED');
});
test('25 invalid store owner evidence category denied',()=>{
 fail(()=>intakePrivateVaultReference(receipt('CUSTOMER_FULL_NAME')),'RECEIPT_REFERENT_OR_PROVENANCE_UNVERIFIED');
});
test('26 missing observed baseline source metadata cannot pass',()=>{
 fail(()=>auditRealEvidence({...observed,source_class:'SELF_REPORTED'}),'OBSERVED_BASELINE_CONTRACT_REQUIRED');
});
test('27 changed hosted numbers cannot retain original count observation',()=>{
 const snapshot={...observed,supabase:{...observed.supabase,order_count:3}};
 const r=auditRealEvidence(snapshot);
 assert.ok(r.blockers.includes('BASELINE_ROW_COUNTS_MISMATCH_OR_UNVERIFIED'));blocked(r);
});
test('28 unknown RPC privilege not converted to safe',()=>{
 const snapshot={...observed,supabase:{...observed.supabase,legacy_claim_anon_execute:null}};
 const r=auditRealEvidence(snapshot);
 assert.ok(r.blockers.includes('LEGACY_RPC_EXECUTE_GRANT_UNKNOWN'));blocked(r);
});
test('29 order reader release cannot occur in local audit',()=>{
 fail(releaseHostedOrderReader,'REAL_OWNER_JWT_STORE_RLS_AND_RECOVERY_GATE_BLOCKED');
});
test('30 native merchant channel authority cannot be self-assigned',()=>{
 fail(issueMerchantChannelOwnership,'NATIVE_PROVIDER_OWNER_NOT_ATTESTED');
});
test('31 old privileged RPC cannot be revoked from evidence classifier',()=>{
 fail(revokeLegacyClaim,'RPC_SIX_DOMAIN_CALLER_CUTOVER_NOT_ATTESTED');
});
