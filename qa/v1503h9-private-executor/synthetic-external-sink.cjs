'use strict';
/**
 * V15.0-03H.9 — IN-MEMORY SYNTHETIC EXTERNAL-OBJECT METADATA SINK.
 * A design/QA stand-in only: no bytes, network, file system, keys, storage
 * clients, backup executor, or runtime authorization. Nothing exported.
 */
const {createHash}=require('node:crypto');
const {PROJECT,COMPONENTS}=require('../v1503h6-backup-preflight/backup-coverage-preflight.cjs');
const CONTRACT='TIEN404_V15_03H9_EXTERNAL_IDEMPOTENCY_V1';
const MODE='SYNTHETIC_METADATA_SINK_ONLY';
const PARTS=Object.freeze(Object.keys(COMPONENTS).sort());
const HEX=/^[a-f0-9]{64}$/;
const ID=/^[A-Z][A-Z0-9_:-]{11,79}$/;
const FIELDS=['contract','mode','environment','projectRef','operationRef',
  'requestDigest','nonceDigest','workerRef','fence','leaseExpiresAtMs',
  'authorizationExpiresAtMs','expectedParts','syntheticOnly',
  'hostedExportAuthorized','realSignerVerified','externalWritesEnabled',
  'retentionDays','maxAdditionalCostUsd'];
