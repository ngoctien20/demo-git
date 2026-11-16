'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {generateKeyPairSync,sign,createHash}=require('node:crypto');
const {attestSyntheticRequest,isAcceptedSyntheticContext,SOURCES}=require('./trusted-ingress-gate.cjs');
const {authorizeQaBusinessTool}=require('./authorized-business-tools.cjs');
const {FIXTURES}=require('../v147-custom-studio/studio-core.js');
const now=Date.UTC(2026,10,16,1,24,0);
const sha=s=>createHash('sha256').update(s).digest('hex');
const makeKeys=()=>generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const channelKeys=makeKeys(),membershipKeys=makeKeys();
const roots={channelPublicKey:channelKeys.publicKey.export({format:'pem',type:'spki'}),membershipPublicKey:membershipKeys.publicKey.export({format:'pem',type:'spki'})};
const common={
 tenant_digest:sha(FIXTURES.A.tenantId),store_digest:sha(FIXTURES.A.storeId),
 subject_digest:sha('qa_synthetic_customer'),conversation_digest:sha('qa_synthetic_conversation'),
 event_digest:sha('qa_event_v15_001'),challenge_nonce:sha('qa_nonce_v15_001'),channel:'MESSENGER'
};
function evidence(role,claims={},keyOverride){
 const payload=JSON.stringify({issuer:SOURCES[role],audience:'TIEN404_V15_03H_NO_SEND_PRIVATE_QA',
   issued_ms:now-1000,expires_ms:now+119000,claims:role==='channel'?
    {...common,provider_mode:'V148_HMAC_SIGNED_FIXTURE_ONLY',provider_signature_real:false,...claims}:
    {...common,registry_mode:'V147_STATIC_STAGING_FIXTURE',authenticated_owner_real:false,actor_role:'customer',...claims}});
 const kp=keyOverride|| (role==='channel'?channelKeys:membershipKeys);
 const signature=sign('sha256',Buffer.from(payload),{key:kp.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 return {payload,signature};
}
function bundle(overrides={}){
 return {channelProof:evidence('channel',overrides.channel||{}),membershipProof:evidence('membership',overrides.membership||{}),text:'Mã A001 giá bao nhiêu?'};
}
function makeTrust(patch={}){
 const used=new Set();
 return {...roots,mode:'SYNTHETIC_QA_ONLY',
  verifyPinnedFixtureBinding:async p=>p.tenantDigest===sha(FIXTURES.A.tenantId)&&p.storeDigest===sha(FIXTURES.A.storeId)&&p.channel==='MESSENGER'&&p.providerIsSynthetic===true,
  consumeNonceOnce:async({nonce,eventDigest,scope})=>{
   const key=scope+'|'+nonce+'|'+eventDigest;
   if(used.has(key))return false;
   used.add(key);return true;
  },...patch};
}
async function accepted(){const r=await attestSyntheticRequest(bundle(),makeTrust(),now);assert.equal(r.status,'SYNTHETIC_SIGNED_QA_ONLY',JSON.stringify(r));return r}
function backend(patch={}){
 return {source:'PRIVATE_QA_READONLY_FIXTURE_ADAPTER',
  readPinnedFixture:async()=>({source:'V14_7_SYNTHETIC_FIXTURE',tenantId:FIXTURES.A.tenantId,storeId:FIXTURES.A.storeId,product:FIXTURES.A.product}),
  ...patch};
}
async function rejected(b,reason,t=makeTrust()){const r=await attestSyntheticRequest(b,t,now);assert.equal(r.status,'BLOCKED');assert.equal(r.reason,reason);assert.equal(r.can_send,false);return r;}
test('both independent synthetic P256 signatures produce read-only QA context',async()=>{
 const c=await accepted();assert.equal(isAcceptedSyntheticContext(c),true);assert.equal(c.owner_certified,false);assert.equal(c.provider_identity_real,false);assert.equal(c.can_write_orders,false);assert.equal(c.can_send,false);assert.equal(c.paid_model_calls,0);
});
test('forged plain-object authority cannot pass WeakSet',()=>assert.equal(isAcceptedSyntheticContext({status:'SYNTHETIC_SIGNED_QA_ONLY',can_send:false}),false));
test('missing trusted backend roots fails closed',async()=>rejected(bundle(),'BACKEND_TRUST_STORE_MISSING',{mode:'SYNTHETIC_QA_ONLY'}));
test('client-added tenant_id field is forbidden',async()=>rejected({...bundle(),tenant_id:'qa_shop_b'},'SIGNED_PROOFS_AND_MESSAGE_ONLY'));
test('client-added owner capability is forbidden',async()=>rejected({...bundle(),actorRole:'owner'},'SIGNED_PROOFS_AND_MESSAGE_ONLY'));
test('missing both proofs is forbidden',async()=>rejected({text:'hi'},'SIGNED_PROOFS_AND_MESSAGE_ONLY'));
test('invalid message content denied',async()=>rejected({...bundle(),text:'\0'},'INVALID_MESSAGE'));
test('insufficient issuer roots denied',async()=>rejected(bundle(),'ISSUER_PUBLIC_KEYS_NOT_VERIFIED',makeTrust({channelPublicKey:''})));
test('shared issuer key denied',async()=>rejected(bundle(),'INDEPENDENT_ISSUER_KEYS_REQUIRED',makeTrust({membershipPublicKey:roots.channelPublicKey})));
test('tampered signed channel claims rejected',async()=>{const b=bundle();b.channelProof.payload=b.channelProof.payload.replace('MESSENGER','ZALO_BOT');await rejected(b,'SIGNATURE_OR_PROOF_FRESHNESS_INVALID');});
test('wrong signer rejected',async()=>{const b=bundle();b.channelProof=evidence('channel',{},membershipKeys);await rejected(b,'SIGNATURE_OR_PROOF_FRESHNESS_INVALID');});
test('missing membership signature rejected',async()=>{const b=bundle();delete b.membershipProof.signature;await rejected(b,'SIGNATURE_OR_PROOF_FRESHNESS_INVALID');});
test('cross-tenant scope signed mismatch denied',async()=>rejected(bundle({membership:{tenant_digest:sha(FIXTURES.C.tenantId)}}),'INDEPENDENT_ISSUER_SCOPE_MISMATCH'));
test('Shop B signed store scope cannot access A',async()=>rejected(bundle({membership:{store_digest:sha(FIXTURES.B.storeId)}}),'INDEPENDENT_ISSUER_SCOPE_MISMATCH'));
test('signed conversation mismatch denied',async()=>rejected(bundle({membership:{conversation_digest:sha('other_conversation')}}),'INDEPENDENT_ISSUER_SCOPE_MISMATCH'));
test('signed subject mismatch denied',async()=>rejected(bundle({membership:{subject_digest:sha('other_user')}}),'INDEPENDENT_ISSUER_SCOPE_MISMATCH'));
test('signed event mismatch denied',async()=>rejected(bundle({membership:{event_digest:sha('other_event')}}),'INDEPENDENT_ISSUER_SCOPE_MISMATCH'));
test('independent challenge mismatch denied',async()=>rejected(bundle({membership:{challenge_nonce:sha('other_nonce')}}),'INDEPENDENT_ISSUER_SCOPE_MISMATCH'));
test('claimed real provider identity forbidden in QA gate',async()=>rejected(bundle({channel:{provider_signature_real:true}}),'NON_QA_OR_OWNER_PROOF_FORBIDDEN'));
test('synthetic Owner cannot promote to real Owner',async()=>rejected(bundle({membership:{actor_role:'owner'}}),'NON_QA_OR_OWNER_PROOF_FORBIDDEN'));
test('synthetic membership cannot claim authenticated owner',async()=>rejected(bundle({membership:{authenticated_owner_real:true}}),'NON_QA_OR_OWNER_PROOF_FORBIDDEN'));
test('unrecognized channel denied',async()=>rejected(bundle({channel:{channel:'TELEGRAM'},membership:{channel:'TELEGRAM'}}),'NON_QA_OR_OWNER_PROOF_FORBIDDEN'));
test('registry returns mismatching pinned tenant denied',async()=>rejected(bundle(),'PINNED_TENANT_STORE_CHANNEL_NOT_VERIFIED',makeTrust({verifyPinnedFixtureBinding:async()=>false})));
test('fixture backend failure rejected',async()=>rejected(bundle(),'PINNED_TENANT_STORE_CHANNEL_NOT_VERIFIED',makeTrust({verifyPinnedFixtureBinding:async()=>{throw Error('DB_FAIL')}})));
test('atomic nonce store unavailable denied',async()=>rejected(bundle(),'NONCE_REPLAY_OR_ATOMIC_STORE_UNAVAILABLE',makeTrust({consumeNonceOnce:async()=>{throw Error('D1_FAIL')}})));
test('replay second attempt denied',async()=>{
 const trusted=makeTrust(),b=bundle();const first=await attestSyntheticRequest(b,trusted,now);const second=await attestSyntheticRequest(b,trusted,now);
 assert.equal(first.status,'SYNTHETIC_SIGNED_QA_ONLY');assert.equal(second.reason,'NONCE_REPLAY_OR_ATOMIC_STORE_UNAVAILABLE');
});
test('missing attested context cannot read price',async()=>{const r=await authorizeQaBusinessTool({context:{...await accepted()},request:{capability:'price_quote',sku:'A001'},backend:backend()});assert.equal(r.reason,'SIGNED_BACKEND_CONTEXT_REQUIRED');});
test('valid SHA pinned Shop A price is integer source, not hallucinated',async()=>{
 const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'price_quote',sku:'A001'},backend:backend()});
 assert.equal(r.status,'QA_PRICE_QUOTE_RESULT');assert.equal(r.price_vnd,159000);assert.equal(r.stock,3);assert.equal(r.orders_written,0);
});
test('catalog read returns verified QA-only price and stock',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'catalog_read',sku:'A001'},backend:backend()});assert.equal(r.status,'QA_CATALOG_READ_RESULT');assert.equal(r.synthetic_only,true);});
test('unknown SKU fails to not-found without quote',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'price_quote',sku:'A002'},backend:backend()});assert.equal(r.status,'NOT_FOUND_IN_QA_STORE');assert.equal(r.price_vnd,null);});
test('malicious argument store override denied',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'price_quote',sku:'A001',store_id:'qa_shop_b'},backend:backend()});assert.equal(r.reason,'STRICT_TOOL_ARGUMENT_SCHEMA_REQUIRED');});
test('malicious argument price override denied',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'price_quote',sku:'A001',price_vnd:1},backend:backend()});assert.equal(r.reason,'STRICT_TOOL_ARGUMENT_SCHEMA_REQUIRED');});
test('missing private business snapshot denies',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'price_quote',sku:'A001'},backend:backend({readPinnedFixture:async()=>null})});assert.equal(r.reason,'PINNED_STORE_FIXTURE_CANNOT_BE_VERIFIED');});
test('cross-store backend fixture denied even if product SKU same',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'price_quote',sku:'A001'},backend:backend({readPinnedFixture:async()=>({source:'V14_7_SYNTHETIC_FIXTURE',tenantId:FIXTURES.B.tenantId,storeId:FIXTURES.B.storeId,product:FIXTURES.B.product})})});assert.equal(r.reason,'PINNED_STORE_FIXTURE_CANNOT_BE_VERIFIED');});
test('bad VND zero invalid and never converted to false positive',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'price_quote',sku:'A001'},backend:backend({readPinnedFixture:async()=>({source:'V14_7_SYNTHETIC_FIXTURE',tenantId:FIXTURES.A.tenantId,storeId:FIXTURES.A.storeId,product:{...FIXTURES.A.product,priceVnd:0}})})});assert.equal(r.reason,'INVALID_PINNED_PRICE_OR_STOCK');});
test('bad VND non-integer invalid',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'price_quote',sku:'A001'},backend:backend({readPinnedFixture:async()=>({source:'V14_7_SYNTHETIC_FIXTURE',tenantId:FIXTURES.A.tenantId,storeId:FIXTURES.A.storeId,product:{...FIXTURES.A.product,priceVnd:159.2}})})});assert.equal(r.reason,'INVALID_PINNED_PRICE_OR_STOCK');});
test('order request only creates draft total, no Order or stock subtraction',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'order_draft',sku:'A001',quantity:2},backend:backend()});assert.equal(r.status,'QA_ORDER_DRAFT_REQUIRES_CONFIRMATION');assert.equal(r.expected_total_vnd,318000);assert.equal(r.orders_written,0);assert.equal(r.stock_deducted,false);assert.equal(r.customer_order_confirmed,false);});
test('quantity greater than QA stock is a no-send insufficient stock draft',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'order_draft',sku:'A001',quantity:4},backend:backend()});assert.equal(r.status,'QA_DRAFT_INSUFFICIENT_STOCK');assert.equal(r.orders_written,0);});
test('non-integer order quantity rejected',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'order_draft',sku:'A001',quantity:1.5},backend:backend()});assert.equal(r.reason,'DRAFT_QUANTITY_INVALID');});
test('read-only price quote cannot accept order quantity',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'price_quote',sku:'A001',quantity:1},backend:backend()});assert.equal(r.reason,'READ_ONLY_SKILL_REJECTS_QUANTITY');});
test('order changes cannot be directly invoked',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'order_modify',sku:'A001',quantity:1},backend:backend()});assert.equal(r.reason,'TOOL_NOT_ALLOWED_OR_SIDE_EFFECT');});
test('inventory writes cannot be directly invoked',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'inventory_write',sku:'A001',quantity:1},backend:backend()});assert.equal(r.reason,'TOOL_NOT_ALLOWED_OR_SIDE_EFFECT');});
test('owner revenue report never authorized by synthetic customer claim',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'owner_report_read',sku:'A001'},backend:backend()});assert.equal(r.reason,'TOOL_NOT_ALLOWED_OR_SIDE_EFFECT');});
test('support draft no ticket persisted',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'support_draft'},backend:backend()});assert.equal(r.status,'QA_DRAFT_ONLY');assert.equal(r.provider_sends,0);});
test('support draft rejects unneeded SKU/id arguments',async()=>{const r=await authorizeQaBusinessTool({context:await accepted(),request:{capability:'support_draft',sku:'A001'},backend:backend()});assert.equal(r.reason,'STRICT_SUPPORT_ARGUMENT_SCHEMA_REQUIRED');});

