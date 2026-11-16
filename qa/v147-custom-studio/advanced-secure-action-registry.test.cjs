'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync,createHash}=require('node:crypto');
const evaluator=require('./advanced-ai-presentation-evaluator.js');
const guard=require('./advanced-secure-action-registry.cjs');
const pair=generateKeyPairSync('ed25519');
const sha=s=>createHash('sha256').update(s).digest('hex');
const now=Date.UTC(2026,10,16,4,0,0);
const proposal=(intent,action='NONE',component='QUICK_REPLIES')=>JSON.stringify({
 contract:evaluator.INPUT_CONTRACT,intent,
 presentation:{emphasis:'NONE',component,media:'NONE',action}
});
const decision=(shop='A',channel='MESSENGER',intent='GREETING',action='CATALOG',component='QUICK_REPLIES')=>
 evaluator.decide({shop,channel,raw:proposal(intent,action,component)});
const context=d=>({
 mode:'SYNTHETIC_QA_ONLY',tenantDigest:sha(d.tenantId),storeDigest:sha(d.storeId),
 subjectDigest:sha('qa_subject_alpha'),conversationDigest:sha('qa_conversation_alpha'),
 channel:d.channel,role:'customer',providerVerifiedReal:false,ownerVerifiedReal:false,sendEnabled:false
});
let counter=0;
const nonce=()=> (++counter).toString(16).padStart(32,'0');
function store(){
 const seen=new Set();
 return {source:'IN_MEMORY_SYNTHETIC_QA',
  verifyPinnedScope:async({context,claims})=>
   claims.tenantDigest===context.tenantDigest&&claims.storeDigest===context.storeDigest,
  consumeOnce:async({nonce,scope})=>{
   const key=scope+':'+nonce;
   if(seen.has(key))return false;seen.add(key);return true;
  }
 };
}
function issue(d=decision(),overrides={}){
 return guard.issueSignedPreview({
  decision:d,action:d.decision.actionSuggestion,context:context(d),
  nonce:nonce(),issuedAtMs:now,ttlMs:60000,privateKey:pair.privateKey,...overrides
 });
}
async function consume(d=decision(),issued=issue(d),overrides={}){
 return guard.verifyPreviewAndConsume({
  token:issued.token,decision:d,action:d.decision.actionSuggestion,context:context(d),
  publicKey:pair.publicKey,nonceStore:store(),nowMs:now+1000,...overrides
 });
}
test('01 explicit actions registered with private/write actions blocked',()=>{
 assert.equal(guard.VERSION,'T404_ADV3_SIGNED_PREVIEW_V1');
 assert.equal(guard.ACTIONS.TRACK_ORDER.class,'BLOCKED_PRIVATE');
 assert.equal(guard.ACTIONS.OPEN_VERIFIED_LINK.class,'BLOCKED_EXTERNAL');
 assert.equal(guard.ACTIONS.ORDER_REQUEST.class,'CONFIRMATION_ONLY');
});
test('02 issue only a signed synthetic preview for a visible disabled action',()=>{
 const d=decision(),v=issue(d);
 assert.equal(v.status,'SIGNED_QA_PREVIEW_ONLY');
 assert.equal(v.actionExecutable,false);assert.equal(v.canSend,false);
 assert.equal(v.ordersWritten,0);assert.equal(v.providerSends,0);
 assert.equal(typeof v.token.payload,'string');assert.equal(typeof v.token.signature,'string');
});
test('03 one-time verify succeeds only for the same trusted Shop/customer/channel',async()=>{
 const d=decision(),ticket=issue(d),s=store();
 const r=await consume(d,ticket,{nonceStore:s});
 assert.equal(r.status,'QA_PREVIEW_ACK_ONLY');assert.equal(r.providerPostbackCertified,false);
 assert.equal(r.paidModelCalls,0);assert.equal(r.hostedReads,0);assert.equal(r.hostedWrites,0);
 const repeated=await consume(d,ticket,{nonceStore:s});
 assert.equal(repeated.reason,'REPLAY_OR_ATOMIC_NONCE_UNAVAILABLE');
});
test('04 concurrent duplicate delivery is accepted at most once',async()=>{
 const d=decision(),ticket=issue(d),s=store();
 const results=await Promise.all([consume(d,ticket,{nonceStore:s}),consume(d,ticket,{nonceStore:s})]);
 assert.equal(results.filter(x=>x.status==='QA_PREVIEW_ACK_ONLY').length,1);
 assert.equal(results.filter(x=>x.status==='BLOCKED').length,1);
});
test('05 signed token tampering cannot authorize',async()=>{
 const d=decision(),t=issue(d),sig=t.token.signature;
 const forged={...t.token,signature:(sig[0]==='A'?'B':'A')+sig.slice(1)};
 assert.equal((await consume(d,{token:forged})).status,'BLOCKED');
});
test('06 message payload tampering rejected even if JSON parses',async()=>{
 const d=decision(),t=issue(d),raw=JSON.parse(Buffer.from(t.token.payload,'base64url').toString());
 raw.action='ORDER_REQUEST';
 const forged={payload:Buffer.from(JSON.stringify(raw)).toString('base64url'),signature:t.token.signature};
 assert.equal((await consume(d,{token:forged})).status,'BLOCKED');
});
test('07 different Shop B decision cannot reuse Shop A signature',async()=>{
 const a=decision(),b=decision('B');
 const r=await consume(b,issue(a));
 assert.equal(r.status,'BLOCKED');assert.equal(r.providerSends,0);
});
test('08 cross-channel token cannot be reused',async()=>{
 const a=decision(),t=issue(a),ctx={...context(a),channel:'ZALO_BOT'};
 assert.equal((await consume(a,t,{context:ctx})).reason,'POLICY_OR_SCOPE_DENIED');
});
test('09 cross-subject identity cannot reuse token',async()=>{
 const d=decision(),ctx={...context(d),subjectDigest:sha('different_subject')};
 assert.equal((await consume(d,issue(d),{context:ctx})).reason,'SIGNED_SCOPE_OR_DECISION_MISMATCH');
});
test('10 conversation binding survives cross-channel/order temptation',async()=>{
 const d=decision(),ctx={...context(d),conversationDigest:sha('other_conversation')};
 assert.equal((await consume(d,issue(d),{context:ctx})).reason,'SIGNED_SCOPE_OR_DECISION_MISMATCH');
});
test('11 forged Owner/Manager flags and extra auth fields fail closed',()=>{
 const d=decision();
 for(const patch of [{role:'owner'},{ownerVerifiedReal:true},{providerVerifiedReal:true},
  {sendEnabled:true},{extraOwnerGrant:true}]){
  assert.equal(issue(d,{context:{...context(d),...patch}}).status,'BLOCKED');
 }
});
test('12 expires after TTL and rejects invalid clock',async()=>{
 const d=decision(),t=issue(d);
 assert.equal((await consume(d,t,{nowMs:now+60000})).reason,'TOKEN_EXPIRED_OR_INVALID_TIME');
 assert.equal((await consume(d,t,{nowMs:1})).reason,'TRUSTED_CLOCK_REQUIRED');
});
test('13 future-dated token rejected by trusted clock skew guard',async()=>{
 const d=decision(),t=issue(d,{issuedAtMs:now+30000});
 assert.equal((await consume(d,t)).reason,'TOKEN_EXPIRED_OR_INVALID_TIME');
});
test('14 missing or non-atomic nonce store never authorizes',async()=>{
 const d=decision(),t=issue(d);
 assert.equal((await consume(d,t,{nonceStore:null})).reason,'SYNTHETIC_ATOMIC_NONCE_STORE_REQUIRED');
 assert.equal((await consume(d,t,{nonceStore:{source:'IN_MEMORY_SYNTHETIC_QA',
  verifyPinnedScope:async()=>true,consumeOnce:async()=>false}})).status,'BLOCKED');
});
test('15 independent binding rejection blocks before consuming nonce',async()=>{
 const d=decision(),t=issue(d);
 const r=await consume(d,t,{nonceStore:{...store(),verifyPinnedScope:async()=>false}});
 assert.equal(r.reason,'INDEPENDENT_QA_SCOPE_PROOF_REQUIRED');
});
test('16 valid order intent can only request confirmation; no order, stock or send',async()=>{
 const d=decision('A','MESSENGER','QUOTE','ORDER_REQUEST');
 const t=issue(d);assert.equal(t.status,'SIGNED_QA_PREVIEW_ONLY');
 const r=await consume(d,t);
 assert.equal(r.status,'CONFIRMATION_REQUIRED_NO_WRITE');
 assert.equal(r.customerConfirmationRequired,true);
 assert.equal(r.ordersWritten,0);assert.equal(r.hostedWrites,0);
 assert.equal(r.actionExecutable,false);assert.equal(r.canSend,false);
});
test('17 no raw order lookup or unverified link privilege can be signed',()=>{
 const d=decision('A','WEB_WIDGET','ORDER_LOOKUP','TRACK_ORDER','TEXT');
 assert.equal(issue(d,{action:'TRACK_ORDER'}).status,'BLOCKED');
 assert.equal(issue(decision(),{action:'OPEN_VERIFIED_LINK'}).status,'BLOCKED');
});
test('18 a text-only fallback without a genuine UI action cannot sign',()=>{
 const d=decision('A','ZALO_BOT','GREETING','CATALOG','TEXT');
 assert.equal(issue(d).reason,'POLICY_OR_SCOPE_DENIED');
});
test('19 provider-gated OA paid template never becomes an action token',()=>{
 const d=decision('A','ZALO_OA','QUOTE','ORDER_REQUEST','ZBS_TEMPLATE');
 assert.equal(issue(d).status,'BLOCKED');
});
test('20 proposal with injection attempting write/metadata fails strict model schema',()=>{
 const bad={contract:evaluator.INPUT_CONTRACT,intent:'QUOTE',
  presentation:{emphasis:'PRICE',component:'TEXT',media:'NONE',action:'ORDER_REQUEST'},
  tenant_id:'shop_B',admin:true,execute:'create_order'};
 assert.throws(()=>evaluator.parseProposal(JSON.stringify(bad)),/PROPOSAL_SCHEMA_DENIED/);
});
test('21 invalid nonce, signer and unsupported action are denied',()=>{
 const d=decision();
 assert.equal(issue(d,{nonce:'guessable'}).reason,'NONCE_TIME_OR_TTL_INVALID');
 assert.equal(issue(d,{privateKey:null}).reason,'QA_ED25519_SIGNER_REQUIRED');
 assert.equal(issue(d,{action:'CREATE_ORDER'}).status,'BLOCKED');
});
test('22 a different signed decision cannot be swapped after issue',async()=>{
 const a=decision('A','MESSENGER','GREETING','CATALOG');
 const b=decision('A','MESSENGER','DISCOVER','QUOTE','PRODUCT_CARD');
 assert.equal((await consume(b,issue(a))).status,'BLOCKED');
});
test('23 malformed and noncanonical signed payload rejected',async()=>{
 const d=decision(),t=issue(d);
 for(const token of [{payload:'***',signature:'%%%'},
  {payload:t.token.payload+'=',signature:t.token.signature},
  {payload:t.token.payload,signature:'A'},
  {payload:t.token.payload,signature:'&'+t.token.signature}]){
   assert.equal((await consume(d,{token})).status,'BLOCKED');
 }
});
test('24 no provider send callback is ever invoked',async()=>{
 const d=decision(),t=issue(d),s=store();
 let sends=0;
 s.sendMessage=async()=>{sends++;throw Error('must never call')};
 const r=await consume(d,t,{nonceStore:s});
 assert.equal(r.status,'QA_PREVIEW_ACK_ONLY');assert.equal(sends,0);
});
test('25 genuine Web Widget product card may be suggested but remains disabled',async()=>{
 const d=decision('B','WEB_WIDGET','DISCOVER','QUOTE','PRODUCT_CARD');
 const t=issue(d),r=await consume(d,t);
 assert.equal(r.status,'QA_PREVIEW_ACK_ONLY');
 assert.equal(r.action,'QUOTE');assert.equal(r.actionExecutable,false);
 assert.equal(r.canSend,false);
});
