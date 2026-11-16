/**
 * TIEN404 V16.11P.2 — confidential operator + one-action quote authorization PREPARATION.
 * Never collects real names, contact details, JWTs, provider quotes, signatures
 * or backup bytes. Source-only local synthetic QA, ZERO effect on Supabase.
 * The current user's approval of this Draft does not authorize a cost query
 * for a particular organization, resource creation, or hosted recovery.
 */
export const CONTRACT='T404_V1611P2_PRIVATE_OPERATOR_QUOTE_REVIEW_DRAFT_V1';
export const RELEASE='NO_GO_NO_VERIFIED_OPERATORS_QUOTE_OR_AUTHORIZATION';
export const ACTION='REQUEST_ACCOUNT_SPECIFIC_COST_QUOTE_READ_ONLY';
export const PROJECT_REF='ifxlvrhyjhbzbrkdsida';
export const REQUIRED_ROLES=Object.freeze([
 'MERCHANT_OWNER_A','MERCHANT_OWNER_B',
 'PLATFORM_REQUESTER','BACKUP_RECOVERY_OPERATOR',
 'INDEPENDENT_SECURITY_REVIEWER','RELEASE_AUTHORITY'
]);
export const RECOVERY_REQUIREMENTS=Object.freeze([
 'DATABASE_BACKUP_ENCRYPTION_AND_CHAIN_OF_CUSTODY',
 'DATABASE_DISPOSABLE_RESTORE_TEST',
 'STORAGE_OBJECT_BYTES_AND_METADATA',
 'AUTH_USERS_SESSIONS_AND_CUSTOM_ROLE_RECOVERY',
 'PRIVILEGED_RPC_CALLER_INVENTORY',
 'OWNER_A_B_REAL_JWT_SAME_TENANT_STORE_ISOLATION',
 'LEGACY_STORE_MAPPING',
 'DATA_PROCESSING_AGREEMENT',
 'N8N_MULTI_MERCHANT_SAAS_LICENSE',
 'NO_EXTERNAL_SEND_DURING_RESTORE'
]);
const err=c=>{throw Error(c)};
const assert=(v,c)=>{if(!v)err(c)};
const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const only=(v,k)=>isPlain(v)&&Object.keys(v).every(x=>k.includes(x));
const qaId=(v,prefix)=>typeof v==='string'&&new RegExp('^'+prefix+'[A-Z0-9_]{3,32}$').test(v);
const ROLES_FIXTURE=Object.freeze({
 QA_PLATFORM_A:{store:'QA_STORE_A',role:'PLATFORM_REQUESTER'},
 QA_REVIEWER_A:{store:'QA_STORE_A',role:'INDEPENDENT_SECURITY_REVIEWER'},
 QA_OWNER_A:{store:'QA_STORE_A',role:'MERCHANT_OWNER_A'},
 QA_OWNER_B:{store:'QA_STORE_B',role:'MERCHANT_OWNER_B'}
});
export function makeQuoteRequestDraft(x){
 const fields=['request_id','project_ref','organization_confirmation','action','environment',
   'data_scope','requested_hours','quote_option','quote_received','budget_approved',
   'resource_created','approval_signature','operator_evidence'];
 assert(only(x,fields),'UNSAFE_QUOTE_DRAFT_FIELDS');
 assert(qaId(x.request_id,'QA_COST_'),'QA_COST_ID_REQUIRED');
 assert(x.project_ref===PROJECT_REF,'PROJECT_SCOPE_MISMATCH');
 assert(x.organization_confirmation==='PENDING_USER_CONFIRMATION','ORGANIZATION_CONFIRMATION_REQUIRED');
 assert(x.action===ACTION,'NOT_READ_ONLY_COST_QUERY');
 assert(x.environment==='STAGING','PRODUCTION_QUERY_NOT_IN_SCOPE');
 assert(x.data_scope==='NO_REAL_CUSTOMER_DATA','REAL_DATA_FORBIDDEN');
 assert(Number.isSafeInteger(x.requested_hours)&&x.requested_hours>=1&&x.requested_hours<=168,'HOURS_OUT_OF_RANGE');
 assert(['BRANCH','PROJECT'].includes(x.quote_option),'QUOTE_TYPE_NOT_ALLOWLISTED');
 assert(x.quote_received===false&&x.budget_approved===false&&x.resource_created===false,
   'PREMATURE_QUOTE_OR_SPEND_CLAIM');
 assert(x.approval_signature===null&&x.operator_evidence===null,'PRIVATE_EVIDENCE_FORBIDDEN_IN_SOURCE');
 return Object.freeze({contract:CONTRACT,request_id:x.request_id,
   target_project:PROJECT_REF,action:ACTION,quote_type:x.quote_option,
   account_quote_status:'NOT_QUERIED_OR_VERIFIED',scope:'SINGLE_READ_ONLY_QUERY_ONLY',
   organization_user_confirmation:'PENDING',cost_cap:null,
   authorized_to_call_provider:false,authorized_to_create:false,
   authorized_to_backup:false,authorized_to_restore:false,
   authorized_to_change_sql:false,authorized_to_test_real_jwt:false,
   deadline:'NOT_APPROVED',release:RELEASE});
}
export function assessProviderCostEvidence(x){
 const allowed=['quote_type','provider_response_kind','organization_confirmed',
   'provider_response_verified','approved_budget','new_resource_created',
   file_backup_approved','storage_cost_reviewed'];
 assert(only(x,allowed),'UNSAFE_PROVIDER_COST_EVIDENCE');
 assert(['BRANCH','PROJECT'].includes(x.quote_type),'QUOTE_TYPE_NOT_ALLOWLISTED');
 // This function cannot verify provider identity, API responses or human signatures.
 const blockers=[];
 if(x.organization_confirmed!==true)blockers.push('ORG_NOT_CONFIRMED_BY_USER');
 if(x.provider_response_kind!=='ACCOUNT_ORG_SPECIFIC')blockers.push('ACCOUNT_SPECIFIC_QUOTE_MISSING');
 if(x.provider_response_verified!==true)blockers.push('PROVIDER_EVIDENCE_NOT_INDEPENDENTLY_VERIFIED');
 if(x.approved_budget!==true)blockers.push('EXPLICIT_BUDGET_APPROVAL_MISSING');
 if(x.storage_cost_reviewed!==true)blockers.push('STORAGE_DISK_EGRESS_TAXES_NOT_PRICED');
 if(x.file_backup_approved!==true)blockers.push('RECOVERY_AND_DATA_PROCESSING_AUTHORIZATION_MISSING');
 if(x.new_resource_created===true)blockers.push('UNEXPECTED_PAID_RESOURCE_CREATED');
 return Object.freeze({contract:CONTRACT,blockers:Object.freeze(blockers),
   self_report_does_not_certify_provider_response:true,
   project_eligibility:'NOT_VERIFIED_BY_THIS_CODE',
   quote_can_authorize_resource:false,
   quote_can_authorize_backup:false,release:RELEASE});
}
export function prepareSingleActionAuthorization(x){
 const allowed=['approval_id','target_ref','action','requester_role','operator_role',
 'reviewer_role','merchant_owner_A_ref','merchant_owner_B_ref',
 'provider_quote_ref','cost_cap_vnd','starts_at','expires_at',
 'data_class','restore_target','rollback_ref','signature'];
 assert(only(x,allowed),'UNSAFE_SINGLE_ACTION_FIELDS');
 assert(qaId(x.approval_id,'QA_AUTH_'),'QA_AUTHORIZATION_ID_REQUIRED');
 assert(x.target_ref===PROJECT_REF,'PROJECT_SCOPE_MISMATCH');
 assert(x.action===ACTION,'EXECUTION_ACTION_NOT_ALLOWED');
 assert(x.requester_role==='PLATFORM_REQUESTER'&&x.operator_role==='BACKUP_RECOVERY_OPERATOR'
  &&x.reviewer_role==='INDEPENDENT_SECURITY_REVIEWER','SEPARATION_OF_DUTIES_REQUIRED');
 assert(x.merchant_owner_A_ref===null&&x.merchant_owner_B_ref===null,'OWNER_EVIDENCE_NOT_PUBLIC');
 assert(x.provider_quote_ref===null&&x.signature===null,'SIGNED_OR_PROVIDER_PROOF_NOT_VERIFIED');
 assert(x.cost_cap_vnd===null&&x.starts_at===null&&x.expires_at===null,'SPENDING_OR_WINDOW_NOT_APPROVED');
 assert(x.data_class==='NO_REAL_CUSTOMER_DATA'&&x.restore_target===null,'HOSTED_RECOVERY_NOT_AUTHORIZED');
 assert(qaId(x.rollback_ref,'QA_ROLLBACK_'),'ROLLBACK_REFERENCE_REQUIRED');
 return Object.freeze({contract:CONTRACT,approval_id:x.approval_id,
   action:x.action,approval_state:'DRAFT_UNSIGNED_NO_EFFECT',
   operator_verified:false,reviewer_verified:false,merchant_owner_verified:false,
   cost_quote_received:false,resource_provision:false,hosted_backup:false,
   hosted_restore:false,real_jwt_test:false,rpc_change:false,
   customer_data_access:false,production_release:false,release:RELEASE});
}
export function createQaOperatorNominationLedger(){
 const issued=new WeakSet(),nominations=new Map(),audit=[];
 function scope(actor,store){
  const a=ROLES_FIXTURE[actor];
  assert(a&&a.store===store,'UNKNOWN_OR_WRONG_STORE_QA_ACTOR');
  const result=Object.freeze({actor,store,role:a.role});
  issued.add(result);return result;
 }
 function verify(s,store,allowed){
  assert(isPlain(s)&&issued.has(s)&&s.store===store,'FORGED_OR_CROSS_STORE_SCOPE');
  assert(allowed.includes(s.role),'ROLE_SEPARATION_DENIED');
 }
 function nominate({scope:person,store,role,ref}){
  verify(person,store,['PLATFORM_REQUESTER']);
  assert(REQUIRED_ROLES.includes(role),'INVALID_REQUIRED_ROLE');
  assert(qaId(ref,'QA_NOM_'),'OPAQUE_NOMINATION_REQUIRED');
  const k=store+'|'+role;assert(!nominations.has(k),'DUPLICATE_NOMINATION');
  nominations.set(k,{store,role,requested_by:person.actor,reviewer:null,
    status:'QA_NOMINATION_ONLY',real_actor_verified:false});
  audit.push(Object.freeze({store,role,event:'NOMINATED_QA'}));
  return Object.freeze({store,role,status:'QA_NOMINATION_ONLY',real_actor_verified:false});
 }
 function review({scope:person,store,role}){
  verify(person,store,['INDEPENDENT_SECURITY_REVIEWER']);
  const k=store+'|'+role,item=nominations.get(k);
  assert(item&&item.status==='QA_NOMINATION_ONLY','QA_NOMINATION_NOT_REVIEWABLE');
  assert(item.requested_by!==person.actor,'NO_SELF_APPROVAL');
  item.reviewer=person.actor;item.status='QA_METADATA_REVIEWED_NOT_REAL_IDENTITY';
  audit.push(Object.freeze({store,role,event:'REVIEWED_QA_ONLY'}));
  return Object.freeze({store,role,status:item.status,real_person_approved:false});
 }
 function status({scope:person,store}){
  verify(person,store,['PLATFORM_REQUESTER','INDEPENDENT_SECURITY_REVIEWER','MERCHANT_OWNER_A','MERCHANT_OWNER_B']);
  const slots=REQUIRED_ROLES.map(role=>Object.freeze({
   role,state:nominations.get(store+'|'+role)?.status||'UNASSIGNED',real_person_verified:false}));
  return Object.freeze({contract:CONTRACT,store,slots,
   verified_human_operators:0,account_quote:'NOT_QUERIED',
   signed_authorizations:0,release:RELEASE});
 }
 function auditForStore({scope:person,store}){
  verify(person,store,['INDEPENDENT_SECURITY_REVIEWER']);
  return Object.freeze(audit.filter(a=>a.store===store));
 }
 const block=()=>err('EXTERNAL_PRIVATE_HUMAN_AUTHORIZATION_REQUIRED');
 return Object.freeze({scope,nominate,review,status,auditForStore,
  getRealJWT:block,authorizeHostedBackup:block,createPaidProject:block,
  provisionBranch:block,executeRestore:block,revokeRpc:block,sendProviderMessage:block});
}