test('P256 trusted issuer names and policy cannot be overridden at runtime',()=>{
 const {POLICY,SOURCES}=require('./trusted-ingress-gate.cjs');
 assert.equal(Object.isFrozen(POLICY),true);
 assert.equal(Object.isFrozen(SOURCES),true);
 assert.equal(Object.isFrozen(POLICY.allowedTools),true);
 assert.throws(()=>{POLICY.allowedTools=['inventory_write'];},/read only|assign/i);
 assert.throws(()=>{SOURCES.channel='ATTACKER_ISSUER';},/read only|assign/i);
});
function reissued(role,change){
 const original=JSON.parse(evidence(role).payload),payload=JSON.stringify({...original,...change});
 const kp=role==='channel'?channelKeys:membershipKeys;
 return {payload,signature:sign('sha256',Buffer.from(payload),{key:kp.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
}
test('expired but legitimately signed channel proof is denied',async()=>{
 const b=bundle();b.channelProof=reissued('channel',{issued_ms:now-180000,expires_ms:now-60000});
 await rejected(b,'SIGNATURE_OR_PROOF_FRESHNESS_INVALID');
});
test('future-dated but legitimately signed membership proof is denied',async()=>{
 const b=bundle();b.membershipProof=reissued('membership',{issued_ms:now+10000,expires_ms:now+60000});
 await rejected(b,'SIGNATURE_OR_PROOF_FRESHNESS_INVALID');
});
test('signed attestations with TTL above 120 seconds are rejected',async()=>{
 const b=bundle();b.channelProof=reissued('channel',{issued_ms:now-1000,expires_ms:now+180000});
 await rejected(b,'SIGNATURE_OR_PROOF_FRESHNESS_INVALID');
});
test('wrong signed audience denied even with valid signature',async()=>{
 const b=bundle();b.channelProof=reissued('channel',{audience:'PRODUCTION_SEND'});
 await rejected(b,'SIGNATURE_OR_PROOF_FRESHNESS_INVALID');
});
test('unbounded customer input is rejected before any tool call',async()=>{await rejected({...bundle(),text:'a'.repeat(2001)},'INVALID_MESSAGE')});
test('independent replay store returning false blocks regardless of signed proofs',async()=>{
 await rejected(bundle(),'NONCE_REPLAY_OR_ATOMIC_STORE_UNAVAILABLE',makeTrust({consumeNonceOnce:async()=>false}));
});
test('integer overflow in large QA unit price cannot create order draft',async()=>{
 const product={...FIXTURES.A.product,priceVnd:Number.MAX_SAFE_INTEGER,stock:100};
 const r=await authorizeQaBusinessTool({
  context:await accepted(),request:{capability:'order_draft',sku:'A001',quantity:2},
  backend:backend({readPinnedFixture:async()=>({source:'V14_7_SYNTHETIC_FIXTURE',tenantId:FIXTURES.A.tenantId,storeId:FIXTURES.A.storeId,product})})
 });
 assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'TOTAL_INTEGER_OVERFLOW');assert.equal(r.orders_written,0);
});
test('negative QA stock is invalid, never shown as an actual inventory',async()=>{
 const product={...FIXTURES.A.product,stock:-1};
 const r=await authorizeQaBusinessTool({
  context:await accepted(),request:{capability:'catalog_read',sku:'A001'},
  backend:backend({readPinnedFixture:async()=>({source:'V14_7_SYNTHETIC_FIXTURE',tenantId:FIXTURES.A.tenantId,storeId:FIXTURES.A.storeId,product})})
 });
 assert.equal(r.reason,'INVALID_PINNED_PRICE_OR_STOCK');
});
