/**
 * TIEN404 V16.11P.1 — quote-only private operator planning.
 * No hosted I/O, no real identity checks, no authorizing backup, spend or DDL.
 * Public price references are NOT a project-specific Supabase quote.
 */
export const CONTRACT='T404_V1611P1_OPERATOR_QUOTE_AUTHORIZATION_DRAFT_V1';
export const RELEASE='NO_GO_AWAITING_PRIVATE_EXTERNAL_AUTHORIZATION';
export const RATE_USD_PER_HOUR=0.01344; // Supabase public Micro compute reference; 2026-11-16
export const RATE_SOURCE='https://supabase.com/docs/guides/platform/manage-your-usage/branching';
export const QUOTE_OPTIONS=Object.freeze([
 {id:'EXISTING_LOCAL_QA',label:'Disposable local PG17 synthetic',provider:'GITHUB_RUNNER_OR_LOCAL_DOCKER'},
 {id:'SUPABASE_PREVIEW_BRANCH',label:'Supabase Preview Branch',provider:'SUPABASE_PAID_BRANCH'},
 {id:'SUPABASE_NEW_ISOLATED_PROJECT',label:'Separate Supabase Project',provider:'SUPABASE_PAID_PROJECT'}
]);
export const ROLES=Object.freeze([
 'MERCHANT_OWNER_A','MERCHANT_OWNER_B',
 'TIEN404_PLATFORM_REQUESTER','BACKUP_RECOVERY_OPERATOR',
 'INDEPENDENT_SECURITY_REVIEWER','PRODUCTION_RELEASE_AUTHORITY'
]);
const fail=x=>{throw Error(x)};
const guard=(x,msg)=>{if(!x)fail(msg)};
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;
const qaRef=(s,p)=>typeof s==='string'&&new RegExp('^'+p+'[A-Z0-9_]{3,32}$').test(s);
const limited=(obj,fields)=>plain(obj)&&Object.keys(obj).every(k=>fields.includes(k));
const allMissing=Object.freeze([
 'OWNER_A_NATIVE_AUTHORITY','OWNER_B_NATIVE_AUTHORITY','PAGE_OA_PROVIDER_PROOF',
 'PRIVATELY_AUTHENTICATED_OPERATOR','INDEPENDENT_REVIEWER_PROOF',
 'SIGNED_MERCHANT_DPA','BACKUP_SCOPE_AND_KEY_CUSTODY','DATABASE_RECOVERY',
 'STORAGE_OBJECT_BYTES_RECOVERY','AUTH_AND_CUSTOM_ROLE_RECOVERY','RPC_CALLER_INVENTORY',
 'REAL_OWNER_JWT_A_B','SAME_TENANT_STORE_RLS','LEGACY_DATA_STORE_MAPPING',
 'N8N_SAAS_LICENSE','NO_DUAL_WRITER_CANARY','QUOTE_ACCEPTANCE',
 'EXACT_WRITTEN_ACTION_AUTHORIZATION'
]);
export const PRIVATE_EVIDENCE_REQUIREMENTS=allMissing;
export function compareQuoteOnlyOptions(hours){
 guard(Number.isInteger(hours)&&hours>=1&&hours<=720,'INVALID_ESTIMATION_DURATION_HOURS');
 return Object.freeze(QUOTE_OPTIONS.map(o=>{
  const compute=Math.round(hours*RATE_USD_PER_HOUR*100000)/100000;
  return Object.freeze({
   id:o.id,provider:o.provider,hours,
   public_reference_compute_usd:o.id==='EXISTING_LOCAL_QA'?null:compute,
   recurring_plan_addon_unknown:true,
   disk_storage_egress_unknown:true,
   private_recovery_eligibility:'NOT_VERIFIED',
   account_specific_cost:'NOT_QUOTED',
   billing_approval:false,
   resource_created:false,
   real_data_permitted:false,
   note:o.id==='EXISTING_LOCAL_QA'
    ?'Only synthetic data. Actual runner and infrastructure expense not confirmed.'
    :o.id==='SUPABASE_PREVIEW_BRANCH'
    ?'Branch compute reference; not covered by spend cap; no real customer backup data.'
    :'Compute reference only. Separate subscription, resource size and service charges unknown.'
  });
 }));
}
export function validateQuoteOnlyRequest(q){
 const keys=['request_id','project_ref','option_id','estimated_hours','requested_by',
 'scope','data_class','quote_reference','operator_proof','reviewer_proof',
 'payer_approval','new_resource_id','maintenance_window','signed_authorization'];
 guard(limited(q,keys),'UNSAFE_QUOTE_REQUEST_PAYLOAD');
 guard(qaRef(q.request_id,'QA_QUOTE_REQ_'),'QA_QUOTE_REQUEST_REQUIRED');
 guard(q.project_ref==='ifxlvrhyjhbzbrkdsida','TARGET_PROJECT_NOT_VERIFIED');
 guard(QUOTE_OPTIONS.some(x=>x.id===q.option_id),'UNKNOWN_RECOVERY_OPTION');
 guard(Number.isInteger(q.estimated_hours)&&q.estimated_hours>0&&q.estimated_hours<=720,
  'INVALID_ESTIMATION_DURATION_HOURS');
 guard(q.requested_by==='QA_PLATFORM_REQUESTER','REAL_IDENTITY_NOT_ACCEPTED_IN_SOURCE');
 guard(q.scope==='QUOTE_ONLY_NO_PROVISION','HOSTED_EXECUTION_FORBIDDEN');
 guard(q.data_class==='SYNTHETIC_ONLY','REAL_PII_NOT_AUTHORIZED');
 guard(q.quote_reference===null,'PROVIDER_QUOTE_MUST_BE_VERIFIED_PRIVATELY');
 guard(q.operator_proof===null&&q.reviewer_proof===null,'REAL_PERSON_PROOF_FORBIDDEN_IN_SOURCE');
 guard(q.payer_approval===false,'COST_APPROVAL_NOT_GRANTED');
 guard(q.new_resource_id===null,'HOSTED_RESOURCE_NOT_APPROVED');
 guard(q.maintenance_window===null,'MAINTENANCE_NOT_APPROVED');
 guard(q.signed_authorization===false,'SIGNED_ACTION_AUTHORIZATION_MISSING');
 const summary=compareQuoteOnlyOptions(q.estimated_hours)
   .find(x=>x.id===q.option_id);
 return Object.freeze({contract:CONTRACT,request_id:q.request_id,
  status:'QUOTE_REQUEST_DRAFT_UNSENT',reference:summary,provider_quote_received:false,
  authorized_compute_expense_usd:null,allow_provision:false,allow_back_up:false,
  allow_restore:false,allow_store_migration:false,allow_auth_test:false,
  allow_provider_send:false,release:RELEASE});
}
export function prepareWrittenAuthorization(req){
 const fields=['approval_id','target_project_ref','operation','environment','requester',
  'backup_operator','security_reviewer','release_owner','budget_cap_vnd',
  'budget_currency','provider_quote_ref','window_start','window_end',
  'restore_target','data_scope','rollback_ref','approval_signature'];
 guard(limited(req,fields),'UNSAFE_WRITTEN_APPROVAL_FIELDS');
 guard(qaRef(req.approval_id,'QA_APPROVAL_'),'QA_APPROVAL_REFERENCE_REQUIRED');
 guard(req.target_project_ref==='ifxlvrhyjhbzbrkdsida','TARGET_PROJECT_NOT_VERIFIED');
 guard(req.operation==='PREPARE_QUOTE_AND_APPROVAL_ONLY','LIVE_OPERATION_NOT_AUTHORIZED');
 guard(req.environment==='STAGING','PRODUCTION_OPERATION_FORBIDDEN');
 guard(req.requester==='QA_PLATFORM_REQUESTER','REQUESTER_MUST_BE_QA_ONLY');
 guard(req.backup_operator===null&&req.security_reviewer===null&&req.release_owner===null,
  'REAL_OPERATOR_ASSIGNMENT_NOT_VERIFIED');
 guard(req.budget_cap_vnd===null&&req.budget_currency==='VND'&&req.provider_quote_ref===null,
  'QUOTE_AND_BUDGET_NOT_YET_APPROVED');
 guard(req.window_start===null&&req.window_end===null,'LIVE_WINDOW_NOT_AUTHORIZED');
 guard(req.restore_target===null,'REAL_RECOVERY_TARGET_NOT_APPROVED');
 guard(req.data_scope==='NO_REAL_CUSTOMER_DATA','CUSTOMER_DATA_NOT_AUTHORIZED');
 guard(qaRef(req.rollback_ref,'QA_ROLLBACK_'),'QA_ROLLBACK_REF_REQUIRED');
 guard(req.approval_signature===null,'EXTERNAL_SIGNATURE_REQUIRED_OUTSIDE_SOURCE');
 return Object.freeze({contract:CONTRACT,id:req.approval_id,
  status:'WRITTEN_APPROVAL_DRAFT_UNSIGNED',authorized_actions:[],
  actor_assigned_real:false,independent_signature_verified:false,
  safe_to_provision:false,safe_to_restore:false,commercial_release:RELEASE});
}
export function createQaAssignmentLedger(){
 const scopes=new WeakSet(),assignments=new Map(),audit=[];
 const known=Object.freeze({
  QA_OWNER_A:{role:'MERCHANT_OWNER_A',store:'QA_STORE_A'},
  QA_OWNER_B:{role:'MERCHANT_OWNER_B',store:'QA_STORE_B'},
  QA_PLATFORM_A:{role:'TIEN404_PLATFORM_REQUESTER',store:'QA_STORE_A'},
  QA_SECURITY_A:{role:'INDEPENDENT_SECURITY_REVIEWER',store:'QA_STORE_A'},
  QA_BACKUP_A:{role:'BACKUP_RECOVERY_OPERATOR',store:'QA_STORE_A'},
  QA_RELEASE_A:{role:'PRODUCTION_RELEASE_AUTHORITY',store:'QA_STORE_A'}
 });
 function issueQaScope(actor,store){
  const k=known[actor];guard(k&&k.store===store,'QA_ACTOR_SCOPE_INVALID');
  const scope=Object.freeze({actor,store,role:k.role});
  scopes.add(scope);return scope;
 }
 const validate=(scope,store,roles)=>{
  guard(plain(scope)&&scopes.has(scope)&&scope.store===store,'FORGED_OR_CROSS_STORE_QA_SCOPE');
  guard(roles.includes(scope.role),'ROLE_NOT_ALLOWED');
 };
 function proposeRole({scope,store,role,assignment_ref}){
  validate(scope,store,['TIEN404_PLATFORM_REQUESTER']);
  guard(ROLES.includes(role),'UNKNOWN_ROLE');
  guard(qaRef(assignment_ref,'QA_NOM_'),'QA_NOMINATION_REF_REQUIRED');
  const key=store+'|'+role;guard(!assignments.has(key),'DUPLICATE_NOMINATION');
  assignments.set(key,Object.freeze({role,store,assignment_ref,
    submitted_by:scope.actor,reviewed_by:null,status:'QA_PROPOSED_NOT_REAL_ASSIGNMENT'}));
  audit.push(Object.freeze({store,role,event:'QA_NOMINATED'}));
  return Object.freeze({role,store,status:'QA_PROPOSED_NOT_REAL_ASSIGNMENT',
    external_identity_verified:false,can_operate_backup:false});
 }
 function reviewNomination({scope,store,role}){
  validate(scope,store,['INDEPENDENT_SECURITY_REVIEWER']);
  const key=store+'|'+role,val=assignments.get(key);
  guard(val,'NOMINATION_NOT_FOUND');
  guard(val.status==='QA_PROPOSED_NOT_REAL_ASSIGNMENT','NOMINATION_REPLAY');
  guard(val.submitted_by!==scope.actor,'SELF_ATTESTATION_DENIED');
  assignments.set(key,Object.freeze({...val,reviewed_by:scope.actor,
   status:'QA_METADATA_REVIEWED_NO_REAL_PERSON_PROOF'}));
  audit.push(Object.freeze({store,role,event:'QA_METADATA_REVIEWED'}));
  return Object.freeze({store,role,status:'QA_METADATA_REVIEWED_NO_REAL_PERSON_PROOF',
    actual_human_assigned:false,backup_approval:false});
 }
 function status({scope,store}){
  validate(scope,store,['TIEN404_PLATFORM_REQUESTER','INDEPENDENT_SECURITY_REVIEWER',
   'MERCHANT_OWNER_A','MERCHANT_OWNER_B','PRODUCTION_RELEASE_AUTHORITY']);
  const nominations=ROLES.map(role=>{
   const v=assignments.get(store+'|'+role);
   return Object.freeze({role,state:v?.status||'NOT_ASSIGNED',real_proof:'MISSING'});
  });
  return Object.freeze({store,nominations,required_private_evidence:allMissing,
   no_real_operator_proven:true,real_quote:null,approved_budget_vnd:null,
   hosted_owner_jwt:'NOT_RUN',hosted_recovery:'NOT_RUN',release:RELEASE});
 }
 function auditForStore({scope,store}){
  validate(scope,store,['INDEPENDENT_SECURITY_REVIEWER']);
  return Object.freeze(audit.filter(x=>x.store===store));
 }
 function refuse(){fail('EXTERNAL_SIGNED_APPROVAL_AND_PRIVATE_OPERATOR_PROOF_REQUIRED')}
 return Object.freeze({issueQaScope,proposeRole,reviewNomination,status,auditForStore,
  approveQuote:refuse,allocateBudget:refuse,createBranch:refuse,
  backupHosted:refuse,restoreHosted:refuse,applyMigration:refuse,
  revokeRpc:refuse,approvePilot:refuse});
}
