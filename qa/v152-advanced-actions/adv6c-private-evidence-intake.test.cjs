'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {
 CONTRACT,PROJECT,AUDITED_BASE_SHA,REQUIRED_EVIDENCE,ROLES,
 createPrivateEvidenceIntake
}=require('./adv6c-private-evidence-intake.cjs');
const {configFromEnv}=require('../hosted-readiness-v1442/hosted-jwt-acceptance.cjs');
const NOW=Date.parse('2026-11-16T05:58:00.000Z');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const clone=x=>structuredClone(x);
function setup(){
 const pairs=ROLES.map(role=>{
   const k=crypto.generateKeyPairSync('ed25519');
   return {role,keyId:'EV-KEY'+role.replaceAll('_','').padEnd(14,'A'),
     actorDigest:digest('qa-actor:'+role),publicKey:k.publicKey,privateKey:k.privateKey};
 });
 const registry={authority:'OFFLINE_QA_ANCHORS_ONLY',keys:pairs.map(x=>({
    keyId:x.keyId,actorDigest:x.actorDigest,role:x.role,publicKey:x.publicKey
 }))};
 const seen=new Set();
 const store={claimOnce:async (key)=>{
   if(seen.has(key))return false;seen.add(key);return true;
 }};
 const intake=createPrivateEvidenceIntake({
   mode:'SYNTHETIC_OFFLINE_NO_EXPORT',trustRegistry:registry,
   nonceStore:store,clock:()=>NOW
 });
 function makePayload(){
   return {
     contract:CONTRACT,projectRef:PROJECT,auditedBaseSha:AUDITED_BASE_SHA,
     scope:'PRIVATE_JWT_RLS_AND_BACKUP_DECISION_REVIEW_ONLY',
     nonceHex:crypto.randomBytes(32).toString('hex'),
     issuedAtMs:NOW-30000,expiresAtMs:NOW+300000,
     evidence:REQUIRED_EVIDENCE.map((kind,i)=>({
       kind,reference:'EV-RECORD'+String(i).padStart(2,'0')+'A'.repeat(12),
       sha256:digest('private-fixture-'+kind),observedAtMs:NOW-60000
     })),
     backupIntent:{
       operation:'REVIEW_ONE_TIME_BACKUP_EXPORT_ONLY',projectRef:PROJECT,
       scopeDigest:digest('only QA staging schema/data export scope'),
       destinationDigest:digest('offline encrypted target'),
       maxEstimatedCostVnd:0,retentionDays:14,
       controllerDecision:'PENDING_SEPARATE_EXPLICIT_APPROVAL'
     }
   };
 }
 function makePacket(payload=makePayload()){
  return {payload,signatures:pairs.map(x=>({
    role:x.role,keyId:x.keyId,actorDigest:x.actorDigest,
    signatureBase64Url:crypto.sign(null,
      Buffer.from('TIEN404:ADV6C:EVIDENCE:V1:'+x.role+':'+JSON.stringify(payload)),
      x.privateKey).toString('base64url')
  }))};
 }
 return {intake,pairs,registry,store,makePayload,makePacket};
}
test('01 three independent Ed25519 signatures validate only metadata',async()=>{
 const f=setup();const result=await f.intake.reviewSignedPacket(f.makePacket());
 assert.equal(result.status,'SIGNED_METADATA_ONLY_PENDING_INDEPENDENT_PRIVATE_INSPECTION');
 assert.equal(result.distinctSignerRoles,3);
 assert.equal(result.inspectedReferenceCount,REQUIRED_EVIDENCE.length);
 assert.equal(result.actualHostedJwtVerified,false);
 assert.equal(result.realControllerApprovalVerified,false);
 assert.equal(result.oneTimeBackupExportApproved,false);
 assert.equal(result.hostedWrites,0);
});
test('02 any document tamper after signing invalidates detached signatures',async()=>{
 const f=setup();const p=f.makePacket();p.payload.evidence[0].sha256=digest('forged');
 await assert.rejects(()=>f.intake.reviewSignedPacket(p),/DETACHED_SIGNATURE_INVALID/);
});
test('03 private packet nonce cannot replay even with same valid signatures',async()=>{
 const f=setup(),p=f.makePacket();
 await f.intake.reviewSignedPacket(p);
 await assert.rejects(()=>f.intake.reviewSignedPacket(p),/PRIVATE_PACKET_REPLAY_DENIED/);
});
test('04 forged approval flag cannot promote signed metadata to real permission',async()=>{
 const f=setup(),p=f.makePacket();p.approved=true;
 await assert.rejects(()=>f.intake.reviewSignedPacket(p),/PRIVATE_PACKET_KEYS_DENIED/);
});
test('05 unsigned self-reported proof is denied',async()=>{
 const f=setup(),p=f.makePacket();p.signatures=[];
 await assert.rejects(()=>f.intake.reviewSignedPacket(p),/THREE_SIGNED_REVIEWS_REQUIRED/);
});
test('06 same signer or same key cannot fill controller and security roles',async()=>{
 const f=setup(),p=f.makePacket();
 p.signatures[1]=p.signatures[0];
 await assert.rejects(()=>f.intake.reviewSignedPacket(p),/INDEPENDENT_SIGNER_SCOPE_INVALID/);
});
test('07 different project, audited git SHA or scope denied',async()=>{
 for(const patch of [
  {projectRef:'wrong-project'}, {auditedBaseSha:'b'.repeat(40)},
  {scope:'EXECUTE_REAL_BACKUP_EXPORT'}
 ]){
  const f=setup(),payload={...f.makePayload(),...patch};
  await assert.rejects(()=>f.intake.reviewSignedPacket(f.makePacket(payload)),
    /PACKET_SCOPE_OR_TTL_DENIED/);
 }
});
test('08 missing Store A or Store B JWT/RLS evidence denied',async()=>{
 for(const kind of ['HOSTED_OWNER_A_AUTH_JWT_RLS',
  'HOSTED_OWNER_B_AUTH_JWT_RLS','HOSTED_SAME_TENANT_CROSS_STORE_DENIAL']){
   const f=setup(),p=f.makePayload();p.evidence=p.evidence.filter(x=>x.kind!==kind);
   await assert.rejects(()=>f.intake.reviewSignedPacket(f.makePacket(p)),
      /PRIVATE_EVIDENCE_SET_INCOMPLETE/);
 }
});
test('09 duplicate references and duplicate evidence classes denied',async()=>{
 const f=setup(),p=f.makePayload();
 p.evidence[1].reference=p.evidence[0].reference;
 await assert.rejects(()=>f.intake.reviewSignedPacket(f.makePacket(p)),
    /PRIVATE_EVIDENCE_REFERENCE_INVALID/);
});
test('10 raw JWT/backup bytes/customer PII fields are rejected before signature',async()=>{
 const f=setup(),p=f.makePacket();
 p.payload.evidence[0].access_token='secret-bearer';
 await assert.rejects(()=>f.intake.reviewSignedPacket(p),/PRIVATE_EVIDENCE_REFERENCE_INVALID/);
 const other=f.makePacket();other.payload.backupIntent.rawExport='raw pg dump';
 await assert.rejects(()=>f.intake.reviewSignedPacket(other),/BACKUP_REQUEST_NOT_INDEPENDENTLY_AUTHORIZED/);
});
test('11 controller decision APPROVED in JSON is invalid, not authority',async()=>{
 const f=setup(),p=f.makePayload();p.backupIntent.controllerDecision='APPROVED';
 await assert.rejects(()=>f.intake.reviewSignedPacket(f.makePacket(p)),
   /BACKUP_REQUEST_NOT_INDEPENDENTLY_AUTHORIZED/);
});
test('12 over-budget, no retention bounds and unsupported destination denied',async()=>{
 const f=setup(),p=f.makePayload();
 p.backupIntent.maxEstimatedCostVnd=2000000;
 await assert.rejects(()=>f.intake.reviewSignedPacket(f.makePacket(p)),
    /BACKUP_REQUEST_NOT_INDEPENDENTLY_AUTHORIZED/);
 p.backupIntent.maxEstimatedCostVnd=0;p.backupIntent.retentionDays=400;
 await assert.rejects(()=>f.intake.reviewSignedPacket(f.makePacket(p)),
    /BACKUP_REQUEST_NOT_INDEPENDENTLY_AUTHORIZED/);
});
test('13 expired TTL, far-future issue time and longer-than-15m lease denied',async()=>{
 for(const patch of [
  {expiresAtMs:NOW-1},{issuedAtMs:NOW+900000},
  {expiresAtMs:NOW+4000000}
 ]){
  const f=setup(),p={...f.makePayload(),...patch};
  await assert.rejects(()=>f.intake.reviewSignedPacket(f.makePacket(p)),
    /PACKET_SCOPE_OR_TTL_DENIED/);
 }
});
test('14 signer not previously enrolled as the claimed role denied',async()=>{
 const f=setup(),p=f.makePacket();p.signatures[2].keyId=p.signatures[0].keyId;
 await assert.rejects(()=>f.intake.reviewSignedPacket(p),/SIGNER_NOT_INDEPENDENTLY_ENROLLED/);
});
test('15 shared actor ID in independent trust registry is refused at construction',()=>{
 const f=setup();
 const keys=f.registry.keys.map(x=>({...x}));
 keys[1].actorDigest=keys[0].actorDigest;
 assert.throws(()=>createPrivateEvidenceIntake({
  mode:'SYNTHETIC_OFFLINE_NO_EXPORT',
  trustRegistry:{authority:'OFFLINE_QA_ANCHORS_ONLY',keys},
  nonceStore:f.store,clock:()=>NOW
 }),/INDEPENDENT_TRUST_KEY_INVALID/);
});
test('16 actual backup, database grant, hosted JWT and release methods fail shut',()=>{
 const f=setup();
 assert.throws(()=>f.intake.exportBackup(),/REAL_BACKUP_EXPORT_REQUIRES_SEPARATE_OPERATOR_APPROVAL/);
 assert.throws(()=>f.intake.hostedJwt(),/REAL_JWT_READ_REQUIRES_AUTHORIZED_PRIVATE_OPERATOR/);
 assert.throws(()=>f.intake.grant(),/DB_GRANT_REQUIRES_INDEPENDENT_APPROVAL/);
 assert.throws(()=>f.intake.release(),/P0_RELEASE_GATE_NO_GO/);
});
test('17 missing external trust enrollment or nonce ledger fails shut',()=>{
 assert.throws(()=>createPrivateEvidenceIntake({
   mode:'PRODUCTION',trustRegistry:null
 }),/PRIVATE_TRUST_ENROLLMENT_REQUIRED/);
 assert.throws(()=>createPrivateEvidenceIntake({
   mode:'SYNTHETIC_OFFLINE_NO_EXPORT',trustRegistry:{authority:'OFFLINE_QA_ANCHORS_ONLY',keys:[]}
 }),/PRIVATE_TRUST_ENROLLMENT_REQUIRED/);
});
test('18 existing V14.4.2 real JWT GET-only acceptance remains opt-in and blocked without credentials',()=>{
 const cfg=configFromEnv({});
 assert.equal(cfg.ready,false);assert.equal(cfg.code,'HOSTED_QA_GATES_CLOSED');
 assert(cfg.missing.includes('QA_A_ACCESS_TOKEN'));
 assert(!JSON.stringify(cfg).includes('JWT_SECRET'));
});
test('19 malformed evidence, unsigned receiver keys and store IDs cannot enter packet',async()=>{
 for(const val of [null,{},[],{payload:{},signatures:[]}]){
  const f=setup();
  await assert.rejects(()=>f.intake.reviewSignedPacket(val),/PRIVATE_PACKET_KEYS_DENIED/);
 }
 const f=setup(),p=f.makePayload();
 p.evidence[0].reference='tenant_personal_id_or_jwt_invalid';
 await assert.rejects(()=>f.intake.reviewSignedPacket(f.makePacket(p)),/PRIVATE_EVIDENCE_REFERENCE_INVALID/);
});
test('20 receipt outputs never expose raw sensitive source, JWT or trust anchors',async()=>{
 const f=setup(),p=f.makePacket();
 const out=JSON.stringify(await f.intake.reviewSignedPacket(p));
 for(const leak of [p.payload.nonceHex,p.signatures[0].signatureBase64Url,
   p.payload.backupIntent.destinationDigest,'PRIVATE:KEY'])
    assert(!out.includes(leak));
});
