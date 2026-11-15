'use strict';
/**
 * TIEN404 V13.6M.7 — hosted migration EVIDENCE PACK, never authorization.
 * The snapshot is a review copy of read-only connector observations, NOT a
 * signed attestation, JWT session, backup or deployment credential.
 */
const REQUIRED=Object.freeze([
 'restorable_backup',
 'restore_drill',
 'owner_backfill_mapping',
 'store_schema',
 'store_rls',
 'same_tenant_two_store_jwt',
 'private_page_binding',
 'page_owner_consent',
 'private_event_schema',
 'restricted_no_bypass_rls_role',
 'private_schema_exposure_audit',
 'atomic_hosted_postgres_qa',
 'distributed_hmac_rotation_qa',
 'retention_tombstone_policy',
 'messenger_entitlement'
]);
const DENY=Object.freeze({
 migrationAuthorized:false,
 canReplaceRls:false,
 canBackfill:false,
 hostedReplayReady:false,
 realMessengerSendEnabled:false,
 canRotateProductionKey:false,
 canDeleteRecords:false,
 canModifyCredentials:false,
 canPromoteCoreBot:false
});
const fail=code=>{const e=new Error(code);e.code=code;throw e};
function buildHostedEvidencePack({mode='BLOCKED',snapshot}={}){
 if(mode!=='READ_ONLY_EVIDENCE_REVIEW')
   fail('M7_EVIDENCE_REVIEW_ONLY');
 if(!snapshot||snapshot.source!=='READ_ONLY_CONNECTOR_SNAPSHOT'||
    typeof snapshot.checkedAt!=='string'||
    !/^\d{4}-\d{2}-\d{2}T/.test(snapshot.checkedAt)||
    !snapshot.supabase||!snapshot.github||!snapshot.n8n)
   fail('M7_SNAPSHOT_INVALID');
 const d=snapshot.supabase,g=snapshot.github,n=snapshot.n8n;
 if(typeof d.stagingProjectRef!=='string'||typeof d.postgresVersion!=='string'||
    !d.schema||typeof d.schema!=='object'||
    typeof g.parentPullRequest!=='number'||typeof g.parentHeadSha!=='string'||
    typeof n.publishedWorkflowId!=='string'||typeof n.publishedVersion!=='string')
   fail('M7_SNAPSHOT_INVALID');
 const observed={
  restorable_backup:null,
  restore_drill:null,
  owner_backfill_mapping:null,
  store_schema:d.schema.stores===true&&d.schema.storeMemberships===true,
  store_rls:null,
  same_tenant_two_store_jwt:null,
  private_page_binding:d.schema.privatePageBinding===true,
  page_owner_consent:null,
  private_event_schema:d.schema.privateEventClaims===true,
  restricted_no_bypass_rls_role:null,
  private_schema_exposure_audit:null,
  atomic_hosted_postgres_qa:null,
  distributed_hmac_rotation_qa:null,
  retention_tombstone_policy:null,
  messenger_entitlement:null
 };
 const gates=Object.freeze(REQUIRED.map(key=>Object.freeze({
  key,
  state:observed[key]===true?'OBSERVED_SCHEMA_ONLY':
        observed[key]===false?'MISSING':'NOT_VERIFIED'
 })));
 const blocked=gates.filter(x=>x.state!=='OBSERVED_SCHEMA_ONLY').map(x=>x.key);
 return Object.freeze({
  stage:'V13.6M.7',status:'HOSTED_GATE_BLOCKED',
  evidenceLevel:'READ_ONLY_REVIEW_SNAPSHOT_NOT_AUTHORIZATION',
  snapshotTime:snapshot.checkedAt,
  sourceProject:d.stagingProjectRef,
  postgresVersion:d.postgresVersion,
  githubParentPr:g.parentPullRequest,
  publishedN8nUnchangedVerified:n.publishedWorkflowId==='Z7FdV7uDvApfbURQ'&&
    n.publishedVersion==='d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92',
  gates,blocked:Object.freeze(blocked),
  evidenceAcceptedForMigration:false,
  ...DENY
 });
}
module.exports={buildHostedEvidencePack,REQUIRED,DENY};
