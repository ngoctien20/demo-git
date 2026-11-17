'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createPrivateAdmissionGate,nativeJwtVerify}=require('../v171t-private-uat/private-admission.cjs');
const {createPrivateEvidenceIntake}=require('./private-evidence-intake.cjs');
const NOW=Date.parse('2026-11-17T08:30:00Z'),TS=Math.floor(NOW/1000);
const ISS='https://example-supabase-qa.supabase.co/auth/v1';
const SA='11111111-1111-4111-8111-111111111111',SB='22222222-2222-4222-8222-222222222222';
const XA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',XB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const rsa=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const ec=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const jwks={keys:[{...rsa.publicKey.export({format:'jwk'}),kid:'QA_RSA',alg:'RS256'},
 {...ec.publicKey.export({format:'jwk'}),kid:'QA_EC',alg:'ES256'}]};
function token(overrides={},h={}) {
 const head={alg:'RS256',typ:'JWT',kid:'QA_RSA',...h};
 const body={iss:ISS,aud:'authenticated',role:'authenticated',sub:SA,session_id:XA,
   iat:TS-20,nbf:TS-20,exp:TS+300,...overrides};
 const p1=Buffer.from(JSON.stringify(head)).toString('base64url');
 const p2=Buffer.from(JSON.stringify(body)).toString('base64url');
 const sig=crypto.sign('sha256',Buffer.from(p1+'.'+p2),rsa.privateKey).toString('base64url');
 return p1+'.'+p2+'.'+sig;
}
function tokenEc(){
 const h=Buffer.from(JSON.stringify({alg:'ES256',typ:'JWT',kid:'QA_EC'})).toString('base64url');
 const p=Buffer.from(JSON.stringify({iss:ISS,aud:'authenticated',role:'authenticated',
  sub:SA,session_id:XA,iat:TS-20,exp:TS+300})).toString('base64url');
 const sig=crypto.sign('sha256',Buffer.from(h+'.'+p),{key:ec.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 return h+'.'+p+'.'+sig;
}
function meta(page='QA_PAGE_A',sender='QA_SENDER_A',id='QA_MSG_A',timestamp=NOW,echo=false){
 return Buffer.from(JSON.stringify({object:'page',entry:[{id:page,messaging:[{
   sender:{id:sender},recipient:{id:page},timestamp,
   message:{mid:id,text:'CATALOG',...(echo?{is_echo:true}:{})}
 }]}]}));
}
function zalo(oa='QA_OA_A',sender='QA_SENDER_A',id='QA_MSG_ZA',timestamp=NOW,appId='QA_APP'){
 return Buffer.from(JSON.stringify({app_id:appId,recipient:{id:oa},sender:{id:sender},
  event_name:'user_send_text',message:{msg_id:id,text:'CATALOG'},timestamp:String(timestamp)}));
}
const SECRET_META='TEST_ONLY_META_SECRET_NONPRODUCTION_ONLY_123';
const SECRET_ZALO='TEST_ONLY_ZALO_SECRET_NONPRODUCTION_ONLY_123';
const metaSig=(raw,secret=SECRET_META)=>'sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');
const zaloSig=(raw,secret=SECRET_ZALO)=>{
 const p=JSON.parse(raw.toString());return 'mac='+crypto.createHash('sha256')
  .update(p.app_id+raw.toString()+p.timestamp+secret).digest('hex');
};
function ctx(changes={}){
 const used=new Set();
 const owner={
  [SA]:{ownerUserId:SA,tenantId:'QA_SAME_TENANT',storeId:'STORE_A',active:true,role:'owner',ownerProof:'PRIVATE_OWNER_VERIFIED'},
  [SB]:{ownerUserId:SB,tenantId:'QA_SAME_TENANT',storeId:'STORE_B',active:true,role:'owner',ownerProof:'PRIVATE_OWNER_VERIFIED'}};
 const sessions={
  [SA]:{subject:SA,sessionId:XA,active:true},[SB]:{subject:SB,sessionId:XB,active:true}};
 const installs={
  'MESSENGER:QA_PAGE_A':{installationId:'META_A',channel:'MESSENGER',tenantId:'QA_SAME_TENANT',storeId:'STORE_A',destinationId:'QA_PAGE_A',active:true,ownerProof:'PRIVATE_OWNER_VERIFIED'},
  'MESSENGER:QA_PAGE_B':{installationId:'META_B',channel:'MESSENGER',tenantId:'QA_SAME_TENANT',storeId:'STORE_B',destinationId:'QA_PAGE_B',active:true,ownerProof:'PRIVATE_OWNER_VERIFIED'},
  'ZALO:QA_OA_A':{installationId:'ZALO_A',channel:'ZALO',tenantId:'QA_SAME_TENANT',storeId:'STORE_A',destinationId:'QA_OA_A',appId:'QA_APP',active:true,ownerProof:'PRIVATE_OWNER_VERIFIED'},
  'ZALO:QA_OA_B':{installationId:'ZALO_B',channel:'ZALO',tenantId:'QA_SAME_TENANT',storeId:'STORE_B',destinationId:'QA_OA_B',appId:'QA_APP',active:true,ownerProof:'PRIVATE_OWNER_VERIFIED'}};
 const grants={
  'STORE_A:ORDER_A':{valid:true,tenantId:'QA_SAME_TENANT',storeId:'STORE_A',senderId:'QA_SENDER_A',orderId:'ORDER_A',channel:'MESSENGER',challengeStatus:'INDEPENDENT_HUMAN_VERIFIED'}};
 const config={jwks,issuer:ISS,clock:()=>NOW,
  lookupSession:async({subject,sessionId})=>sessions[subject]?.sessionId===sessionId?sessions[subject]:null,
  lookupOwnerStore:async({subject})=>owner[subject]||null,
  lookupInstallation:async({channel,destinationId})=>installs[channel+':'+destinationId]||null,
  getProviderSecret:async({channel})=>channel==='MESSENGER'?SECRET_META:SECRET_ZALO,
  reserveReplayOnce:async({key})=>{if(used.has(key))return false;used.add(key);return true;},
  lookupCustomerOrderGrant:async({storeId,orderId})=>grants[storeId+':'+orderId]||null,
  ...changes};
 return {gate:createPrivateAdmissionGate(config),sessions,owner,installs,grants,config};
}
const auth=(c=ctx(),t=token(),store='STORE_A')=>c.gate.admitOwnerJwt({token:t,targetStoreId:store});
const admitMeta=(c=ctx(),b=meta(),sig=metaSig(b))=>c.gate.admitProviderEvent({channel:'MESSENGER',rawBody:b,signature:sig});
const admitZalo=(c=ctx(),b=zalo(),sig=zaloSig(b))=>c.gate.admitProviderEvent({channel:'ZALO',rawBody:b,signature:sig});
async function denied(p,reason){const v=await p;assert.equal(v.ok,false);if(reason)assert.equal(v.reason,reason);}

const T_ROLES=['OPERATOR','SECURITY_REVIEWER','OWNER_STORE_A','OWNER_STORE_B'];
function operatorEnv(configOverrides={}){
 const keysets={};const signers={};const consumed=new Set();
 for(const [i,role] of T_ROLES.entries()){
  const pair=crypto.generateKeyPairSync('ed25519');
  const kid='QA_SIGNER_'+role, signerRef='QA_REF_'+String(i);
  const entry={kid,role,signerRef,active:true,
   ownerProof:'PRIVATELY_ENROLLED_SIGNER',
   publicJwk:pair.publicKey.export({format:'jwk'})};
  if(role==='OWNER_STORE_A'||role==='OWNER_STORE_B'){
   entry.ownerUserId=role==='OWNER_STORE_A'?SA:SB;
   entry.storeId=role==='OWNER_STORE_A'?'STORE_A':'STORE_B';
   entry.tenantId='QA_SAME_TENANT';
  }
  keysets[role]=pair;signers[role]=entry;
 }
 let c;
 const config={
  expectedApprovalCommitSha:'a'.repeat(40),
  lookupPrivateApproverKey:async({role,kid})=>signers[role]?.kid===kid?signers[role]:null,
  reservePrivateApprovalNonceOnce:async({nonce,digest})=>{
   const k=nonce+'|'+digest;
   if(consumed.has(k))return false;
   consumed.add(k);return true;
  },...configOverrides};
 c=ctx(config);
 const intent={
  schema:'TIEN404_V171T_OPERATOR_AUTH_V1',
  scope:'PRIVATE_TWO_STORE_NO_SEND_AUTH_ADMISSION',
  projectRef:'ifxlvrhyjhbzbrkdsida',
  tenantId:'QA_SAME_TENANT',stores:['STORE_A','STORE_B'],
  commitSha:'a'.repeat(40),
  nonce:'QA_VALID_OPERATOR_NONCE_012345',
  issuedAtMs:NOW,expiresAtMs:NOW+120000,
  noSend:true,noWrite:true,noBilling:true,noCredentialChange:true
 };

 const evidenceSigner=crypto.generateKeyPairSync('ed25519');
 const evidenceAttestor={kid:'QA_EVIDENCE_ATTESTOR',role:'INDEPENDENT_EVIDENCE_ATTESTOR',
  active:true,enrollment:'PRIVATELY_ENROLLED',publicJwk:evidenceSigner.publicKey.export({format:'jwk'})};
 const records=new Map(),reviewUses=new Set();
 const intakeGate=createPrivateEvidenceIntake({
  privateGateOptions:c.config,clock:()=>NOW,
  lookupEvidenceRecord:async({ref})=>records.get(ref),
  lookupAttestorKey:async()=>evidenceAttestor,
  reserveEvidenceReviewOnce:async({digest})=>{
   if(reviewUses.has(digest))return false;reviewUses.add(digest);return true;
  }
 });
 const evidenceRefs=['OWNER_A_PROOF','OWNER_B_PROOF','OPERATOR_SCOPE','SECURITY_REVIEW']
 .map((type,i)=>({type,ref:'ev_'+String(i).repeat(25)+String(i)}));
 function resignRecord(r){
  const bytes=Buffer.from('TIEN404_V171U_PRIVATE_EVIDENCE_ATTESTATION_V1\0'+JSON.stringify({
   ref:r.ref,kind:r.kind,tenantId:r.tenantId,storeId:r.storeId,
   status:r.status,visibility:r.visibility,scan:r.scan,cdr:r.cdr,
   sha256:r.sha256,objectVersion:r.objectVersion,bytes:r.bytes,mime:r.mime,
   scannedAtMs:r.scannedAtMs,reviewedAtMs:r.reviewedAtMs,expiresAtMs:r.expiresAtMs
  }));
  r.attestationSignature=crypto.sign(null,bytes,evidenceSigner.privateKey).toString('base64url');
 }
 for(const [i,slot] of evidenceRefs.entries()){
  const r={ref:slot.ref,kind:slot.type,tenantId:'QA_SAME_TENANT',
   storeId:i===0?'STORE_A':i===1?'STORE_B':'SCOPE_ALL',
   status:'PRIVATE_REVIEW_APPROVED',visibility:'PRIVATE_NO_PUBLIC_URL',
   sha256:'a'.repeat(64),objectVersion:'QA_VERSION_01',
   bytes:1024,mime:'application/pdf',scan:'CLEAN_INDEPENDENT_SCANNER',
   cdr:'SANITIZED_AND_VERIFIED',scannedAtMs:NOW-5000,
   reviewedAtMs:NOW-4000,expiresAtMs:NOW+90000,
   attestorKid:'QA_EVIDENCE_ATTESTOR'};
  resignRecord(r);records.set(slot.ref,r);
 }
 function signAll(target=intent){
  return T_ROLES.map(role=>{
   const kid=signers[role].kid;
   const msg=Buffer.from('TIEN404_V171T_PRIVATE_OPERATOR_SIGNED_APPROVAL_V1\0'+
    JSON.stringify({intent:target,role,kid}));
   const signature=crypto.sign(null,msg,keysets[role].privateKey).toString('base64url');
   return {role,kid,signature};
  });
 }
 async function pair(){
  const a=await intakeGate.admitOwnerJwt({token:token(),targetStoreId:'STORE_A'}),b=await intakeGate.admitOwnerJwt({token:token({sub:SB,session_id:XB}),targetStoreId:'STORE_B'});
  assert.equal(a.ok,true);assert.equal(b.ok,true);
  return [a.receipt,b.receipt];
 }
 return {c,signers,keysets,intent,signAll,pair,consumed,intakeGate,evidenceRefs,records,resignRecord,evidenceAttestor,reviewUses};
}


async function intake(e,opts={}){
 const owners=opts.owners||await e.pair();
 return e.intakeGate.planPrivateIdentityProvisioningReview({
  owners,intent:opts.intent||e.intent,approvals:opts.approvals||e.signAll(),
  evidenceRefs:opts.evidenceRefs||e.evidenceRefs
 });
}
test('U01 4 private scanned attested references produce review-only plan',async()=>{
 const e=operatorEnv(),r=await intake(e);
 assert.equal(r.ok,true);
 assert.equal(r.plan.kind,'PRIVATE_QA_IDENTITY_PROVISIONING_REVIEW_ONLY');
 assert.equal(r.plan.independentEvidenceAttestationsChecked,true);
 assert.equal(r.plan.identityProvisioningApproved,false);
 assert.equal(r.plan.allowAuthWrites,false);
 assert.equal(r.plan.allowMembershipWrites,false);
 assert.equal(r.plan.allowStorageUpload,false);
 assert.equal(r.plan.productionReleaseApproved,false);
 assert.equal(r.plan.realHostedUatAttested,false);
 assert.equal(r.plan.release,'HOSTED_NO_GO');
});
test('U02 result does not leak private filenames, tokens, subjects or evidence ref',async()=>{
 const e=operatorEnv(),r=await intake(e),serialized=JSON.stringify(r);
 assert.equal(r.ok,true);
 for(const val of [e.evidenceRefs[0].ref,SA,SB,XA,XB,e.intent.nonce,
  'QA_EVIDENCE_ATTESTOR','QA_VERSION_01'])assert.equal(serialized.includes(val),false);
});
test('U03 user cannot submit raw document bytes as a reference',async()=>{
 const e=operatorEnv(),refs=[...e.evidenceRefs];refs[0]={...refs[0],rawFile:'data:application/pdf;base64,ABC'};
 await denied(intake(e,{evidenceRefs:refs}),'INTAKE_REFERENCE_SHAPE');
});
test('U04 URLs and SSRF locator rejected before any authorization',async()=>{
 const e=operatorEnv(),refs=e.evidenceRefs.map(x=>({...x}));
 refs[0].ref='http://169.254.169.254/latest/meta-data/';
 await denied(intake(e,{evidenceRefs:refs}),'INTAKE_REFERENCE_DUPLICATE_OR_UNSAFE');
});
test('U05 duplicate type cannot count as distinct private evidence',async()=>{
 const e=operatorEnv(),refs=e.evidenceRefs.map(x=>({...x}));
 refs[1].type=refs[0].type;
 await denied(intake(e,{evidenceRefs:refs}),'INTAKE_REFERENCE_DUPLICATE_OR_UNSAFE');
});
test('U06 duplicate reference cannot count as independent evidence',async()=>{
 const e=operatorEnv(),refs=e.evidenceRefs.map(x=>({...x}));
 refs[1].ref=refs[0].ref;
 await denied(intake(e,{evidenceRefs:refs}),'INTAKE_REFERENCE_DUPLICATE_OR_UNSAFE');
});
test('U07 missing owner A private record denies',async()=>{
 const e=operatorEnv();e.records.delete(e.evidenceRefs[0].ref);
 await denied(intake(e),'INTAKE_EVIDENCE_NOT_PRIVATE_APPROVED');
});
test('U08 public visibility and signed URL are denied',async()=>{
 const e=operatorEnv(),r=e.records.get(e.evidenceRefs[0].ref);
 r.visibility='PUBLIC';e.resignRecord(r);
 await denied(intake(e),'INTAKE_EVIDENCE_NOT_PRIVATE_APPROVED');
});
test('U09 document with an embedded public URL property is denied',async()=>{
 const e=operatorEnv(),r=e.records.get(e.evidenceRefs[0].ref);
 r.publicUrl='https://attacker.example/exfil';
 await denied(intake(e),'INTAKE_EVIDENCE_NOT_PRIVATE_APPROVED');
});
test('U10 unsafe malware scanning verdict is denied',async()=>{
 const e=operatorEnv(),r=e.records.get(e.evidenceRefs[0].ref);
 r.scan='UNKNOWN';e.resignRecord(r);
 await denied(intake(e),'INTAKE_EVIDENCE_NOT_PRIVATE_APPROVED');
});
test('U11 not sanitized document is denied',async()=>{
 const e=operatorEnv(),r=e.records.get(e.evidenceRefs[0].ref);
 r.cdr='PENDING';e.resignRecord(r);
 await denied(intake(e),'INTAKE_EVIDENCE_NOT_PRIVATE_APPROVED');
});
test('U12 application executable disguised as PDF is denied',async()=>{
 const e=operatorEnv(),r=e.records.get(e.evidenceRefs[0].ref);
 r.mime='application/x-msdownload';e.resignRecord(r);
 await denied(intake(e),'INTAKE_EVIDENCE_NOT_PRIVATE_APPROVED');
});
test('U13 over 5MB object is denied',async()=>{
 const e=operatorEnv(),r=e.records.get(e.evidenceRefs[0].ref);
 r.bytes=5_000_001;e.resignRecord(r);
 await denied(intake(e),'INTAKE_EVIDENCE_NOT_PRIVATE_APPROVED');
});
test('U14 attestation signature fails after tampered object hash',async()=>{
 const e=operatorEnv(),r=e.records.get(e.evidenceRefs[0].ref);
 r.sha256='b'.repeat(64);
 await denied(intake(e),'INTAKE_EVIDENCE_ATTESTATION_INVALID');
});
test('U15 attestation fails if private object version is swapped',async()=>{
 const e=operatorEnv(),r=e.records.get(e.evidenceRefs[0].ref);
 r.objectVersion='QA_CHANGED_VERSION';
 await denied(intake(e),'INTAKE_EVIDENCE_ATTESTATION_INVALID');
});
test('U16 expired private evidence is denied',async()=>{
 const e=operatorEnv(),r=e.records.get(e.evidenceRefs[0].ref);
 r.expiresAtMs=NOW-100;e.resignRecord(r);
 await denied(intake(e),'INTAKE_EVIDENCE_NOT_PRIVATE_APPROVED');
});
test('U17 wrong Tenant record cannot be replayed for same Store',async()=>{
 const e=operatorEnv(),r=e.records.get(e.evidenceRefs[0].ref);
 r.tenantId='FOREIGN_TENANT';e.resignRecord(r);
 await denied(intake(e),'INTAKE_EVIDENCE_NOT_PRIVATE_APPROVED');
});
test('U18 wrong Store owner proof cannot be used for Store A',async()=>{
 const e=operatorEnv(),r=e.records.get(e.evidenceRefs[0].ref);
 r.storeId='STORE_B';e.resignRecord(r);
 await denied(intake(e),'INTAKE_EVIDENCE_NOT_PRIVATE_APPROVED');
});
test('U19 fake reviewer public key not enrolled fails closed',async()=>{
 const e=operatorEnv();e.evidenceAttestor.active=false;
 await denied(intake(e),'INTAKE_ATTESTOR_NOT_TRUSTED');
});
test('U20 reviewer attestation cannot be signed by foreign key',async()=>{
 const e=operatorEnv(),r=e.records.get(e.evidenceRefs[0].ref);
 const bad=crypto.generateKeyPairSync('ed25519');
 r.attestationSignature=crypto.sign(null,Buffer.from('fake'),bad.privateKey).toString('base64url');
 await denied(intake(e),'INTAKE_EVIDENCE_ATTESTATION_INVALID');
});
test('U21 private evidence replay callback must atomically return true',async()=>{
 const e=operatorEnv();const first=await intake(e);assert.equal(first.ok,true);
 const r=await intake(e);await denied(Promise.resolve(r),'OPERATOR_APPROVAL_REPLAY_OR_NON_ATOMIC');
});
test('U22 incomplete four-party operator signature denies evidence access',async()=>{
 const e=operatorEnv(),app=e.signAll().slice(0,3);
 await denied(intake(e,{approvals:app}),'OPERATOR_APPROVAL_SHAPE');
});
test('U23 wrong pinned Git commit denies evidence access',async()=>{
 const e=operatorEnv();e.intent.commitSha='b'.repeat(40);
 await denied(intake(e),'OPERATOR_APPROVAL_COMMIT_MISMATCH');
});
test('U24 owner session revoked before evidence intake is denied',async()=>{
 const e=operatorEnv(),owners=await e.pair();e.c.sessions[SA].active=false;
 await denied(intake(e,{owners}),'OPERATOR_AUTH_SESSION_REVOKED');
});
test('U25 owner Store reassignment before intake denies',async()=>{
 const e=operatorEnv(),owners=await e.pair();e.c.owner[SB].storeId='STORE_A';
 await denied(intake(e,{owners}),'OPERATOR_STORE_OWNERSHIP_REVOKED');
});
