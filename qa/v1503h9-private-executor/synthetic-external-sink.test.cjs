'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {CONTRACT,MODE,PROJECT,PARTS,SyntheticMetadataSink}=require('./synthetic-external-sink.cjs');
const NOW=Date.parse('2026-11-16T13:35:00+09:00');
const hash=s=>createHash('sha256').update(s).digest('hex');
function plan(overrides={}){
 return {
 contract:CONTRACT,mode:MODE,environment:'staging',projectRef:PROJECT,
 operationRef:'QA_H9_OPERATION_0001',requestDigest:hash('request 1'),
 nonceDigest:hash('nonce 1'),workerRef:'QA_H9_OPERATOR_0001',fence:1,
 leaseExpiresAtMs:NOW+60000,authorizationExpiresAtMs:NOW+120000,
 expectedParts:[...PARTS],syntheticOnly:true,
 hostedExportAuthorized:false,realSignerVerified:false,
 externalWritesEnabled:false,retentionDays:7,maxAdditionalCostUsd:0,
 ...overrides
 };
}
function sink(clock=()=>NOW){return new SyntheticMetadataSink({now:clock});}
const metadata=(p,i)=>({
 operationRef:p.operationRef,workerRef:p.workerRef,fence:p.fence,
 component:PARTS[i],digest:hash('mock metadata '+i),declaredBytes:1000+i
});
function writeAll(s,p){
 for(let i=0;i<PARTS.length;i++)
  assert.equal(s.stage(metadata(p,i)).status,'SYNTHETIC_PART_METADATA_RECORDED');
}
function seal(s,p){return s.seal({operationRef:p.operationRef,workerRef:p.workerRef,fence:p.fence});}
test('initial synthetic reservation has no hosted side effect',()=>{
 const s=sink(),p=plan(),r=s.reserve(p);
 assert.equal(r.status,'SYNTHETIC_RESERVATION_ONLY');
 assert.match(r.artifactRef,/^[a-f0-9]{64}$/);
 assert.equal(r.allowedToExport,false);
 assert.equal(r.hostedExported,false);
 assert.equal(s.inspect(p.operationRef).partCount,0);
});
test('identical reservation cannot create second artifact',()=>{
 const s=sink(),p=plan(),a=s.reserve(p),b=s.reserve(p);
 assert.equal(b.status,'ALREADY_RESERVED_NO_NEW_WRITE');
 assert.equal(a.artifactRef,b.artifactRef);
});
test('same request with changed operation rejected',()=>{
 const s=sink(),p=plan();s.reserve(p);
 assert.equal(s.reserve({...p,operationRef:'QA_H9_DIFFERENT_OPERATION_0002'}).status,'BLOCKED');
});
test('same request with changed nonce rejected',()=>{
 const s=sink(),p=plan();s.reserve(p);
 assert.equal(s.reserve({...p,nonceDigest:hash('different nonce')}).status,'BLOCKED');
});
test('same request with changed fence rejected',()=>{
 const s=sink(),p=plan();s.reserve(p);
 assert.equal(s.reserve({...p,fence:2}).status,'BLOCKED');
});
test('same request with changed worker rejected',()=>{
 const s=sink(),p=plan();s.reserve(p);
 assert.equal(s.reserve({...p,workerRef:'QA_H9_OPERATOR_OTHER_0001'}).status,'BLOCKED');
});
test('repeated component with same immutable metadata is no-op',()=>{
 const s=sink(),p=plan();s.reserve(p);
 const m=metadata(p,0);
 assert.equal(s.stage(m).status,'SYNTHETIC_PART_METADATA_RECORDED');
 assert.equal(s.stage(m).status,'PART_METADATA_ALREADY_PRESENT_NO_WRITE');
 assert.equal(s.inspect(p.operationRef).partCount,1);
});
test('same component with different digest quarantines, no overwrite or retry',()=>{
 const s=sink(),p=plan();s.reserve(p);let m=metadata(p,0);s.stage(m);
 assert.equal(s.stage({...m,digest:hash('malicious replaced payload')}).status,'BLOCKED');
 assert.equal(s.inspect(p.operationRef).status,'PRIVATE_MANUAL_RECONCILIATION_REQUIRED');
 assert.equal(s.reserve(p).status,'NEEDS_REVIEW_NO_AUTOMATIC_RETRY');
});
test('same component with changed size quarantines',()=>{
 const s=sink(),p=plan();s.reserve(p);let m=metadata(p,0);s.stage(m);
 assert.equal(s.stage({...m,declaredBytes:m.declaredBytes+1}).status,'BLOCKED');
 assert.equal(s.inspect(p.operationRef).partCount,1);
});
test('sealed synthetic metadata is immutable and not a real backup',()=>{
 const s=sink(),p=plan();s.reserve(p);writeAll(s,p);
 const out=seal(s,p);
 assert.equal(out.status,'SYNTHETIC_MANIFEST_SEALED_NOT_BACKUP');
 assert.match(out.manifestDigest,/^[a-f0-9]{64}$/);
 assert.equal(out.realBackupVerified,false);
 assert.equal(s.reserve(p).status,'ALREADY_SEALED_NO_NEW_WRITE');
 assert.equal(seal(s,p).status,'BLOCKED');
 assert.equal(s.stage(metadata(p,0)).status,'BLOCKED');
 assert.equal(s.inspect(p.operationRef).manifestDigest,out.manifestDigest);
});
test('ACK lost after seal: independent inspect shows one sealed mock artifact',()=>{
 const s=sink(),p=plan();s.reserve(p);writeAll(s,p);
 seal(s,p); // Simulate client losing the success response.
 const observed=s.inspect(p.operationRef);
 assert.equal(observed.status,'SYNTHETIC_SEALED_RECEIPT_NOT_REAL_BACKUP');
 assert.equal(observed.partCount,PARTS.length);
 assert.equal(s.reserve(p).status,'ALREADY_SEALED_NO_NEW_WRITE');
 assert.equal(s.inspect(p.operationRef).manifestDigest,observed.manifestDigest);
});
test('partial interrupted stage requires manual review',()=>{
 const s=sink(),p=plan();s.reserve(p);s.stage(metadata(p,0));
 assert.equal(s.quarantine(p.operationRef).status,'SYNTHETIC_NEEDS_MANUAL_RECONCILIATION');
 assert.equal(s.reserve(p).status,'NEEDS_REVIEW_NO_AUTOMATIC_RETRY');
 assert.equal(s.stage(metadata(p,1)).status,'BLOCKED');
 assert.equal(s.inspect(p.operationRef).status,'PRIVATE_MANUAL_RECONCILIATION_REQUIRED');
});
test('cannot quarantine sealed synthetic manifest without separate custody review',()=>{
 const s=sink(),p=plan();s.reserve(p);writeAll(s,p);seal(s,p);
 assert.equal(s.quarantine(p.operationRef).status,'BLOCKED');
 assert.equal(s.inspect(p.operationRef).status,'SYNTHETIC_SEALED_RECEIPT_NOT_REAL_BACKUP');
});
test('missing one of twelve components fails closed',()=>{
 const s=sink(),p=plan();s.reserve(p);
 for(let i=0;i<PARTS.length-1;i++)s.stage(metadata(p,i));
 assert.equal(seal(s,p).reason,'INCOMPLETE_METADATA_CANNOT_SEAL');
 assert.equal(s.inspect(p.operationRef).partCount,PARTS.length-1);
});
test('concurrent reservation race: one synthetic operation, no duplicates',async()=>{
 const s=sink(),p=plan();
 const r=await Promise.all(Array.from({length:16},()=>Promise.resolve().then(()=>s.reserve(p))));
 assert.equal(r.filter(x=>x.status==='SYNTHETIC_RESERVATION_ONLY').length,1);
 assert.equal(r.filter(x=>x.status==='ALREADY_RESERVED_NO_NEW_WRITE').length,15);
 assert.equal(new Set(r.map(x=>x.artifactRef)).size,1);
});
test('lease expiry during metadata staging quarantines',()=>{
 let clock=NOW;const s=sink(()=>clock),p=plan();s.reserve(p);s.stage(metadata(p,0));
 clock=NOW+60000;
 assert.equal(s.stage(metadata(p,1)).status,'BLOCKED');
 assert.equal(s.inspect(p.operationRef).status,'PRIVATE_MANUAL_RECONCILIATION_REQUIRED');
 assert.equal(s.reserve({...p,leaseExpiresAtMs:NOW+180000,authorizationExpiresAtMs:NOW+240000}).status,'NEEDS_REVIEW_NO_AUTOMATIC_RETRY');
});
test('authorization expiry before sealing also quarantines',()=>{
 let clock=NOW;const s=sink(()=>clock),p=plan();s.reserve(p);writeAll(s,p);
 clock=NOW+120000;
 assert.equal(seal(s,p).status,'BLOCKED');
 assert.equal(s.inspect(p.operationRef).status,'PRIVATE_MANUAL_RECONCILIATION_REQUIRED');
});
test('different request/nonce can create a different metadata receipt',()=>{
 const s=sink(),p=plan(),q={...plan(),requestDigest:hash('request 2'),nonceDigest:hash('nonce 2'),operationRef:'QA_H9_OPERATION_0002'};
 assert.equal(s.reserve(p).status,'SYNTHETIC_RESERVATION_ONLY');
 assert.equal(s.reserve(q).status,'SYNTHETIC_RESERVATION_ONLY');
 assert.notEqual(s.inspect(p.operationRef).artifactRef,s.inspect(q.operationRef).artifactRef);
});
test('no matching operation returns no synthetic artifact',()=>{
 assert.equal(sink().inspect('QA_H9_UNKNOWN_OPERATION_0001').status,'NO_SYNTHETIC_ARTIFACT');
});
function invalidPlan(label,edit){
 test(label+' denied without creating any mock receipt',()=>{
  const s=sink(),p=plan();edit(p);
  const r=s.reserve(p);
  assert.equal(r.status,'BLOCKED',label);
  assert.equal(r.allowedToExport,false);
  assert.equal(s.inspect('QA_H9_OPERATION_0001').status,'NO_SYNTHETIC_ARTIFACT');
 });
}
invalidPlan('production scope',p=>p.environment='production');
invalidPlan('another project',p=>p.projectRef='another-project');
invalidPlan('unknown mode',p=>p.mode='REAL_S3_UPLOAD');
invalidPlan('real export authorized flag',p=>p.hostedExportAuthorized=true);
invalidPlan('real human signature claimed',p=>p.realSignerVerified=true);
invalidPlan('external writes enabled',p=>p.externalWritesEnabled=true);
invalidPlan('synthetic-only disabled',p=>p.syntheticOnly=false);
invalidPlan('unknown contract',p=>p.contract='LIVE');
invalidPlan('wrong digest',p=>p.requestDigest='wrong');
invalidPlan('missing nonce',p=>p.nonceDigest='wrong');
invalidPlan('non-positive fence',p=>p.fence=0);
invalidPlan('unbounded fence',p=>p.fence=1.5);
invalidPlan('expired lease',p=>p.leaseExpiresAtMs=NOW-1);
invalidPlan('expired authorization',p=>p.authorizationExpiresAtMs=NOW-1);
invalidPlan('lease exceeds authorization',p=>p.leaseExpiresAtMs=NOW+130000);
invalidPlan('missing component',p=>p.expectedParts.pop());
invalidPlan('unknown component',p=>p.expectedParts[0]='other');
invalidPlan('component reorder',p=>p.expectedParts.reverse());
invalidPlan('unapproved cost',p=>p.maxAdditionalCostUsd=1);
invalidPlan('retention too long',p=>p.retentionDays=31);
invalidPlan('retention zero',p=>p.retentionDays=0);
invalidPlan('unknown field canExecute',p=>p.canExecute=true);
invalidPlan('raw content injected',p=>p.payload='CUSTOMER_DATA');
invalidPlan('embedded secret token',p=>p.access_token='SECRET');
invalidPlan('bad operation ID',p=>p.operationRef='x');
invalidPlan('bad worker ID',p=>p.workerRef='x');
test('unknown component is rejected even with valid lease',()=>{
 const s=sink(),p=plan();s.reserve(p);
 assert.equal(s.stage({...metadata(p,0),component:'unknown'}).status,'BLOCKED');
});
test('invalid digest/declared bytes rejected without staging data',()=>{
 const s=sink(),p=plan();s.reserve(p);
 for(const x of [{digest:'bad'},{declaredBytes:0},{declaredBytes:-1},{declaredBytes:1000001},{declaredBytes:1.4}])
  assert.equal(s.stage({...metadata(p,0),...x}).status,'BLOCKED');
 assert.equal(s.inspect(p.operationRef).partCount,0);
});
test('wrong worker/fence rejected for stage and seal',()=>{
 const s=sink(),p=plan();s.reserve(p);
 assert.equal(s.stage({...metadata(p,0),workerRef:'QA_H9_OTHER_OPERATOR_0001'}).status,'BLOCKED');
 assert.equal(s.stage({...metadata(p,0),fence:2}).status,'BLOCKED');
 assert.equal(s.seal({operationRef:p.operationRef,workerRef:p.workerRef,fence:2}).status,'BLOCKED');
});
test('unknown operation and sealed endpoint never allow a retry',()=>{
 const s=sink(),p=plan();
 assert.equal(s.quarantine('QA_H9_UNKNOWN_OPERATION_0001').status,'BLOCKED');
 assert.equal(s.stage(metadata(p,0)).status,'BLOCKED');
 assert.equal(seal(s,p).status,'BLOCKED');
});
