'use strict';
const t=require('node:test'),a=require('node:assert/strict'),crypto=require('node:crypto');
const {assess,verifyGrant,stableGrant,MAX_REPLIES,MAX_TOKENS}=require('./live01-preflight.cjs');
const NOW=1794758400000,KEY=Buffer.alloc(32,83),HASH='a'.repeat(64);
function sign(change={}){
 const g={schema:'TIEN404_ZALO_QA_GRANT_V1',bot_key:'bot-shop-b',
 tenant_key:'tenant-qa-b',store_key:'shop-qa-b',recipient_hash:HASH,
 issued_at_ms:NOW,expires_at_ms:NOW+300000,max_replies:3,max_model_calls:3,
 max_tokens:2500,orders_allowed:false,real_catalog_allowed:false,...change};
 return {...g,signature:crypto.createHmac('sha256',KEY).update(stableGrant(g)).digest('hex')};
}
const E={provider:'ZALO_BOT_CREATOR',bot_creator_verified:true,webhook_auth_verified:true,
 private_binding_verified:true,recipient_verified:true,durable_replay_verified:true,
 session_ordering_verified:true,quota_hard_gate_verified:true,kill_switch_verified:true,
 model_budget_approved:true,synthetic_only:true,orders_disabled:true,
 provider_dispatcher_separately_approved:true,bot_key:'bot-shop-b',
 tenant_key:'tenant-qa-b',store_key:'shop-qa-b',recipient_hash:HASH};
t('No grant always blocked and never sends',()=>{
 const x=assess({evidence:E,now:NOW});a.equal(x.status,'BLOCKED');
 a.ok(x.blockers.includes('BOUNDED_OWNER_GRANT_REQUIRED'));
 a.equal(x.can_send,false);a.equal(x.provider_request,null);
});
t('A valid server grant only reaches review, NEVER enables send',()=>{
 const x=assess({grant:sign(),secret:KEY,evidence:E,now:NOW+1000});
 a.equal(x.status,'READY_FOR_SEPARATE_DISPATCH_REVIEW');
 a.equal(x.can_send,false);a.equal(x.provider_sends,0);
 a.equal(x.orders_written,0);a.equal(x.ready_for_production,false);
 a.equal(x.live_verified,false);a.equal(x.proposed_max_replies,3);
});
t('Invalid signature blocks',()=>{
 const g=sign();g.signature='b'.repeat(64);
 a.throws(()=>verifyGrant(g,KEY,NOW+1),/PILOT_GRANT_SIGNATURE_INVALID/);
});
t('No secret fails',()=>a.throws(()=>verifyGrant(sign(),null,NOW),/PILOT_GRANT_INVALID/));
t('Short key fails',()=>a.throws(()=>verifyGrant(sign(),Buffer.alloc(8),NOW),/PILOT_GRANT_INVALID/));
t('Expired grant fails',()=>a.throws(()=>verifyGrant(sign(),KEY,NOW+300001),/PILOT_GRANT_INVALID/));
t('Future issued grant fails',()=>a.throws(()=>verifyGrant(sign(),KEY,NOW-1),/PILOT_GRANT_INVALID/));
t('More than ten minutes fails',()=>a.throws(()=>verifyGrant(sign({expires_at_ms:NOW+600001}),KEY,NOW+1),/PILOT_GRANT_INVALID/));
t('Max replies never above cap',()=>a.throws(()=>verifyGrant(sign({max_replies:MAX_REPLIES+1}),KEY,NOW+1),/PILOT_GRANT_INVALID/));
t('Max model calls never above cap',()=>a.throws(()=>verifyGrant(sign({max_model_calls:4}),KEY,NOW+1),/PILOT_GRANT_INVALID/));
t('Max tokens never above cap',()=>a.throws(()=>verifyGrant(sign({max_tokens:MAX_TOKENS+1}),KEY,NOW+1),/PILOT_GRANT_INVALID/));
t('Grant may not authorize order writes',()=>a.throws(()=>verifyGrant(sign({orders_allowed:true}),KEY,NOW+1),/PILOT_GRANT_INVALID/));
t('Grant may not authorize real catalog',()=>a.throws(()=>verifyGrant(sign({real_catalog_allowed:true}),KEY,NOW+1),/PILOT_GRANT_INVALID/));
t('Signed metadata cannot be changed',()=>{
 const g=sign();g.store_key='shop-qa-a';
 a.throws(()=>verifyGrant(g,KEY,NOW+1),/PILOT_GRANT_SIGNATURE_INVALID/);
});
const negatives=[
 ['wrong bot','bot_key','bot-forged','BOT_KEY_MISMATCH'],
 ['wrong store','store_key','shop-other','STORE_KEY_MISMATCH'],
 ['wrong tenant','tenant_key','tenant-other','TENANT_KEY_MISMATCH'],
 ['wrong recipient','recipient_hash','b'.repeat(64),'RECIPIENT_HASH_MISMATCH'],
 ['OA instead of Bot','provider','ZALO_OA','BOT_CREATOR_REQUIRED_NOT_OA'],
 ['webhook not verified','webhook_auth_verified',false,'WEBHOOK_AUTH_UNVERIFIED'],
 ['recipient not verified','recipient_verified',false,'OWNER_QA_CHAT_NOT_VERIFIED'],
 ['replay missing','durable_replay_verified',false,'DURABLE_REPLAY_NOT_VERIFIED'],
 ['session CAS missing','session_ordering_verified',false,'ORDERED_SESSION_NOT_VERIFIED'],
 ['quota not verified','quota_hard_gate_verified',false,'HARD_QUOTA_NOT_VERIFIED'],
 ['kill switch missing','kill_switch_verified',false,'KILL_SWITCH_NOT_VERIFIED'],
 ['model budget not approved','model_budget_approved',false,'MODEL_BUDGET_NOT_APPROVED'],
 ['real merchant data','synthetic_only',false,'SYNTHETIC_QA_DATA_REQUIRED'],
 ['order write enabled','orders_disabled',false,'ORDERS_MUST_BE_DISABLED'],
 ['dispatcher approval missing','provider_dispatcher_separately_approved',false,'SEPARATE_DISPATCH_APPROVAL_REQUIRED'],
 ['bot ownership missing','bot_creator_verified',false,'BOT_OWNERSHIP_UNVERIFIED'],
 ['trusted scope missing','private_binding_verified',false,'SERVER_ISSUED_SHOP_BINDING_REQUIRED']
];
for(const[name,key,value,expected]of negatives)
 t('Fail-closed: '+name,()=>{
  const x=assess({grant:sign(),secret:KEY,evidence:{...E,[key]:value},now:NOW+1000});
  a.equal(x.status,'BLOCKED');a.ok(x.blockers.includes(expected));
  a.equal(x.can_send,false);a.equal(x.provider_request,null);
 });
t('Never includes a raw recipient chat id or grant signature in result',()=>{
 const x=assess({grant:sign(),secret:KEY,evidence:E,now:NOW+1});
 a.doesNotMatch(JSON.stringify(x),/bot-shop-b|chat_id|signature|recipient_hash|a{64}/);
});
