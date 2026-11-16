'use strict';
/**
 * V15.0-11A — Combined SOURCE-ONLY readiness decision.
 * Does NOT certify any hosted Store, independent owner consent or real backup.
 * Never convert a client-submitted manifest or local test PASS into release.
 */
const {reviewPilotManifest}=require('../v15-sales-lite-pilot/pilot-release-gate.cjs');
const {createShopKnowledgeLab}=require('../v15010a-sales-knowledge/shop-knowledge-v15-adapter.cjs');
const {assessBackupAuthorizationEnvelope}=require('../v1509d-owner-backup/backup-authorization-gate.cjs');
const {inspectG23Intake}=require('../v1509c-owner-recovery/evidence-gates.cjs');
const {assessOwnerEvidence}=require('../v1509b-hosted-rls/owner-proof-gate.cjs');

function assessIntegratedCandidate(manifest={}){
 const pilot=reviewPilotManifest(manifest);
 const knowledge=createShopKnowledgeLab().inspect();
 // These are NOT actual private evidence submissions. Real approval/consent
 // requires separately authorized private verifier + hosted signed auth.
 const syntheticBackup=assessBackupAuthorizationEnvelope(null,[],{});
 const syntheticG23=inspectG23Intake(null);
 const syntheticOwner=assessOwnerEvidence(null);
 const blocking=[
   'G0_REAL_MERCHANT_OWNER_AND_PROVIDER_G23_UNVERIFIED',
   'G0_REAL_HOSTED_BACKUP_AND_RESTORE_NOT_VERIFIED',
   'G1_CANONICAL_STORES_AND_HOSTED_MIGRATION_NOT_AUTHORIZED',
   'G2_HOSTED_SIGNED_JWT_RLS_A_B_C_NOT_TESTED',
   'G3_REAL_PROVIDER_INGRESS_AND_DURABLE_REPLAY_NOT_TESTED',
   'G3_AUTHORIZED_SHARED_HOSTED_ORDER_WRITER_NOT_TESTED',
   'G3_MESSENGER_ZALO_LIVE_END_TO_END_NOT_TESTED',
   'V15_10B_REAL_132_CASE_AI_MODEL_BUDGET_AND_QA_NOT_APPROVED',
   'OWNER_UAT_COMMERCIAL_RELEASE_NOT_APPROVED'
 ];
 return Object.freeze({
   status:'BLOCKED_SOURCE_INTEGRATION_ONLY',
   evidence_version:'V15.0-11A',
   source_parent:'V15_10B_ON_TOP_OF_V15_10A_AND_SALESLITE_128',
   security_origin:'V15_09B_C_D_PRESERVED_FROM_DRAFT_135',
   real_hosted_proofs_verified:false,offline_knowledge_active:true,
   offline_knowledge_status:knowledge.scope,
   synthetic_backup_status:syntheticBackup.status,
   synthetic_g23_status:syntheticG23.status,
   synthetic_store_owner_status:syntheticOwner.status,
   pilot_manifest_status:pilot.status,
   missing_pilot_gates:pilot.missing_gates,
   blocking,
   source_only:true,
   can_merge_production:false,
   can_publish:false,can_send:false,can_write_orders:false,
   can_apply_migration:false,can_restore_hosted:false,
   can_spend_money:false,can_call_model:false,
   can_promote_lite_to_enterprise:false
 });
}
module.exports={assessIntegratedCandidate};
