'use strict';
/**
 * V13.6M.6 — source-only rotating HMAC indexes for replay detection.
 * SYNTHETIC memory only; no real credentials or persistent database.
 * Old fingerprints remain queryable across staged rotations. A stale
 * worker is rejected instead of silently accepting a duplicate.
 */
const {createHmac}=require('node:crypto');
const {deriveIdentity}=require('../messenger-rich-v136m5/private-event-store.cjs');
const fail=code=>{const e=new Error(code);e.code=code;throw e};
const VERSION=/^v[1-9][0-9]{0,3}$/;
function createSyntheticKeyring({activeVersion,keys}={}){
 if(!Array.isArray(keys)||keys.length<1||keys.length>5||!VERSION.test(activeVersion||''))
  fail('M6_KEYRING_INVALID');
 const vault=new Map(),fingerprints=new Map();
 for(const entry of keys){
  if(!entry||!VERSION.test(entry.version||'')||
     typeof entry.secret!=='string'||Buffer.byteLength(entry.secret,'utf8')<32||
     vault.has(entry.version))
   fail('M6_KEYRING_INVALID');
  vault.set(entry.version,entry.secret);
  fingerprints.set(entry.version,createHmac('sha256',entry.secret)
   .update('TIEN404_MESSENGER_OFFLINE_KEY_IDENTITY_v1').digest('hex'));
 }
 if(!vault.has(activeVersion))fail('M6_ACTIVE_KEY_MISSING');
 const versions=Object.freeze([activeVersion,
    ...[...vault.keys()].filter(v=>v!==activeVersion).sort()]);
 const manifest=()=>Object.freeze({
  activeVersion,versions:Object.freeze([...versions]),
  fingerprints:Object.freeze(versions.map(version=>Object.freeze({
   version,fingerprint:fingerprints.get(version)
  }))),synthetic:true
 });
 function variants({trusted,replayKey}={}){
  const records=versions.map(version=>{
   const i=deriveIdentity({trusted,replayKey,secret:vault.get(version)});
   return Object.freeze({...i,keyVersion:version,
    rowKey:[i.tenantId,i.storeId,i.pageId,i.bindingVersion,
     i.senderHash,i.eventHash].join('|')});
  });
  return Object.freeze(records);
 }
 return Object.freeze({manifest,variants});
}
function sameManifest(a,b){
 if(!a||!b||a.activeVersion!==b.activeVersion||
   a.versions.length!==b.versions.length)return false;
 return a.fingerprints.every(p=>b.fingerprints.some(q=>
  q.version===p.version&&q.fingerprint===p.fingerprint));
}
function createSyntheticRotationIndex(){
 let manifest=null,epoch=0;
 const claims=new Map();
 function activate({ring,expectedEpoch}={}){
  if(!ring||typeof ring.manifest!=='function'||typeof ring.variants!=='function'||
    !Number.isSafeInteger(expectedEpoch)||expectedEpoch!==epoch)
    fail('M6_ROTATION_EPOCH_CONFLICT');
  const next=ring.manifest();
  if(!next.synthetic||!next.versions.includes(next.activeVersion)||
     !Array.isArray(next.fingerprints))fail('M6_ROTATION_MANIFEST_INVALID');
  if(manifest){
   for(const old of manifest.fingerprints){
    const replacement=next.fingerprints.find(e=>e.version===old.version);
    // Drop/change of any previously used key is blocked even if retention
    // looks old. Real rotation requires owner-approved versioned migration.
    if(!replacement||replacement.fingerprint!==old.fingerprint)
      fail('M6_ROTATION_HISTORY_LOST');
   }
   if(sameManifest(manifest,next))fail('M6_ROTATION_NO_CHANGE');
  }
  manifest=next;epoch++;
  return Object.freeze({epoch,activeVersion:manifest.activeVersion,
    source:'SYNTHETIC_KEY_MANIFEST',hostedReady:false});
 }
 function claim({ring,trusted,replayKey}={}){
  if(!manifest||!ring||typeof ring.manifest!=='function'||
    !sameManifest(manifest,ring.manifest()))
    fail('M6_ROTATION_WORKER_STALE');
  const options=ring.variants({trusted,replayKey});
  if(options.length!==manifest.versions.length)
    fail('M6_ROTATION_CANDIDATE_INVALID');
  const existing=options.find(i=>claims.has(i.rowKey));
  if(existing)return Object.freeze({status:'DUPLICATE_SUPPRESSED',
    firstSeen:false,matchedKeyVersion:existing.keyVersion,
    source:'SYNTHETIC_ROTATION_INDEX',hostedReady:false,
    providerSendEnabled:false,durable:false});
  const current=options.find(i=>i.keyVersion===manifest.activeVersion);
  if(!current)fail('M6_ROTATION_ACTIVE_CANDIDATE_MISSING');
  claims.set(current.rowKey,{keyVersion:current.keyVersion,status:'CLAIMED'});
  return Object.freeze({status:'CLAIMED',firstSeen:true,
   matchedKeyVersion:current.keyVersion,
   source:'SYNTHETIC_ROTATION_INDEX',hostedReady:false,
   providerSendEnabled:false,durable:false});
 }
 return Object.freeze({activate,claim,
  diagnostics:()=>Object.freeze({source:'SYNTHETIC_MEMORY_ONLY',
   epoch,storedFingerprints:claims.size,
   activeVersion:manifest?.activeVersion??null,
   retainedKeyVersions:manifest?.versions??[],
   realPostgresVerified:false,durable:false,
   providerSendEnabled:false,allowAutomaticKeyDrop:false})
 });
}
module.exports={createSyntheticKeyring,createSyntheticRotationIndex};
