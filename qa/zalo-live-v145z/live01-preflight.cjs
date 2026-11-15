'use strict';
/*
 * V14.5Z-LIVE-01 approval preflight — source only; NO dispatch path.
 * Never accepts user-provided "verified" as authorization. All proof input must
 * originate from a separate trusted verifier and has NOT been hosted-tested.
 * A valid grant still cannot send: only an approved server-side dispatcher may.
 */
const crypto=require('node:crypto');
function fail(code){const e=new Error(code);e.code=code;throw e;}
const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{2,80}$/.test(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const MAX_REPLIES=3,MAX_TOKENS=2500,MAX_WINDOW_MS=10*60*1000;
function stableGrant(g){
 return [g.schema,g.bot_key,g.tenant_key,g.store_key,g.recipient_hash,
  g.issued_at_ms,g.expires_at_ms,g.max_replies,g.max_model_calls,g.max_tokens,
  g.orders_allowed,g.real_catalog_allowed].join('|');
}
function verifyGrant(g,secret,now){
 if(!g||g.schema!=='TIEN404_ZALO_QA_GRANT_V1'||
  ![g.bot_key,g.tenant_key,g.store_key].every(safeId)||!hex(g.recipient_hash)||
  !Number.isSafeInteger(g.issued_at_ms)||!Number.isSafeInteger(g.expires_at_ms)||
  g.issued_at_ms>now||g.expires_at_ms<=now||
  g.expires_at_ms-g.issued_at_ms>MAX_WINDOW_MS||
  !Number.isSafeInteger(g.max_replies)||g.max_replies<1||g.max_replies>MAX_REPLIES||
  !Number.isSafeInteger(g.max_model_calls)||g.max_model_calls<1||g.max_model_calls>MAX_REPLIES||
  !Number.isSafeInteger(g.max_tokens)||g.max_tokens<1||g.max_tokens>MAX_TOKENS||
  g.orders_allowed!==false||g.real_catalog_allowed!==false||
  !hex(g.signature)||!Buffer.isBuffer(secret)||secret.length<32)fail('PILOT_GRANT_INVALID');
 const expected=crypto.createHmac('sha256',secret).update(stableGrant(g)).digest('hex');
 if(!crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(g.signature,'hex')))
  fail('PILOT_GRANT_SIGNATURE_INVALID');
 return true;
}
function assess({grant=null,secret=null,evidence={},now=Date.now()}={}){
 // This check is for a server-only launch checklist. The code has no sender
 // and cannot be promoted to a webhook or provider dispatcher.
 const blockers=[];
 if(!grant)blockers.push('BOUNDED_OWNER_GRANT_REQUIRED');
 else{
  try{verifyGrant(grant,secret,now)}catch(e){blockers.push(e.code||'PILOT_GRANT_INVALID');}
 }
 if(evidence.provider==='ZALO_OA')blockers.push('BOT_CREATOR_REQUIRED_NOT_OA');
 if(evidence.bot_creator_verified!==true)blockers.push('BOT_OWNERSHIP_UNVERIFIED');
 if(evidence.webhook_auth_verified!==true)blockers.push('WEBHOOK_AUTH_UNVERIFIED');
 if(evidence.private_binding_verified!==true)blockers.push('SERVER_ISSUED_SHOP_BINDING_REQUIRED');
 if(evidence.recipient_verified!==true)blockers.push('OWNER_QA_CHAT_NOT_VERIFIED');
 if(evidence.durable_replay_verified!==true)blockers.push('DURABLE_REPLAY_NOT_VERIFIED');
 if(evidence.session_ordering_verified!==true)blockers.push('ORDERED_SESSION_NOT_VERIFIED');
 if(evidence.quota_hard_gate_verified!==true)blockers.push('HARD_QUOTA_NOT_VERIFIED');
 if(evidence.kill_switch_verified!==true)blockers.push('KILL_SWITCH_NOT_VERIFIED');
 if(evidence.model_budget_approved!==true)blockers.push('MODEL_BUDGET_NOT_APPROVED');
 if(evidence.synthetic_only!==true)blockers.push('SYNTHETIC_QA_DATA_REQUIRED');
 if(evidence.orders_disabled!==true)blockers.push('ORDERS_MUST_BE_DISABLED');
 if(evidence.provider_dispatcher_separately_approved!==true)
  blockers.push('SEPARATE_DISPATCH_APPROVAL_REQUIRED');
 if(grant&&evidence.bot_key!==grant.bot_key)blockers.push('BOT_KEY_MISMATCH');
 if(grant&&evidence.store_key!==grant.store_key)blockers.push('STORE_KEY_MISMATCH');
 if(grant&&evidence.tenant_key!==grant.tenant_key)blockers.push('TENANT_KEY_MISMATCH');
 if(grant&&evidence.recipient_hash!==grant.recipient_hash)blockers.push('RECIPIENT_HASH_MISMATCH');
 return Object.freeze({stage:'V14_5Z_LIVE01_PREFLIGHT',status:blockers.length?'BLOCKED':'READY_FOR_SEPARATE_DISPATCH_REVIEW',
  blockers:[...new Set(blockers)],scope:'ONE_ZALO_BOT_ONE_QA_RECIPIENT',
  proposed_max_replies:grant?.max_replies||MAX_REPLIES,
  proposed_max_model_calls:grant?.max_model_calls||MAX_REPLIES,
  proposed_max_tokens:grant?.max_tokens||MAX_TOKENS,
  // CRITICAL: no outbound port, no token, no HTTP method, no payload.
  can_send:false,provider_request:null,provider_sends:0,orders_written:0,
  stock_changed:0,customer_data_writes:0,live_verified:false,
  ready_for_production:false});
}
module.exports={assess,verifyGrant,stableGrant,MAX_REPLIES,MAX_TOKENS,MAX_WINDOW_MS};
