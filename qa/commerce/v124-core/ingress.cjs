'use strict';
// V12.4 SANDBOX ingress contract. This verifies an internal QA signature,
// NOT a Zalo/provider signature. Production channel adapters are intentionally absent.
const {createHmac,timingSafeEqual}=require('node:crypto');
const FIELDS=Object.freeze(['version','channel','botRef','senderRef','eventRef','eventType','chatType','text','issuedAt']);
const KEYS=Object.freeze([...FIELDS,'signature']);
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const id=x=>typeof x==='string'&&x.length>=2&&x.length<=128&&/^[A-Za-z0-9:_-]+$/.test(x);
const canonical=e=>JSON.stringify(FIELDS.map(k=>e[k]));
function createQaIngressVerifier({registry,internalKey,clock=()=>Date.now(),maxSkewMs=120000}={}){
 if(!Buffer.isBuffer(internalKey)||internalKey.length<32)fail('QA_INTERNAL_KEY_REQUIRED');
 if(!Array.isArray(registry)||registry.length===0)fail('QA_REGISTRY_REQUIRED');
 return Object.freeze({verify(envelope){
  if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)||
     Object.keys(envelope).length!==KEYS.length||
     !Object.keys(envelope).every(k=>KEYS.includes(k))||
     envelope.version!==1||envelope.channel!=='qa-fixture'||
     envelope.eventType!=='message.text.received'||envelope.chatType!=='PRIVATE'||
     !id(envelope.botRef)||!id(envelope.senderRef)||!id(envelope.eventRef)||
     typeof envelope.text!=='string'||!envelope.text.trim()||envelope.text.length>512||
     typeof envelope.issuedAt!=='string'||!/^[a-f0-9]{64}$/.test(envelope.signature||''))
    fail('QA_ENVELOPE_INVALID');
  const now=clock(),issued=Date.parse(envelope.issuedAt);
  if(!Number.isFinite(now)||!Number.isFinite(issued)||Math.abs(now-issued)>maxSkewMs)
    fail('QA_TIMESTAMP_REJECTED');
  const a=createHmac('sha256',internalKey).update(canonical(envelope)).digest();
  const b=Buffer.from(envelope.signature,'hex');
  if(b.length!==a.length||!timingSafeEqual(a,b))fail('QA_SIGNATURE_REJECTED');
  const candidates=registry.filter(r=>r.channel===envelope.channel&&r.botRef===envelope.botRef&&
       r.mode==='qa-preview'&&r.active===true&&id(r.tenantId)&&id(r.storeId));
  if(candidates.length!==1)fail('QA_BOT_MAPPING_INVALID');
  const r=candidates[0];
  const scopeKey=r.tenantId+':'+r.storeId+':'+envelope.botRef;
  const hash=s=>createHmac('sha256',internalKey).update(s).digest('hex');
  // Only opaque digests are returned for session/receipt QA; never raw senderRef.
  return Object.freeze({trust:'SIGNED_INTERNAL_QA_FIXTURE',tenantId:r.tenantId,storeId:r.storeId,
   channel:envelope.channel,botRef:envelope.botRef,scopeKey,
   actorHash:hash('actor|'+scopeKey+'|'+envelope.senderRef),
   receiptHash:hash('receipt|'+scopeKey+'|'+envelope.eventRef),
   eventType:envelope.eventType,chatType:envelope.chatType,text:envelope.text});
 }});
}
module.exports={createQaIngressVerifier,canonical};
