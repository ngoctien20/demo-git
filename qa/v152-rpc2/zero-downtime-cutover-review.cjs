'use strict';
/*
 * TIEN404 V15.2-ADV.6C-RPC.2 — ZERO-DOWNTIME CUTOVER REVIEW GATE
 *
 * No runtime traffic switch, RPC REVOKE, credential usage, hosted database
 * access, secret, SQL execution, rollout or provider message. A green packet
 * only invites independent review; deployment is NEVER authorized by JSON.
 */
const CONTRACT='T404_RPC2_CUTOVER_REVIEW_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const PARENT_CALLER='yIJk8LvJoLF40Z62';
const RPC_WORKFLOW='OgDZNSAvKEvhnAvn';
const SAFE_STAGES=Object.freeze([
  'CALLER_INVENTORY_READ_ONLY',
  'SHADOW_COMPARE_NO_WRITE',
  'PRIVATE_PG17_QA',
  'CANARY_PROPOSAL_PENDING_APPROVAL'
]);
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const has=x=>x===true;
function evaluateRpc2Cutover({callerInventory,proof}={}){
 const inventory=isObj(callerInventory)?callerInventory:{};
 const p=isObj(proof)?proof:{};
 const blockers=[];
 const requireProof=(condition,code)=>{if(condition!==true)blockers.push(code)};
 requireProof(inventory.contract==='T404_ADV6C_RPC2_CALLER_DISCOVERY_V1'&&
   inventory.project_ref===PROJECT&&
   inventory.n8n?.examined_draft_and_published===114&&
   inventory.n8n?.active_upstream_callers?.some(
     x=>x.workflow_id===PARENT_CALLER&&x.active===true)&&
   inventory.n8n?.exact_rpc_direct_callers?.some(
     x=>x.workflow_id===RPC_WORKFLOW&&x.active===true),
   'ACTUAL_ZALO_RPC_CALL_CHAIN_NOT_INVENTORIED');
 requireProof(inventory.supabase_rpc?.anon_execute===false,
   'ANON_RPC_STILL_EXECUTABLE');
 requireProof(inventory.supabase_rpc?.tracked_calls_unreliable===false,
   'RPC_TRAFFIC_OBSERVABILITY_UNRELIABLE');
 requireProof(inventory.unverified_domains?.length===0,
   'EXTERNAL_DYNAMIC_AND_HISTORICAL_CALLERS_NOT_ATTESTED');
 requireProof(has(p.provider_signature_real),
   'REAL_PROVIDER_SIGNATURE_NOT_CERTIFIED');
 requireProof(has(p.gateway_store_identity_real),
   'CURRENT_CHANNEL_STORE_BINDING_UNVERIFIED');
 requireProof(has(p.jwt_owner_a_b_negative_hosted),
   'HOSTED_OWNER_CROSS_STORE_PROOF_MISSING');
 requireProof(has(p.backup_export_approved_and_restore_verified),
   'AUTHORIZED_BACKUP_AND_RESTORE_MISSING');
 requireProof(has(p.disposable_pg17_atomic_claim_and_confirmation),
   'PRIVATE_DB_TRANSACTION_UNCERTIFIED');
 requireProof(has(p.private_runtime_role_non_bypass_hosted),
   'HOSTED_LEAST_PRIVILEGE_ROLE_UNVERIFIED');
 requireProof(has(p.no_double_writer_shadow_evidence),
   'SHADOW_NO_DOUBLE_WRITE_UNVERIFIED');
 requireProof(has(p.rollback_drill),
   'CUTOVER_ROLLBACK_NOT_VERIFIED');
 requireProof(has(p.observation_window_with_external_logs),
   'ACTUAL_TRAFFIC_AND_EXTERNAL_CALLER_EVIDENCE_MISSING');
 requireProof(has(p.independent_controller_security_and_operator_decisions),
   'THREE_PARTY_APPROVAL_NOT_PRIVATELY_VERIFIED');
 requireProof(has(p.canary_metrics_zero_cross_store_failures),
   'CANARY_METRICS_NOT_CERTIFIED');
 const status=blockers.length?'NO_GO':
   'PENDING_INDEPENDENT_EXTERNAL_APPROVAL_ONLY';
 return Object.freeze({
   contract:CONTRACT,status,
   stages:SAFE_STAGES,
   blockers:Object.freeze(blockers),
   note:'STATIC_AND_SYNTHETIC_EVIDENCE_ONLY',
   callerInventoryGloballyComplete:false,
   productionEventSignatureCertified:false,
   rpcPrivilegesRevoked:false,
   realZeroDowntimeCertified:false,
   hostedDbChanged:false,
   n8nPublishedChanged:false,
   canSend:false,canMerge:false,canPublish:false,canRevoke:false,
   canPromote:false,productionReleaseAuthorized:false
 });
}
const SAFE_STATUSES=new Set(['CLAIM_PENDING','CLAIM_DENIED','NOT_PAIRING_COMMAND']);
function compareSyntheticShadow({mode,items}={}){
 if(mode!=='OFFLINE_NO_SEND'||!Array.isArray(items)||items.length<1||
   items.length>100)throw Error('SHADOW_SYNTHETIC_ONLY');
 let pass=0,divergence=0;
 for(const row of items){
   if(!isObj(row)||Object.keys(row).sort().join(',')!==
      ['candidate','event_hash','legacy'].sort().join(',')||
      typeof row.event_hash!=='string'||!/^[a-f0-9]{64}$/.test(row.event_hash)||
      !SAFE_STATUSES.has(row.legacy)||!SAFE_STATUSES.has(row.candidate))
       throw Error('SHADOW_FIXTURE_PII_OR_SCHEMA_DENIED');
   if(row.legacy===row.candidate)pass++;else divergence++;
 }
 return Object.freeze({
   status:divergence===0?'SYNTHETIC_SHADOW_MATCH_ONLY':'SHADOW_DIVERGENCE_BLOCKED',
   cases:items.length,matches:pass,divergence,
   realTrafficInspected:false,legacyWriterCalled:false,candidateWriterCalled:false,
   hasRealCutoverProof:false,eligibleForLiveCanary:false
 });
}
function requireProductionCutover(){
 throw Error('RPC2_REAL_CUTOVER_REQUIRES_SEPARATE_SIGNED_APPROVAL');
}
module.exports=Object.freeze({
 CONTRACT,SAFE_STAGES,evaluateRpc2Cutover,compareSyntheticShadow,requireProductionCutover
});