/**
 * TIEN404 V16.11P — PRIVATE OPERATOR EVIDENCE REQUEST AND RECOVERY PREPARATION.
 * Synthetic metadata, in-memory only. NO real evidence, authentication,
 * credentials, network, Supabase, n8n, JWT, files, backup, restoration or billing.
 * QA actor objects are NOT authenticated principals.
 *
 * Crucial invariant: even a FULLY REVIEWED QA manifest cannot authorize
 * backup, restoration, migration, customer import, RPC permission or production.
 */
export const CONTRACT='T404_V1611P_PRIVATE_OPERATOR_INTAKE_SOURCE_ONLY_V1';
export const RELEASE='NO_GO_EXTERNAL_AUTHORITY_AND_HOSTED_RECOVERY_MISSING';
export const REQUEST_STATES=Object.freeze([
 'DRAFT_LOCAL_ONLY','EVIDENCE_REQUESTED_NO_UPLOAD','QA_METADATA_RECEIVED',
 'QA_METADATA_REVIEWED_ONLY','EXTERNAL_PROOF_PENDING','HOSTED_ACTION_BLOCKED'
]);
export const REQUIRED_PROOFS=Object.freeze([
 'MERCHANT_OWNER_A_AUTHORITY','MERCHANT_OWNER_B_AUTHORITY',
 'NATIVE_PAGE_OA_OWNERSHIP','REAL_SUPABASE_JWT_A_B',
 'SAME_TENANT_STORE_RLS_READ_WRITE','LEGACY_ROW_STORE_MAPPING',
 'DATABASE_ENCRYPTED_BACKUP_PLAN','DATABASE_PRIVATE_DISPOSABLE_RESTORE',
 'STORAGE_OBJECT_BYTES_AND_METADATA_BACKUP','STORAGE_OBJECT_RESTORE',
 'AUTH_SESSIONS_AND_CUSTOM_ROLES_RECOVERY','RPC_CALLER_INVENTORY',
 'MERCHANT_DPA_PRIVACY_SCOPE','N8N_SAAS_LICENSE_WRITTEN',
 'INDEPENDENT_SECURITY_REVIEWER','EXPLICIT_COST_AND_DOWNTIME_APPROVAL',
 'INDEPENDENT_RELEASE_AUTHORITY','COMMERCE_NO_DUAL_WRITER'
]);
export const RECOVERY_DOMAINS=Object.freeze([
 'DATABASE_SCHEMA_DATA','STORAGE_OBJECT_METADATA','STORAGE_OBJECT_BYTES',
 'AUTH_SESSIONS_AND_CUSTOM_ROLES','RPC_AND_FUNCTION_PERMISSIONS',
 'MERCHANT_CHANNEL_CONFIG','DEPENDENCY_CUTOVER_AND_ROLLBACK'
]);
const fail=x=>{throw Error(x)};
const assert=(condition,code)=>{if(!condition)fail(code)};
const basic=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const fields=(x,allowed)=>basic(x)&&Object.keys(x).every(k=>allowed.includes(k));
const id=(x,prefix)=>typeof x==='string'&&new RegExp('^'+prefix+'[A-Z0-9_]{3,35}$').test(x);
const identities=Object.freeze({
 QA_OWNER_A:{role:'MERCHANT_OWNER',store:'QA_STORE_A'},
 QA_OWNER_B:{role:'MERCHANT_OWNER',store:'QA_STORE_B'},
 QA_OPERATOR_A:{role:'PLATFORM_OPERATOR',store:'QA_STORE_A'},
 QA_REVIEWER_A:{role:'SECURITY_REVIEWER_QA',store:'QA_STORE_A'},
 QA_BACKUP_OPERATOR_A:{role:'RECOVERY_OPERATOR_QA',store:'QA_STORE_A'},
 QA_RELEASE_A:{role:'RELEASE_AUTHORITY_QA',store:'QA_STORE_A'}
});
export function prepareRecoveryRequest(input){
 const allowed=['request_id','project_ref','environment','operation',
 'data_scope','restore_target','backup_destination','operator_role',
 'requester_role','reviewer_role','window_status','cost_status',
 'max_cost_vnd','merchant_authority_status','evidence_ref',
 'created_ms','expires_ms'];
 assert(fields(input,allowed),'INVALID_OR_UNSAFE_REQUEST_FIELDS');
 assert(id(input.request_id,'QA_REQUEST_'),'QA_REQUEST_ID_REQUIRED');
 assert(input.project_ref==='ifxlvrhyjhbzbrkdsida','TARGET_PROJECT_NOT_VERIFIED');
 assert(input.environment==='STAGING','PRODUCTION_TARGET_DENIED');
 assert(input.operation==='APPROVAL_PREPARATION_ONLY','HOSTED_ACTION_NOT_AUTHORIZED');
 assert(input.data_scope==='METADATA_AND_SYNTHETIC_ONLY','REAL_CUSTOMER_DATA_DENIED');
 assert(input.restore_target==='NOT_PROVISIONED','REAL_RESTORE_TARGET_NOT_AUTHORIZED');
 assert(input.backup_destination==='NOT_CONFIGURED','BACKUP_DESTINATION_NOT_AUTHORIZED');
 assert(input.operator_role==='RECOVERY_OPERATOR'&&input.requester_role==='PLATFORM_REQUESTER'
  &&input.reviewer_role==='INDEPENDENT_SECURITY_REVIEWER','SEPARATE_OPERATOR_ROLES_REQUIRED');
 assert(input.window_status==='NOT_APPROVED','DOWNTIME_NOT_AUTHORIZED');
 assert(input.cost_status==='QUOTE_REQUIRED'&&input.max_cost_vnd===null,'UNAPPROVED_COST_NOT_ALLOWED');
 assert(input.merchant_authority_status==='MISSING','UNVERIFIED_OWNER_AUTHORITY');
 assert(input.evidence_ref===null,'NO_REAL_EVIDENCE_IN_SOURCE');
 assert(Number.isSafeInteger(input.created_ms)&&input.created_ms>0
  &&Number.isSafeInteger(input.expires_ms)&&input.expires_ms>input.created_ms
  &&input.expires_ms-input.created_ms<=86400000,'REQUEST_TTL_INVALID');
 return Object.freeze({contract:CONTRACT,request_id:input.request_id,
  target_project_ref:input.project_ref,step:'PRIVATE_OPERATOR_REQUEST_DRAFT',
  cost_estimate:'NOT_QUOTED',recovery_target:'NOT_PROVISIONED',
  authority_received:false,security_reviewer_verified:false,
  allow_hosted_backup:false,allow_hosted_restore:false,allow_store_migration:false,
  allow_rpc_revoke:false,allow_real_jwt_test:false,allow_customer_data:false,
  allow_paid_project:false,allow_send:false,release:RELEASE});
}
export function assessRecoveryPlan(plan){
 assert(basic(plan),'RECOVERY_PLAN_REQUIRED');
 const allowed=['database','storage_metadata','storage_bytes','auth_roles',
  rpc_permissions','channel_configs','rollback',
  encrypted_backup_digest','private_restore_attestation','cost_quote',
  operator_authority','independent_reviewer'];
 assert(Object.keys(plan).every(k=>allowed.includes(k)),'UNSAFE_RECOVERY_PLAN_FIELDS');
 const required=[
  'database','storage_metadata','storage_bytes','auth_roles','rpc_permissions',
  'channel_configs','rollback','encrypted_backup_digest','private_restore_attestation',
  'cost_quote','operator_authority','independent_reviewer'];
 const missing=required.filter(k=>plan[k]!=='EXTERNALLY_VERIFIED_IN_PRIVATE_SYSTEM');
 return Object.freeze({
  contract:CONTRACT,domains:RECOVERY_DOMAINS,
  missing:Object.freeze(missing),reported_verified_metadata_only:required.length-missing.length,
  actual_restore_performed:false,hosted_backup_created:false,
  real_evidence_assessed_by_this_code:false,release:RELEASE});
}
export function createQaIntakeLedger(){
 const tokens=new WeakSet(),records=new Map(),audit=[];
 let seq=0;
 const maxRecords=REQUIRED_PROOFS.length*3;
 const check=(scope,store,roles)=>{
  assert(basic(scope)&&tokens.has(scope)&&scope.store===store,'UNTRUSTED_OR_CROSS_STORE_QA_SCOPE');
  assert(roles.includes(scope.role),'ROLE_NOT_AUTHORIZED_FOR_QA_STEP');
 };
 const append=(store,kind,event)=>{
  assert(audit.length<150,'QA_AUDIT_LIMIT');
  audit.push(Object.freeze({sequence:++seq,store,kind,event,external_verified:false,qa_only:true}));
 };
 function issueQaIdentity(actor,store){
  const i=identities[actor];
  assert(i&&i.store===store,'UNKNOWN_QA_ACTOR_OR_STORE');
  const scope=Object.freeze({actor,role:i.role,store,contract:CONTRACT});
  tokens.add(scope);return scope;
 }
 function requestEvidence({scope,store,kind,request_id}){
  check(scope,store,['MERCHANT_OWNER','PLATFORM_OPERATOR']);
  assert(REQUIRED_PROOFS.includes(kind),'EVIDENCE_KIND_UNKNOWN');
  assert(id(request_id,'QA_EVID_REQUEST_'),'OPAQUE_QA_REQUEST_ONLY');
  const key=store+'|'+kind;
  assert(!records.has(key),'DUPLICATE_QA_REQUEST');
  assert(records.size<maxRecords,'QA_RECORD_LIMIT');
  records.set(key,{store,kind,request_id,requested_by:scope.actor,
   evidence_ref:null,reviewed_by:null,state:'EVIDENCE_REQUESTED_NO_UPLOAD'});
  append(store,kind,'QA_EVIDENCE_REQUESTED');
  return Object.freeze({contract:CONTRACT,store,kind,state:'EVIDENCE_REQUESTED_NO_UPLOAD',
    evidence_submitted:false,upload_url_created:false,external_verified:false});
 }
 function registerOpaqueQaReceipt({scope,store,kind,request_id,receipt_id}){
  check(scope,store,['MERCHANT_OWNER','PLATFORM_OPERATOR']);
  assert(id(receipt_id,'QA_RECEIPT_'),'PRIVATE_PROOF_REMAINS_OUTSIDE_SOURCE');
  const v=records.get(store+'|'+kind);
  assert(v&&v.request_id===request_id,'QA_EVIDENCE_REQUEST_NOT_FOUND');
  assert(v.state==='EVIDENCE_REQUESTED_NO_UPLOAD','RECEIPT_REPLAY_FORBIDDEN');
  v.evidence_ref=receipt_id;v.state='QA_METADATA_RECEIVED';
  append(store,kind,'QA_OPAQUE_METADATA_RECORDED');
  return Object.freeze({store,kind,state:v.state,private_raw_data_stored:false,real_evidence_verified:false});
 }
 function reviewQaReceipt({scope,store,kind}){
  check(scope,store,['SECURITY_REVIEWER_QA']);
  const v=records.get(store+'|'+kind);
  assert(v&&v.state==='QA_METADATA_RECEIVED','RECEIPT_NOT_REVIEWABLE');
  assert(v.requested_by!==scope.actor,'SELF_REVIEW_DENIED');
  v.reviewed_by=scope.actor;v.state='QA_METADATA_REVIEWED_ONLY';
  append(store,kind,'QA_METADATA_REVIEW_ONLY');
  return Object.freeze({store,kind,state:v.state,real_owner_jwt_verified:false,
    independent_external_review:false,hosted_authority:false});
 }
 function snapshot({scope,store}){
  check(scope,store,['MERCHANT_OWNER','PLATFORM_OPERATOR','SECURITY_REVIEWER_QA','RELEASE_AUTHORITY_QA']);
  const evidence=REQUIRED_PROOFS.map(kind=>{
   const item=records.get(store+'|'+kind);
   return Object.freeze({kind,state:item?.state??'MISSING',external_proof:'NOT_VERIFIED'});
  });
  return Object.freeze({contract:CONTRACT,store,
   total:REQUIRED_PROOFS.length,
   metadata_reviewed:evidence.filter(x=>x.state==='QA_METADATA_REVIEWED_ONLY').length,
   evidence:Object.freeze(evidence),real_evidence_count:0,
   real_jwt_rsl:'NOT_RUN',hosted_backup:'NOT_RUN',
   prod_approval:false,release:RELEASE});
 }
 function auditForStore({scope,store}){
  check(scope,store,['SECURITY_REVIEWER_QA','RELEASE_AUTHORITY_QA']);
  return Object.freeze(audit.filter(x=>x.store===store).map(x=>Object.freeze({...x})));
 }
 const prohibited=()=>{
  fail('REAL_HOSTED_ACTION_REQUIRES_SEPARATE_EXTERNAL_AUTHORIZATION');
 };
 return Object.freeze({issueQaIdentity,requestEvidence,registerOpaqueQaReceipt,
  reviewQaReceipt,snapshot,auditForStore,issueSignedUploadUrl:prohibited,
  collectRealProof:prohibited,approveBackup:prohibited,approveRestore:prohibited,
  approveMigration:prohibited,approveRpcRevocation:prohibited,approveCommercialPilot:prohibited});
}