const deny=reason=>Object.freeze({
 status:'BLOCKED',reason,hostedExported:false,artifactUploaded:false,
 realBackupVerified:false,allowedToExport:false,allowedToRestore:false,
 allowedToMigrate:false,allowedToSend:false
});
const hash=x=>createHash('sha256').update(x).digest('hex');
const exact=(x,keys)=>!!x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
function valid(p,t){
 if(!exact(p,FIELDS))return false;
 return p.contract===CONTRACT&&p.mode===MODE&&p.environment==='staging'&&
  p.projectRef===PROJECT&&ID.test(p.operationRef||'')&&ID.test(p.workerRef||'')&&
  HEX.test(p.requestDigest||'')&&HEX.test(p.nonceDigest||'')&&
  Number.isSafeInteger(p.fence)&&p.fence>0&&
  Number.isSafeInteger(p.leaseExpiresAtMs)&&Number.isSafeInteger(p.authorizationExpiresAtMs)&&
  p.leaseExpiresAtMs>t&&p.authorizationExpiresAtMs>t&&
  p.leaseExpiresAtMs<=p.authorizationExpiresAtMs&&
  Array.isArray(p.expectedParts)&&
  p.expectedParts.length===PARTS.length&&
  p.expectedParts.every((v,i)=>v===PARTS[i])&&
  p.syntheticOnly===true&&p.hostedExportAuthorized===false&&
  p.realSignerVerified===false&&p.externalWritesEnabled===false&&
  Number.isInteger(p.retentionDays)&&p.retentionDays>=1&&p.retentionDays<=30&&
  p.maxAdditionalCostUsd===0;
}
class SyntheticMetadataSink {
 #byRequest=new Map();
 constructor({now=()=>Date.now()}={}){
  if(typeof now!=='function')throw new TypeError('SYNTHETIC_CLOCK_REQUIRED');
  this.now=now;
 }
 reserve(plan){
  const t=this.now();
  if(!Number.isSafeInteger(t)||!valid(plan,t))return deny('UNTRUSTED_OR_REAL_EXPORT_PLAN');
  const existing=this.#byRequest.get(plan.requestDigest);
  if(existing){
   if(existing.operationRef!==plan.operationRef||existing.nonceDigest!==plan.nonceDigest)
     return deny('REQUEST_ALREADY_BOUND_TO_ANOTHER_OPERATION');
   if(existing.fence!==plan.fence||existing.workerRef!==plan.workerRef)
     return deny('LEASE_FENCE_OR_OPERATOR_CONFLICT');
   return Object.freeze({
    status:existing.state==='SEALED'?'ALREADY_SEALED_NO_NEW_WRITE':'ALREADY_RESERVED_NO_NEW_WRITE',
    artifactRef:existing.artifactRef,hostedExported:false,allowedToExport:false
   });
  }
  const artifactRef=hash(['TIEN404_H9_SYNTHETIC_OBJECT',PROJECT,
    plan.requestDigest,plan.nonceDigest,plan.operationRef].join('\0'));
  this.#byRequest.set(plan.requestDigest,{
    operationRef:plan.operationRef,requestDigest:plan.requestDigest,
    nonceDigest:plan.nonceDigest,workerRef:plan.workerRef,fence:plan.fence,
    leaseExpiresAtMs:plan.leaseExpiresAtMs,
    authorizationExpiresAtMs:plan.authorizationExpiresAtMs,
    artifactRef,state:'RESERVED',parts:new Map(),manifestDigest:null
  });
  return Object.freeze({status:'SYNTHETIC_RESERVATION_ONLY',artifactRef,
    hostedExported:false,allowedToExport:false});
 }
 #get(op,worker,fence,t){
  if(!ID.test(op||'')||!ID.test(worker||'')||!Number.isSafeInteger(fence))return null;
  const rec=[...this.#byRequest.values()].find(r=>r.operationRef===op);
  if(!rec)return null;
  if(rec.workerRef!==worker||rec.fence!==fence)return null;
  if(rec.state!=='RESERVED'&&rec.state!=='STAGED')return null;
  if(t>=rec.leaseExpiresAtMs||t>=rec.authorizationExpiresAtMs){
   rec.state='NEEDS_REVIEW';return null;
  }
  return rec;
 }
 stage({operationRef,workerRef,fence,component,digest,declaredBytes}={}){
  const t=this.now();
  const rec=this.#get(operationRef,workerRef,fence,t);
  if(!rec)return deny('MISSING_EXPIRED_OR_FENCED_SYNTHETIC_LEASE');
  if(!PARTS.includes(component)||!HEX.test(digest||'')||
     !Number.isSafeInteger(declaredBytes)||declaredBytes<1||declaredBytes>1000000)
    return deny('INVALID_SYNTHETIC_COMPONENT_METADATA');
  const prev=rec.parts.get(component);
  if(prev){
   if(prev.digest===digest&&prev.declaredBytes===declaredBytes)
     return Object.freeze({status:'PART_METADATA_ALREADY_PRESENT_NO_WRITE'});
   rec.state='NEEDS_REVIEW';
   return deny('CONFLICTING_PART_CANNOT_OVERWRITE');
  }
  rec.parts.set(component,{digest,declaredBytes});
  rec.state='STAGED';
  return Object.freeze({status:'SYNTHETIC_PART_METADATA_RECORDED',partCount:rec.parts.size});
 }
 seal({operationRef,workerRef,fence}={}){
  const rec=this.#get(operationRef,workerRef,fence,this.now());
  if(!rec)return deny('MISSING_EXPIRED_OR_FENCED_SYNTHETIC_LEASE');
  if(PARTS.some(k=>!rec.parts.has(k)))return deny('INCOMPLETE_METADATA_CANNOT_SEAL');
  const manifest=PARTS.map(k=>{
   const p=rec.parts.get(k);return [k,p.digest,p.declaredBytes];
  });
  rec.manifestDigest=hash(JSON.stringify({artifactRef:rec.artifactRef,manifest}));
  rec.state='SEALED';
  return Object.freeze({status:'SYNTHETIC_MANIFEST_SEALED_NOT_BACKUP',
    artifactRef:rec.artifactRef,manifestDigest:rec.manifestDigest,
    hostedExported:false,realBackupVerified:false,allowedToExport:false});
 }
 quarantine(operationRef){
  const rec=[...this.#byRequest.values()].find(r=>r.operationRef===operationRef);
  if(!rec)return deny('NO_SYNTHETIC_OPERATION_FOUND');
  if(rec.state==='SEALED')return deny('SEALED_MANIFEST_REQUIRES_SEPARATE_CUSTODY_REVIEW');
  rec.state='NEEDS_REVIEW';
  return Object.freeze({status:'SYNTHETIC_NEEDS_MANUAL_RECONCILIATION'});
 }
 inspect(operationRef){
  const rec=[...this.#byRequest.values()].find(r=>r.operationRef===operationRef);
  if(!rec)return Object.freeze({status:'NO_SYNTHETIC_ARTIFACT'});
  const uncertain=rec.state==='NEEDS_REVIEW'||(rec.state!=='SEALED'&&
    (this.now()>=rec.leaseExpiresAtMs||this.now()>=rec.authorizationExpiresAtMs));
  return Object.freeze({
   status:uncertain?'PRIVATE_MANUAL_RECONCILIATION_REQUIRED':
     rec.state==='SEALED'?'SYNTHETIC_SEALED_RECEIPT_NOT_REAL_BACKUP':'SYNTHETIC_INCOMPLETE_METADATA',
   artifactRef:rec.artifactRef,partCount:rec.parts.size,
   manifestDigest:rec.manifestDigest,verifiedBackup:false,
   hostedExported:false,allowedToExport:false
  });
 }
}
module.exports={CONTRACT,MODE,PROJECT,PARTS,SyntheticMetadataSink};
