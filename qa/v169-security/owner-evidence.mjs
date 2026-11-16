/**
 * TIEN404 V16.9 — merchant ownership metadata evidence intake.
 * Synthetic/LOCAL ONLY. A string actor ID is NOT an authenticated Supabase JWT;
 * evidence metadata and reviewer notes are NOT proof of hosted rights.
 * This intentionally CANNOT issue an enabled production capability.
 */
export const OWNERSHIP_CONTRACT='T404_V169_OWNER_EVIDENCE_METADATA_QA';
export const STAGE='SYNTHETIC_NO_SEND_NO_HOSTED_AUTH';
export const EVIDENCE_TYPES=Object.freeze([
 'MERCHANT_AUTHORITY','OWNER_JWT_SESSION','CHANNEL_PAGE_OA_OWNER',
 'STORE_RECORD_MAPPING','RESTORE_DRILL','RLS_CROSS_STORE',
 'RPC_CALLER_INVENTORY','DATA_PROCESSING_AGREEMENT','N8N_SAAS_LICENSE'
]);
const STORES=Object.freeze({
 QA_STORE_A:Object.freeze({tenant_id:'QA_TENANT_1',owner:'QA_OWNER_A'}),
 QA_STORE_B:Object.freeze({tenant_id:'QA_TENANT_1',owner:'QA_OWNER_B'}),
 QA_STORE_C:Object.freeze({tenant_id:'QA_TENANT_2',owner:'QA_OWNER_C'})
});
const ACTORS=Object.freeze({
 QA_OWNER_A:{role:'OWNER',store:'QA_STORE_A'},
 QA_OWNER_B:{role:'OWNER',store:'QA_STORE_B'},
 QA_OWNER_C:{role:'OWNER',store:'QA_STORE_C'},
 QA_TI_ENROLL_A:{role:'TIEN404_SUPPORT',store:'QA_STORE_A'},
 QA_TI_ENROLL_EXPIRED:{role:'TIEN404_SUPPORT',store:'QA_STORE_A',disabled:true},
 QA_QA_REVIEWER_A:{role:'SECURITY_REVIEWER_QA',store:'QA_STORE_A'},
 QA_QA_REVIEWER_B:{role:'SECURITY_REVIEWER_QA',store:'QA_STORE_B'},
 QA_QA_REVIEWER_C:{role:'SECURITY_REVIEWER_QA',store:'QA_STORE_C'},
 QA_QA_SCANNER_A:{role:'IMPORT_SCANNER_QA',store:'QA_STORE_A'},
 QA_QA_SCANNER_B:{role:'IMPORT_SCANNER_QA',store:'QA_STORE_B'},
 QA_QA_SCANNER_C:{role:'IMPORT_SCANNER_QA',store:'QA_STORE_C'}
});
const err=c=>{throw Error(c)};
const assert=(ok,why)=>{if(!ok)err(why)};
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const evidenceRef=v=>typeof v==='string'&&/^QA_EVID_[A-Z0-9_]{3,40}$/.test(v);
const nowValue=t=>Number.isSafeInteger(t)&&t>0;
const AUDIT_EVENT_LIMIT=1000;
export function createQaOwnerEvidenceLedger(){
 const documents=new Map(),issued=new WeakSet(),history=[];
 const scopes=new Map();
 let seq=0;
 function issueQaActor({actor_id,store_id}){
  assert(Object.hasOwn(STORES,store_id),'UNKNOWN_QA_STORE');
  const spec=ACTORS[actor_id];
  assert(spec&&!spec.disabled&&spec.store===store_id,'MISSING_OR_CROSS_STORE_QA_ROLE');
  const scope=Object.freeze({actor_id,role:spec.role,tenant_id:STORES[store_id].tenant_id,store_id,
   contract:OWNERSHIP_CONTRACT});
  issued.add(scope);scopes.set(actor_id+'|'+store_id,scope);return scope;
 }
 function validateScope(scope,store_id,allowed=[]){
  assert(isObject(scope)&&issued.has(scope)&&scope.contract===OWNERSHIP_CONTRACT,'NOT_ISSUED_QA_SCOPE');
  assert(scope.store_id===store_id&&STORES[store_id]?.tenant_id===scope.tenant_id,
   'CROSS_STORE_SCOPE_DENIED');
  assert(allowed.includes(scope.role),'ROLE_DENIED');
  assert(!ACTORS[scope.actor_id]?.disabled,'REVOKED_QA_ROLE');
  return scope;
 }
 function audit(row){
  if(history.length>=AUDIT_EVENT_LIMIT)err('QA_AUDIT_LIMIT_REACHED');
  history.push(Object.freeze({seq:++seq,store_id:row.store_id,kind:row.kind,event:row.event,
   evidence_ref:row.evidence_ref??null,qa_only:true}));
 }
 function makeSubmission({scope,store_id,kind,evidence_ref,now_ms}){
  validateScope(scope,store_id,['OWNER','TIEN404_SUPPORT']);
  assert(EVIDENCE_TYPES.includes(kind),'UNRECOGNIZED_EVIDENCE_KIND');
  assert(evidenceRef(evidence_ref),'PRIVATE_EVIDENCE_REF_REQUIRED');
  assert(nowValue(now_ms),'QA_CLOCK_REQUIRED');
  const key=store_id+'|'+kind;
  assert(!documents.has(key),'EVIDENCE_ALREADY_SUBMITTED_NEEDS_CONTROLLED_REPLACEMENT');
  const value={contract:OWNERSHIP_CONTRACT,store_id,tenant_id:scope.tenant_id,kind,
   evidence_ref,recorded_by:scope.actor_id,submitted_at_ms:now_ms,
   metadata_reviewed_by:null,review_state:'SUBMITTED_UNVERIFIED_METADATA',
   external_attestation:false,hosted_jwt_verified:false,qa_only:true};
  documents.set(key,value);audit({store_id,kind,event:'EVIDENCE_METADATA_SUBMITTED',evidence_ref});
  return Object.freeze({...value});
 }
 function reviewMetadata({scope,store_id,kind,evidence_ref,now_ms}){
  validateScope(scope,store_id,['SECURITY_REVIEWER_QA']);
  assert(nowValue(now_ms),'QA_CLOCK_REQUIRED');
  const key=store_id+'|'+kind,doc=documents.get(key);
  assert(doc&&doc.evidence_ref===evidence_ref,'EVIDENCE_NOT_FOUND_OR_MISMATCH');
  assert(doc.recorded_by!==scope.actor_id,'NO_SELF_ATTESTATION');
  assert(doc.review_state==='SUBMITTED_UNVERIFIED_METADATA','REVIEW_ALREADY_PERFORMED');
  doc.review_state='REVIEWED_METADATA_QA_ONLY';
  doc.metadata_reviewed_by=scope.actor_id;
  audit({store_id,kind,event:'QA_METADATA_REVIEW_ONLY',evidence_ref});
  return Object.freeze({...doc});
 }
 function revokeEvidence({scope,store_id,kind}){
  validateScope(scope,store_id,['OWNER']);
  const key=store_id+'|'+kind;
  const doc=documents.get(key);assert(doc,'EVIDENCE_NOT_FOUND');
  doc.review_state='REVOKED_QA';
  documents.delete(key);audit({store_id,kind,event:'EVIDENCE_REVOKED_QA'});
  return Object.freeze({status:'REVOKED_QA',store_id,kind,release_capability:false});
 }
 function evidenceStatus({scope,store_id}){
  validateScope(scope,store_id,['OWNER','TIEN404_SUPPORT','SECURITY_REVIEWER_QA']);
  const matrix=EVIDENCE_TYPES.map(kind=>{
   const doc=documents.get(store_id+'|'+kind);
   return Object.freeze({kind,state:doc?.review_state||'MISSING',
    metadata_reviewed_by:doc?.metadata_reviewed_by||null,
    external_verification:'NOT_VERIFIED',
    release_authority:false});
  });
  const reviewed=matrix.filter(x=>x.state==='REVIEWED_METADATA_QA_ONLY').length;
  return Object.freeze({
   contract:OWNERSHIP_CONTRACT,store_id,tenant_id:scope.tenant_id,
   metadata_reviewed:reviewed,evidence_total:EVIDENCE_TYPES.length,
   evidence:matrix,hosted_owner_jwt_rls:'BLOCKED',
   backup_restore_external:'BLOCKED',
   rpc_remediation_authority:'BLOCKED',
   commercial_license:'BLOCKED',
   provider_channel_ownership:'BLOCKED',
   actual_external_certification:false,
   merchant_production_ready:false,qa_only:true
  });
 }
 function scopedAudit({scope,store_id}){
  validateScope(scope,store_id,['OWNER','SECURITY_REVIEWER_QA']);
  return Object.freeze(history.filter(x=>x.store_id===store_id).map(x=>({...x})));
 }
 function issueProductionCapability(){err('HOSTED_IDENTITY_AND_INDEPENDENT_APPROVAL_REQUIRED')}
 function approveHostedMigration(){err('HOSTED_BACKUP_AND_OPERATOR_APPROVAL_REQUIRED')}
 return Object.freeze({issueQaActor,validateScope,makeSubmission,reviewMetadata,
  revokeEvidence,evidenceStatus,scopedAudit,issueProductionCapability,approveHostedMigration});
}
export const STORE_QA_METADATA=STORES;
export function ownerProofChecklist(){
 return Object.freeze({
  contract:OWNERSHIP_CONTRACT,source:'REVIEW_CONTRACT_NOT_CERTIFICATE',
  proof_kinds:[...EVIDENCE_TYPES],
  independent_review_required:true,
  private_operator_required:true,
  actual_hosted_owner_jwt_required:true,
  same_tenant_cross_store_negative_required:true,
  signed_consent_and_dpa_required:true,
  forbidden_self_assertion:true,
  never_auto_grant:true,
  production_ready:false
 });
}
