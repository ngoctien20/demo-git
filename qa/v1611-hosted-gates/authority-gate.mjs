/**
 * TIEN404 V16.11 — hosted-authority acceptance planning and evidence hygiene.
 *
 * SOURCE ONLY. No credential, I/O, network or database mutations; cannot issue
 * production/hosted capability. Pure functions and local synthetic QA ledger.
 * An external independent reviewer + real Supabase JWT and private recovery
 * operator are required. No self-reported PASS can remove a hosted NO-GO.
 */
export const CONTRACT='T404_V1611_AUTHORITY_RECOVERY_GATE_SOURCE_ONLY_V1';
export const RELEASE='NO_GO_HOSTED_SECURITY_NOT_CERTIFIED';
export const EVIDENCE_REQUIREMENTS=Object.freeze([
 'MERCHANT_OWNER_AUTHORITY','PAGE_OA_OWNER_PROOF','REAL_SUPABASE_AUTH_JWT_OWNER_A_B',
 'SAME_TENANT_STORE_A_B_RLS_READ_WRITE','LEGACY_STORE_MAPPING',
 'HOSTED_ENCRYPTED_DATABASE_BACKUP','DATABASE_DISPOSABLE_RESTORE',
 'PRIVATE_STORAGE_OBJECT_BACKUP','PRIVATE_STORAGE_OBJECT_RESTORE',
 'RPC_CALLER_ATTESTATION','MERCHANT_DPA','N8N_SAAS_LICENSE',
 'NO_DUAL_WRITER_CANARY','SECURITY_REVIEWER_SIGNOFF','RELEASE_OWNER_APPROVAL'
]);
const fail=code=>{throw Error(code)};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const keys=(o,allowed)=>plain(o)&&Object.keys(o).every(k=>allowed.includes(k));
const isQaId=(v,prefix)=>typeof v==='string'&&new RegExp('^'+prefix+'[A-Z0-9_]{3,36}$').test(v);
const ROLES=Object.freeze({
 QA_MERCHANT_OWNER_A:'MERCHANT_OWNER',
 QA_TIEN404_OPERATOR_A:'TIEN404_OPERATOR',
 QA_SECURITY_REVIEWER_A:'INDEPENDENT_SECURITY_REVIEWER_QA',
 QA_BACKUP_OPERATOR_A:'BACKUP_OPERATOR_QA',
 QA_RELEASE_OWNER_A:'RELEASE_OWNER_QA',
 QA_MERCHANT_OWNER_B:'MERCHANT_OWNER'
});
const assignment=Object.freeze({
 QA_MERCHANT_OWNER_A:'QA_STORE_A',
 QA_TIEN404_OPERATOR_A:'QA_STORE_A',
 QA_SECURITY_REVIEWER_A:'QA_STORE_A',
 QA_BACKUP_OPERATOR_A:'QA_STORE_A',
 QA_RELEASE_OWNER_A:'QA_STORE_A',
 QA_MERCHANT_OWNER_B:'QA_STORE_B'
});
const acceptedType=x=>EVIDENCE_REQUIREMENTS.includes(x);
export function assessHostedMetadata(b){
 if(!plain(b)||b.contract!=='T404_V1611_HOSTED_METADATA_READ_ONLY_BASELINE_V1'
    ||!plain(b.verified_schema)||!plain(b.verified_rls)||!plain(b.constraints)
    ||!plain(b.policy_scope))fail('UNTRUSTED_HOSTED_METADATA_CONTRACT');
 const blockers=[];
 for(const key of ['stores','store_memberships','products_store_id','orders_store_id','customers_store_id']){
  if(b.verified_schema[key]!==true)blockers.push('STORE_SCHEMA_MISSING:'+key);
 }
 for(const tbl of ['products','orders','customers','tenant_memberships']){
  const policy=b.verified_rls[tbl];
  if(!plain(policy)||policy.enabled!==true||policy.forced!==true)blockers.push('RLS_OR_FORCE_MISSING:'+tbl);
 }
 if(b.policy_scope.same_tenant_different_store!=='VERIFIED_INDEPENDENT_REAL_JWT')
  blockers.push('SAME_TENANT_STORE_RLS_UNCERTIFIED');
 if(b.policy_scope.jwt_owner_AB_real!=='INDEPENDENTLY_VERIFIED')
  blockers.push('REAL_JWT_A_B_NOT_VERIFIED');
 if(b.constraints.store_scoped_sku_unique!==true)blockers.push('SKU_STORE_SCOPE_NOT_MIGRATED');
 if(b.constraints.store_scoped_order_customer_fk!==true)blockers.push('ORDER_CUSTOMER_STORE_FK_MISSING');
 if(!Array.isArray(b.privileged_rpcs)||b.privileged_rpcs.some(v=>v.review!=='INDEPENDENTLY_ATTESTED'))
  blockers.push('RPC_PRIVILEGED_CALLER_REVIEW_PENDING');
 if(b.hosted_sql_modified===true||b.hosted_backup_created===true)
  blockers.push('UNEXPECTED_HOSTED_MUTATION_REQUIRES_INCIDENT_REVIEW');
 return Object.freeze({contract:CONTRACT,verified_from_connector:b.fact_verification==='VERIFIED_READ_ONLY',
  project_ref:b.project_ref,blockers:Object.freeze([...new Set(blockers)]),
  hosted_store_ready:false,real_jwt_certified:false,release:RELEASE,
  note:'Source JSON can be edited by anyone with GitHub write access; never substitute for independent host evidence'});
}
export function planRecoveryCoverage({database,storage,auth,operator_authorization}={}){
 const b=[];
 if(database!=='ENCRYPTED_BACKUP_AND_PRIVATE_DISPOSABLE_RESTORE_INDEPENDENTLY_VERIFIED')
  b.push('DB_BACKUP_RESTORE_NOT_PROVEN');
 if(storage!=='OBJECT_BYTES_AND_METADATA_RECOVERY_INDEPENDENTLY_VERIFIED')
  b.push('STORAGE_FILE_BYTES_NOT_COVERED_BY_DB_BACKUP');
 if(auth!=='SESSION_AND_ROLE_RECOVERY_PRIVATELY_REVIEWED')
  b.push('AUTH_SESSIONS_ROLE_RECOVERY_NOT_PROVEN');
 if(operator_authorization!=='SEPARATE_EXPLICIT_WRITTEN_APPROVAL')
  b.push('RECOVERY_OPERATOR_APPROVAL_MISSING');
 return Object.freeze({contract:CONTRACT,blockers:b,external_review_required:true,
  recovery_plan_complete_on_self_report:b.length===0,
  backup_performed_by_this_code:false,restore_performed_by_this_code:false,
  genuine_backup_verified_by_this_code:false,release:RELEASE});
}
export function validatePrivateOperatorRequest(req){
 const allowed=['request_id','scope','target_project_ref','target_kind','data_class',
  'requester_role','operator_role','reviewer_role','restore_target','expense_approved',
  'downtime_approved','customer_data_authorized','rollback_plan_ref','expires_at_ms','now_ms'];
 if(!keys(req,allowed))fail('UNSAFE_PRIVATE_REQUEST_FIELDS');
 if(!isQaId(req.request_id,'QA_REQUEST_'))fail('QA_REQUEST_ID_ONLY');
 if(req.scope!=='PRIVATE_PREFLIGHT_DESIGN_NOT_EXECUTION')fail('HOSTED_OPERATION_NOT_AUTHORIZED');
 if(req.target_project_ref!=='ifxlvrhyjhbzbrkdsida')fail('UNVERIFIED_PROJECT');
 if(req.target_kind!=='STAGING_SOURCE_REVIEW')fail('UNAUTHORIZED_TARGET_KIND');
 if(req.data_class!=='NO_REAL_CUSTOMER_DATA')fail('CUSTOMER_DATA_NOT_AUTHORIZED');
 if(req.expense_approved!==false||req.downtime_approved!==false
  ||req.customer_data_authorized!==false)fail('UNVERIFIED_REAL_OPERATION_APPROVAL');
 if(req.restore_target!=='NOT_PROVISIONED')fail('REAL_RESTORE_TARGET_NOT_APPROVED');
 if(req.requester_role===req.operator_role||req.operator_role===req.reviewer_role
  ||req.requester_role===req.reviewer_role)fail('SEPARATION_OF_DUTIES_REQUIRED');
 if(typeof req.rollback_plan_ref!=='string'||!isQaId(req.rollback_plan_ref,'QA_ROLLBACK_'))
  fail('PRIVATE_ROLLBACK_REF_REQUIRED');
 if(!Number.isSafeInteger(req.now_ms)||!Number.isSafeInteger(req.expires_at_ms)
    ||req.now_ms<=0||req.expires_at_ms<=req.now_ms
    ||req.expires_at_ms-req.now_ms>86400000)fail('REQUEST_EXPIRY_INVALID');
 return Object.freeze({contract:CONTRACT,request_id:req.request_id,project_ref:req.target_project_ref,
  scope:req.scope,approval_state:'DESIGN_REVIEW_ONLY',allow_hosted_backup:false,
  allow_hosted_restore:false,allow_sql_migration:false,allow_rpc_revoke:false,
  allow_real_jwt_capture:false,allow_merchant_data:false,release:RELEASE});
}
export function createQaPrivateAuthorityLedger(){
 const issued=new WeakSet(),records=new Map(),audit=[];
 let seq=0;
 function issueQaActor(actor,store){
  if(!Object.hasOwn(ROLES,actor)||assignment[actor]!==store)fail('QA_ROLE_STORE_NOT_ASSIGNED');
  const token=Object.freeze({actor,store,role:ROLES[actor],contract:CONTRACT});
  issued.add(token);return token;
 }
 function auth(t,store,roles){
  if(!issued.has(t)||t.store!==store||!roles.includes(t.role))fail('QA_ROLE_SCOPE_DENIED');
 }
 function submitQaMetadata({scope,store,kind,ref}){
  auth(scope,store,['MERCHANT_OWNER','TIEN404_OPERATOR']);
  if(!acceptedType(kind))fail('EVIDENCE_KIND_UNKNOWN');
  if(!isQaId(ref,'QA_PRIVATE_REF_'))fail('REAL_PROOF_MUST_STAY_IN_PRIVATE_VAULT');
  const key=store+'|'+kind;if(records.has(key))fail('QA_EVIDENCE_ALREADY_SUBMITTED');
  const v={store,kind,ref,submitter:scope.actor,reviewer:null,status:'UNVERIFIED_QA_METADATA'};
  records.set(key,v);audit.push({seq:++seq,store,kind,event:'SUBMITTED_QA_METADATA'});
  return Object.freeze({store,kind,status:v.status,actual_private_evidence_verified:false});
 }
 function reviewQaMetadata({scope,store,kind}){
  auth(scope,store,['INDEPENDENT_SECURITY_REVIEWER_QA']);
  const value=records.get(store+'|'+kind);if(!value)fail('QA_METADATA_MISSING');
  if(value.submitter===scope.actor)fail('SELF_REVIEW_FORBIDDEN');
  if(value.status!=='UNVERIFIED_QA_METADATA')fail('QA_METADATA_REVIEW_REPLAY');
  value.status='QA_METADATA_REVIEW_ONLY';value.reviewer=scope.actor;
  audit.push({seq:++seq,store,kind,event:'METADATA_REVIEW_ONLY'});
  return Object.freeze({store,kind,status:value.status,actual_hosted_proof:false});
 }
 function snapshot({scope,store}){
  auth(scope,store,['MERCHANT_OWNER','TIEN404_OPERATOR','INDEPENDENT_SECURITY_REVIEWER_QA','RELEASE_OWNER_QA']);
  const matrix=EVIDENCE_REQUIREMENTS.map(kind=>({kind,
   state:records.get(store+'|'+kind)?.status??'MISSING',
   verified_external:false}));
  return Object.freeze({contract:CONTRACT,store,metadataReviewed:matrix.filter(x=>x.state==='QA_METADATA_REVIEW_ONLY').length,
   required:EVIDENCE_REQUIREMENTS.length,evidence:matrix,live_hosted_security:'NOT_VERIFIED',
   real_owner_jwt:'NOT_RUN',real_backup_restore:'NOT_RUN',commercial_release:RELEASE});
 }
 function auditScoped({scope,store}){
  auth(scope,store,['INDEPENDENT_SECURITY_REVIEWER_QA','RELEASE_OWNER_QA']);
  return Object.freeze(audit.filter(e=>e.store===store).map(x=>Object.freeze({...x})));
 }
 function approveRealBackup(){fail('REAL_BACKUP_OPERATOR_AUTHORIZATION_NOT_PRESENT')}
 function approveHostedMigration(){fail('REAL_JWT_AND_STORE_MIGRATION_AUTHORITY_NOT_PRESENT')}
 function approveLiveMerchant(){fail('PRIVATE_EXTERNAL_EVIDENCE_AND_RELEASE_AUTHORITY_NOT_PRESENT')}
 return Object.freeze({issueQaActor,submitQaMetadata,reviewQaMetadata,snapshot,auditScoped,
  approveRealBackup,approveHostedMigration,approveLiveMerchant});
}
export function approveProductionRelease(){fail('PRODUCTION_AUTHORIZATION_REQUIRES_EXTERNAL_PRIVATE_PROOF')}
