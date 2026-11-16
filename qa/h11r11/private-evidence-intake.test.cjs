'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {PROJECT,PARENT_SHA,KINDS,DOMAINS,createIntake,sigBytes}=require('./private-evidence-intake.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const NOW=1794822000000;
const roles=['CONTROLLER','SECURITY_REVIEWER','BACKUP_OPERATOR','MERCHANT_OWNER','CHANNEL_OPERATOR'];
function fixture(){
 const keys=roles.map((role,i)=>{
  const keyPair=crypto.generateKeyPairSync('ed25519');
  return {role,keyId:'SYNTH_KEY_'+String(i).padStart(4,'0'),
    actorDigest:hash('synthetic-independent-actor-'+role),
    publicKey:keyPair.publicKey,privateKey:keyPair.privateKey};
 });
 const anchors=keys.map(({role,keyId,actorDigest,publicKey})=>({role,keyId,actorDigest,publicKey}));
 const replay=new Set();
 const newIntake=()=>createIntake({
   trustAnchors:anchors,now:()=>NOW,
   claimNonce:async value=>{if(replay.has(value))return false;replay.add(value);return true;}
 });
 let counter=0;
 function packet(kind){
  counter++;
  const records=kind==='STORE_OWNER'?
   ['PRODUCT','PRODUCT','ORDER','ORDER'].map((entity,i)=>({
    entity,rowDigest:hash('row'+i),tenantDigest:hash('tenant-X'),
    storeDigest:hash('synthetic-store-'+(i%2)),
    ownerProofDigest:hash('synthetic-owner-proof-'+i),
    channelProofDigest:hash('synthetic-channel-proof-'+i),
    independentlyInspected:true
   })):DOMAINS[kind].map((domain,i)=>({
    domain,evidenceSha256:hash('synthetic-log-ref-'+i),
    independentlyInspected:true,coverageCertified:true
   }));
  return {payload:{contract:'T404_H11R11_V1',kind,projectRef:PROJECT,
   parentSha:PARENT_SHA,scope:'SYNTHETIC_EVIDENCE_REVIEW_ONLY',
   issuedAtMs:NOW-2000,expiresAtMs:NOW+120000,nonceHex:hash('nonce'+counter),
   records,decision:'NO_HOSTED_ACTION'},signatures:[]};
 }
 function sign(p){
  p.signatures=KINDS[p.payload.kind].map(role=>{
   const a=keys.find(k=>k.role===role);
   return {role,keyId:a.keyId,actorDigest:a.actorDigest,
    signature:crypto.sign(null,sigBytes(role,p.payload),a.privateKey).toString('base64url')};
  });
  return p;
 }
 return {keys,anchors,newIntake,packet,sign};
}
function failClosed(r){
 for(const key of ['realSignersIndependentlyAuthenticatedByThisCode',
  'independentRawEvidenceActuallyInspectedByThisCode','legalOrMerchantAuthorityCertified',
  'externalCallerInventoryCertified','authenticHostedBackupCertified',
  'canRevokeRpc','canExportAuth','canApproveStore','canApplyMigration',
  'canSendProvider','canMerge','productionReleaseAuthorized']){
  assert.equal(r[key],false,key);
 }
}
for(const kind of ['CALLER','STORE_OWNER','RECOVERY']){
 test(kind+' synthetic metadata signatures cryptographically valid but cannot authorize',async()=>{
  const x=fixture();const r=await x.newIntake().intake(x.sign(x.packet(kind)));
  assert.equal(r.status,'SIGNED_METADATA_PENDING_EXTERNAL_VALIDATION');
  assert.equal(r.cryptographicMetadataChecked,true);failClosed(r);
 });
 test(kind+' rejects tampered signed payload',async()=>{
  const x=fixture();const p=x.sign(x.packet(kind));p.payload.expiresAtMs--;
  await assert.rejects(x.newIntake().intake(p),{code:'INVALID_DETACHED_SIGNATURE'});
 });
 test(kind+' rejects wrong project even if signed',async()=>{
  const x=fixture();const p=x.packet(kind);p.payload.projectRef='fake';
  await assert.rejects(x.newIntake().intake(x.sign(p)),{code:'INVALID_PROJECT_VERSION_OR_SCOPE'});
 });
 test(kind+' rejects duplicated signers',async()=>{
  const x=fixture();const p=x.sign(x.packet(kind));
  p.signatures[1]=p.signatures[0];
  await assert.rejects(x.newIntake().intake(p),{code:'DUPLICATE_OR_INVALID_SIGNER'});
 });
 test(kind+' rejects expired packet',async()=>{
  const x=fixture();const p=x.packet(kind);p.payload.expiresAtMs=NOW-1;
  await assert.rejects(x.newIntake().intake(x.sign(p)),{code:'EVIDENCE_EXPIRED_OR_INVALID_TTL'});
 });
 test(kind+' reject replay through independent nonce ledger',async()=>{
  const x=fixture();const i=x.newIntake();const p=x.sign(x.packet(kind));
  await i.intake(p);
  await assert.rejects(i.intake(p),{code:'REPLAY_OR_LEDGER_UNAVAILABLE'});
 });
}
test('caller incomplete source domain denied',async()=>{
 const x=fixture(),p=x.packet('CALLER');p.payload.records.pop();
 await assert.rejects(x.newIntake().intake(x.sign(p)),{code:'INCOMPLETE_EVIDENCE_DOMAINS'});
});
test('caller duplicates domain denied even under valid signatures',async()=>{
 const x=fixture(),p=x.packet('CALLER');p.payload.records[1].domain=p.payload.records[0].domain;
 await assert.rejects(x.newIntake().intake(x.sign(p)),{code:'EVIDENCE_DOMAIN_INVALID'});
});
test('caller marked uninspected never passes metadata completeness',async()=>{
 const x=fixture(),p=x.packet('CALLER');p.payload.records[2].independentlyInspected=false;
 const r=await x.newIntake().intake(x.sign(p));assert.equal(r.status,'SIGNED_METADATA_GAPS');failClosed(r);
});
test('recovery records cannot omit storage and ACL',async()=>{
 const x=fixture(),p=x.packet('RECOVERY');p.payload.records=p.payload.records.filter(r=>r.domain!=='ROLES_AND_ACL');
 await assert.rejects(x.newIntake().intake(x.sign(p)),{code:'INCOMPLETE_EVIDENCE_DOMAINS'});
});
test('recovery uninspected encryption cannot be certified',async()=>{
 const x=fixture(),p=x.packet('RECOVERY');
 p.payload.records.find(r=>r.domain==='OFFSITE_ENCRYPTION_AND_KEY_CUSTODY').coverageCertified=false;
 const r=await x.newIntake().intake(x.sign(p));
 assert.equal(r.status,'SIGNED_METADATA_GAPS');failClosed(r);
});
test('Store owner rejects missing Product or Order proof',async()=>{
 const x=fixture(),p=x.packet('STORE_OWNER');p.payload.records.pop();
 await assert.rejects(x.newIntake().intake(x.sign(p)),{code:'FOUR_LEGACY_ROW_PROOFS_REQUIRED'});
});
test('Store owner rejects duplicated legacy row proof',async()=>{
 const x=fixture(),p=x.packet('STORE_OWNER');p.payload.records[1].rowDigest=p.payload.records[0].rowDigest;
 await assert.rejects(x.newIntake().intake(x.sign(p)),{code:'LEGACY_ROW_PROOF_INVALID_OR_CONFLICTING'});
});
test('Store owner rejects wrong row type counts',async()=>{
 const x=fixture(),p=x.packet('STORE_OWNER');p.payload.records[1].entity='ORDER';
 await assert.rejects(x.newIntake().intake(x.sign(p)),{code:'LEGACY_ROW_TYPE_COUNTS_NOT_MATCHED'});
});
test('Store owner cannot replace hash with private customer content',async()=>{
 const x=fixture(),p=x.packet('STORE_OWNER');p.payload.records[0].ownerProofDigest='customer@example.com';
 await assert.rejects(x.newIntake().intake(x.sign(p)),{code:'LEGACY_ROW_PROOF_INVALID_OR_CONFLICTING'});
});
test('Store owner uninspected provider ownership receipt never certifies',async()=>{
 const x=fixture(),p=x.packet('STORE_OWNER');p.payload.records[3].independentlyInspected=false;
 const r=await x.newIntake().intake(x.sign(p));assert.equal(r.status,'SIGNED_METADATA_GAPS');failClosed(r);
});
test('cannot supply signer-controlled public key or actor',()=>{
 const x=fixture();const keys=x.keys.map((k,i)=>({...x.anchors[i]}));
 keys[1].publicKey=keys[0].publicKey;
 assert.throws(()=>createIntake({trustAnchors:keys,claimNonce:async()=>true,now:()=>NOW}),
  /INDEPENDENT_TRUST_ANCHOR_INVALID|ALL_INDEPENDENT_ROLES_REQUIRED/);
});
test('missing nonce ledger always fails before accepting evidence',()=>{
 const x=fixture();
 assert.throws(()=>createIntake({trustAnchors:x.anchors,now:()=>NOW}),
   {code:'INDEPENDENT_ANCHORS_AND_NONCE_LEDGER_REQUIRED'});
});
test('incorrect parent source HEAD rejected',async()=>{
 const x=fixture(),p=x.packet('CALLER');p.payload.parentSha='0'.repeat(40);
 await assert.rejects(x.newIntake().intake(x.sign(p)),{code:'INVALID_PROJECT_VERSION_OR_SCOPE'});
});
