'use strict';
/**
 * TIEN404 V14.4.4 — private offline ownership intake QA ONLY.
 * Reuses V14.4.3 reviewPrivateEvidence to avoid rebuilding validation.
 * Session data is memory-only; NEVER export rows, tokens, record UUIDs,
 * tenant/store IDs, customer PII or evidence payloads.
 * "Reviewed" below is a synthetic QA outcome, NOT signed owner approval.
 */
const {randomUUID}=require('node:crypto');
const {reviewPrivateEvidence}=require('../security-definer-v1443/four-row-owner-evidence.cjs');
const PROJECT='ifxlvrhyjhbzbrkdsida';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reject(code){const e=new Error(code);e.code=code;throw e;}
function createOfflineOwnershipIntake({mode,ports,now=Date.now,maxSessions=20,ttlMs=900000}={}){
 if(mode!=='OFFLINE_SYNTHETIC_QA'||ports?.mode!=='SYNTHETIC_PRIVATE_ROLE_REGISTRY'||
  typeof ports.verifyBearer!=='function'||typeof ports.checkTenantRole!=='function'||
  typeof now!=='function'||!Number.isInteger(maxSessions)||maxSessions<1||
  maxSessions>100||!Number.isInteger(ttlMs)||ttlMs<60000||ttlMs>3600000)
  reject('INTAKE_OFFLINE_ADAPTER_REQUIRED');
 const sessions=new Map();
 async function user(bearer){
  const u=await ports.verifyBearer(bearer);
  if(!u||u.verifiedBy!=='SYNTHETIC_AUTH_SERVER'||u.active!==true||
   !UUID.test(u.id||''))reject('INTAKE_IDENTITY_UNVERIFIED');
  return u;
 }
 async function right(u,tenant,role,storeId=null){
  const a=await ports.checkTenantRole({userId:u.id,tenantId:tenant,role,storeId});
  if(!a||a.source!=='SYNTHETIC_PRIVATE_ROLE_REGISTRY'||
    a.userId!==u.id||a.tenantId!==tenant||a.role!==role||a.active!==true||
    (storeId!==null&&a.storeId!==storeId))
   reject('INTAKE_ROLE_NOT_AUTHORIZED');
 }
 function session(id){
  const s=sessions.get(id);
  if(!s)reject('INTAKE_SESSION_NOT_FOUND');
  if(s.expiresAt<=now()){sessions.delete(id);reject('INTAKE_SESSION_EXPIRED');}
  return s;
 }
 function summary(s){
  return Object.freeze({sessionId:s.id,status:s.status,
   productCount:2,orderCount:2,merchantConfirmations:s.merchantsConfirmed.size,
   merchantConfirmationsRequired:s.merchants.size,
   reviewerActed:s.reviewerActed,containsPrivateRecords:false,
   actualOwnerSignatureVerified:false,independentHostedReadbackVerified:false,
   canBackfill:false,canApplyMigration:false,canSendMessages:false});
 }
 async function stage({bearer,rows,baseline}={}){
  const operator=await user(bearer);
  const evidence=reviewPrivateEvidence({
   projectRef:PROJECT,mode:'PRIVATE_OPERATOR_REVIEW_ONLY',rows,baseline},now());
  if(evidence.issues.length)reject('INTAKE_EVIDENCE_LINT_FAILED');
  const tenants=[...new Set(rows.map(r=>r.tenantId))];
  for(const t of tenants)await right(operator,t,'QA_INTAKE_OPERATOR');
  if(sessions.size>=maxSessions)reject('INTAKE_SESSION_CAP_REACHED');
  const id=randomUUID();
  const merchants=new Map(),merchantTenants=new Map();
  for(const r of rows){
   const prior=merchantTenants.get(r.merchantActorId);
   if(prior&&prior!==r.tenantId)
    reject('INTAKE_REQUIRES_TWO_INDEPENDENT_TENANT_MERCHANTS');
   merchantTenants.set(r.merchantActorId,r.tenantId);
   const k=r.tenantId+'|'+r.merchantActorId;
   merchants.set(k,{tenantId:r.tenantId,merchantActorId:r.merchantActorId,
      storeId:r.candidateStoreId});
  }
  if(merchants.size!==2)reject('INTAKE_REQUIRES_TWO_INDEPENDENT_TENANT_MERCHANTS');
  const snapshot={id,createdBy:operator.id,expiresAt:now()+ttlMs,tenants,
   merchants,merchantsConfirmed:new Set(),reviewerActed:false,
   status:'AWAITING_MERCHANT_CONFIRMATIONS'};
  sessions.set(id,snapshot);
  return summary(snapshot);
 }
 async function merchantConfirm({bearer,sessionId}={}){
  const actor=await user(bearer);
  const s=session(sessionId);
  if(s.status!=='AWAITING_MERCHANT_CONFIRMATIONS')
   reject('INTAKE_WRONG_STEP');
  const entry=[...s.merchants.entries()].find(([,m])=>m.merchantActorId===actor.id);
  if(!entry)reject('INTAKE_MERCHANT_NOT_ASSIGNED');
  const [key,grant]=entry;
  await right(actor,grant.tenantId,'MERCHANT_OWNER',grant.storeId);
  if(s.merchantsConfirmed.has(key))reject('INTAKE_DUPLICATE_MERCHANT_CONFIRM');
  s.merchantsConfirmed.add(key);
  if(s.merchantsConfirmed.size===s.merchants.size)
   s.status='AWAITING_INDEPENDENT_QA';
  return summary(s);
 }
 async function independentReview({bearer,sessionId,decision}={}){
  const actor=await user(bearer);
  const s=session(sessionId);
  if(s.status!=='AWAITING_INDEPENDENT_QA')
   reject('INTAKE_WRONG_STEP');
  if(s.createdBy===actor.id||[...s.merchants.values()].some(m=>m.merchantActorId===actor.id))
   reject('INTAKE_SELF_REVIEW_DENIED');
  for(const t of s.tenants)await right(actor,t,'QA_INDEPENDENT_REVIEWER');
  if(!['ACCEPT_FOR_ADDITIONAL_HOSTED_VERIFICATION','REJECT_INSUFFICIENT_EVIDENCE']
       .includes(decision))reject('INTAKE_DECISION_INVALID');
  s.reviewerActed=true;
  s.status=decision==='REJECT_INSUFFICIENT_EVIDENCE'?'REJECTED_FOR_PRIVATE_REVISION':
   'PRIVATE_QA_REVIEW_COMPLETED_NOT_HOSTED_VERIFIED';
  return summary(s);
 }
 function inspect(){
  let valid=0;
  for(const [k,v] of sessions){
   if(v.expiresAt<=now())sessions.delete(k);else valid++;
  }
  return Object.freeze({
   mode:'OFFLINE_SYNTHETIC_QA',activeSessions:valid,
   realOwnerApprovals:0,hostedWrites:0,recordsBackfilled:0,
   canBackfill:false,canPublish:false,canChangeRls:false,
   containsPrivateRows:false,canSendMessages:false});
 }
 return Object.freeze({stage,merchantConfirm,independentReview,inspect});
}
module.exports={createOfflineOwnershipIntake};
