'use strict';
// TIEN404 V12.4 staging-only trusted Shop B inbound resolver.
// NOT DEPLOYED. Requires separately approved private ingress HMAC secret & PG executor.
// This module does not send Zalo messages or write orders/sessions.
// The HMAC key is an INTERNAL bridge key, never a Zalo Bot token or customer credential.
const {createHmac,createHash,timingSafeEqual}=require('node:crypto');
const MAX_CLOCK_SKEW_MS=120000;
const SCOPE=Object.freeze({tenant_key:'qa-tenant-b',store_key:'qa-store-b',bot_key:'qa-bot-b'});
const fail=(code)=>{const e=new Error(code);e.code=code;throw e;};
const safeRef=(x,max=150)=>typeof x==='string'&&x.length>0&&x.length<=max&&/^[A-Za-z0-9:_-]+$/.test(x);
const iso=(x)=>{const n=x instanceof Date?x.getTime():Date.parse(x);return Number.isFinite(n)?new Date(n).toISOString():null;};
const QUERY=[
 'SELECT b.status AS binding_status, b.expires_at,b.confirmed_challenge_id,',
 'b.recipient_ref,c.status AS claim_status,c.recipient_ref AS claim_recipient_ref,',
 's.enabled_mode,s.identity_status FROM tien404_r1_qa.owner_bindings b',
 'JOIN tien404_r1_qa.owner_pairing_claims_v3 c ON',
 '(b.tenant_key,b.store_key,b.bot_key,b.confirmed_challenge_id)=',
 '(c.tenant_key,c.store_key,c.bot_key,c.challenge_id)',
 'JOIN tien404_r1_qa.shop_bots s ON',
 '(b.tenant_key,b.store_key,b.bot_key)=(s.tenant_key,s.store_key,s.bot_key)',
 'WHERE (b.tenant_key,b.store_key,b.bot_key)=($1,$2,$3)',
 'AND b.recipient_ref=$4',
 'AND b.status = $5 AND c.status = $6',
 'AND s.enabled_mode=$7 AND s.identity_status=$8',
 'AND b.expires_at > now()'
].join(' ');
// Canonical signing contract shared with PRIVATE validated ingress backend.
// No client may provide source_verified or sign an envelope.
// Do not log the envelope: contains private recipient reference and text.
const ENVELOPE_FIELDS=Object.freeze([
 'version','source','bot_ref','event_name','chat_type',
 'recipient_ref','message_ref','text','issued_at'
]);
function canonical(e){return JSON.stringify(ENVELOPE_FIELDS.map(k=>e[k]));}
function validateEnvelope(e,now){
 if(!e||typeof e!=='object'||Array.isArray(e)||
    Object.keys(e).length!==ENVELOPE_FIELDS.length+1||
    !Object.keys(e).every(k=>ENVELOPE_FIELDS.includes(k)||k==='signature')||
    e.version!==1||e.source!=='VERIFIED_ZALO_V1_INGRESS'||
    e.bot_ref!=='qa-bot-b'||e.event_name!=='message.text.received'||
    e.chat_type!=='PRIVATE'||!safeRef(e.recipient_ref)||
    !safeRef(e.message_ref,128)||typeof e.text!=='string'||
    e.text.length<1||e.text.length>512||!/^[\s\S]*\S[\s\S]*$/.test(e.text)||
    !/^[a-f0-9]{64}$/.test(e.signature||''))
   fail('INGRESS_ENVELOPE_INVALID');
 const issued=Date.parse(e.issued_at);
 if(!Number.isFinite(issued)||Math.abs(now-issued)>MAX_CLOCK_SKEW_MS)
   fail('INGRESS_CLOCK_SKEW');
}
async function resolveShopBInbound({envelope,internalKey,database,now=Date.now()}){
 if(!Buffer.isBuffer(internalKey)||internalKey.length<32)
   fail('INTERNAL_HMAC_KEY_REQUIRED');
 if(!database||typeof database.query!=='function')fail('PRIVATE_DB_REQUIRED');
 validateEnvelope(envelope,now);
 const actual=createHmac('sha256',internalKey).update(canonical(envelope)).digest();
 const claimed=Buffer.from(envelope.signature,'hex');
 if(claimed.length!==actual.length||!timingSafeEqual(actual,claimed))
   fail('INGRESS_SIGNATURE_INVALID');
 // Do not read by text-based tenant/store keys from client. This is a fixed
 // Shop B-only prepared query; the recipient ref must be in the signed envelope.
 const result=await database.query(QUERY,[
   SCOPE.tenant_key,SCOPE.store_key,SCOPE.bot_key,envelope.recipient_ref,
   'paired','CONFIRMED','dry_run','synthetic_qa'
 ]);
 if(!result||!Array.isArray(result.rows)||result.rows.length!==1)
   fail('OWNER_DB_BINDING_NOT_FOUND');
 const row=result.rows[0],expires=iso(row.expires_at);
 if(row.binding_status!=='paired'||row.claim_status!=='CONFIRMED'||
    row.recipient_ref!==envelope.recipient_ref||
    row.claim_recipient_ref!==row.recipient_ref||
    row.enabled_mode!=='dry_run'||row.identity_status!=='synthetic_qa'||
    !expires||Date.parse(expires)<=now||
    !safeRef(row.recipient_ref)||typeof row.confirmed_challenge_id!=='string'||
    !/^[a-f0-9-]{36}$/i.test(row.confirmed_challenge_id))
    fail('OWNER_DB_BINDING_INVALID');
 const bindingFingerprint=createHash('sha256').update(JSON.stringify([
   SCOPE.tenant_key,SCOPE.store_key,SCOPE.bot_key,row.confirmed_challenge_id,
   row.recipient_ref,expires
 ])).digest('hex');
 return Object.freeze({
   owner:Object.freeze({
     source:'VERIFIED_BACKEND_BINDING',server_verified:true,
     binding_status:'paired',owner_claim_status:'CONFIRMED',
     owner_recipient_matches:true,enabled_mode:'dry_run',identity_status:'synthetic_qa',
     ...SCOPE,binding_challenge_id:row.confirmed_challenge_id,
     binding_fingerprint:bindingFingerprint,
     recipient_fingerprint:row.recipient_ref,expires_at:expires
   }),
   event:Object.freeze({
     source:'VERIFIED_ZALO_WEBHOOK_NORMALIZER',accepted:true,
     eventName:'message.text.received',chatType:'PRIVATE',
     recipient_fingerprint:row.recipient_ref,
     message_ref:envelope.message_ref,text:envelope.text
   })
 });
}
module.exports={resolveShopBInbound,canonical,MAX_CLOCK_SKEW_MS,QUERY};
