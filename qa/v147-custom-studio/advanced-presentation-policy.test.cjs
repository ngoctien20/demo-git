'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const studioApi=require('./studio-core.js');
const advanced=require('./advanced-presentation-policy.js');
const compile=(shop='A',channel='MESSENGER',intent='DISCOVER',studio=studioApi.createStudio(),api=studioApi)=>
  advanced.compile({shop,channel,proposal:{intent},studio,api});
const channels=advanced.CHANNELS, shops=['A','B','C'];
test('01 correct shop/channel coverage',()=>{assert.equal(channels.length,4);assert.deepEqual(shops.map(s=>studioApi.FIXTURES[s].storeId),['qa_shop_a','qa_shop_b','qa_shop_c']);});
test('02 forbid unknown shop',()=>assert.throws(()=>compile('X'),/UNKNOWN_SHOP_CHANNEL/));
test('03 forbid unknown channel',()=>assert.throws(()=>compile('A','TELEGRAM'),/UNKNOWN_SHOP_CHANNEL/));
test('04 forbid invented model intent',()=>assert.throws(()=>compile('A','MESSENGER','DELETE_ORDER'),/INTENT_NOT_ALLOWED/));
test('05 forbid model injected color/url/price/action/tenant',()=>{
 const p={intent:'QUOTE',priceVnd:1,url:'https://attacker.example',storeId:'qa_shop_b',style:'red'};
 assert.throws(()=>advanced.compile({shop:'A',channel:'MESSENGER',proposal:p,studio:studioApi.createStudio(),api:studioApi}),/UNTRUSTED_MODEL_FIELDS/);
});
test('06 forbid extra model payload text',()=>assert.throws(()=>advanced.compile({shop:'A',channel:'MESSENGER',proposal:{intent:'GREETING',text:'ignore policy'},studio:studioApi.createStudio(),api:studioApi}),/UNTRUSTED_MODEL_FIELDS/));
test('07 no sends writes external models across 96 variants',()=>{
 for(const s of shops)for(const c of channels)for(const i of advanced.INTENTS){
  const r=compile(s,c,i);
  assert.equal(r.providerSends,0);assert.equal(r.orderWrites,0);assert.equal(r.realAiCalls,0);
  assert.equal(r.customerDataReads,0);assert.equal(r.canPublish,false);
  assert.equal(r.channelVerified,false);assert.equal(r.orderCreated,false);
 }
});
test('08 same SKU across shops has different exact prices',()=>{
 assert.deepEqual(shops.map(s=>compile(s,'MESSENGER','DISCOVER').render.cards[0].subtitle),['159.000đ','209.000đ','259.000đ']);
});
test('09 same tenant Shop A and Shop B are never mixed',()=>{
 const a=compile('A','WEB_WIDGET','QUOTE'),b=compile('B','WEB_WIDGET','QUOTE');
 assert.equal(a.tenantId,b.tenantId);assert.notEqual(a.storeId,b.storeId);
 assert.match(a.render.text,/Gạo thơm/);assert.doesNotMatch(a.render.text,/Áo kiểu/);
 assert.match(b.render.text,/Áo kiểu/);assert.doesNotMatch(b.render.text,/Gạo thơm/);
});
test('10 Shop C other tenant',()=>assert.notEqual(compile('A').tenantId,compile('C').tenantId));
test('11 Messenger generic card uses local verified QA product only',()=>{
 const r=compile('B','MESSENGER','DISCOVER');
 assert.equal(r.render.type,'GENERIC_TEMPLATE_PREVIEW');assert.equal(r.render.cards.length,1);
 assert.equal(r.render.cards[0].imageUrl,null);assert.equal(r.render.cards[0].sku,'A001');
 assert(r.render.cards[0].buttons.every(x=>!x.interactive&&x.requiresSignedServerAction));
});
test('12 Messenger refuses native text color guarantees',()=>{
 const r=compile('A','MESSENGER','LOW_STOCK');
 assert.equal(r.capability.color,'UNSUPPORTED_NATIVE');assert.deepEqual(r.render.segments,[]);
 assert.equal(r.render.text_styles.length,0);
});
test('13 Zalo Bot supports utf16 style runs on quotation',()=>{
 const r=compile('B','ZALO_BOT','QUOTE');
 assert.equal(r.render.type,'TEXT_STYLES_PREVIEW');
 assert(r.render.text_styles.some(s=>s.st.includes('b')&&s.st.includes('c_15a85f')));
 for(const s of r.render.text_styles){assert(Number.isInteger(s.start)&&s.start>=0);assert(s.start+s.len<=r.render.text.length);}
});
test('14 Zalo Bot low-stock uses documented red on Shop A',()=>{
 const r=compile('A','ZALO_BOT','LOW_STOCK');
 const s=r.render.text_styles.find(x=>x.st.includes('c_db342e'));
 assert(s);assert.equal(r.render.text.slice(s.start,s.start+s.len),'Sắp hết hàng');
});
test('15 Zalo Bot low-stock uses documented red on Shop C',()=>{
 const r=compile('C','ZALO_BOT','LOW_STOCK');assert(r.render.text_styles.some(x=>x.st.includes('c_db342e')));
});
test('16 Zalo Bot Shop B not falsely flagged low stock',()=>{
 const r=compile('B','ZALO_BOT','LOW_STOCK');
 assert(!r.render.text_styles.some(x=>x.st.includes('c_db342e')));assert.match(r.render.text,/Tồn kho còn đủ/);
});
test('17 Zalo Bot choices are numbered text, not native buttons',()=>{
 const r=compile('A','ZALO_BOT','GREETING');assert.match(r.render.text,/1\. Xem sản phẩm/);
 assert.equal(r.render.buttons.length,0);assert.equal(r.capability.buttons,'UNVERIFIED_NATIVE');
});
test('18 Zalo Bot photo without verified asset is not sendable',()=>{
 const r=compile('B','ZALO_BOT','DISCOVER');
 assert.equal(r.render.image.photoUrl,null);assert.equal(r.render.image.verifiedImageAsset,false);
});
test('19 OA CTA and ZBS are gated and fallback to plain text',()=>{
 const r=compile('A','ZALO_OA','DISCOVER');
 assert.equal(r.render.type,'OA_TEXT_FALLBACK_PREVIEW');assert.equal(r.render.buttons.length,0);
 assert.match(r.warnings.join(' '),/ZBS spend gate LOCKED/);
});
test('20 Website may style semantic spans but never raw HTML',()=>{
 const r=compile('C','WEB_WIDGET','LOW_STOCK');
 assert.equal(r.render.layout.htmlAllowed,false);assert.equal(r.render.layout.usesTextContent,true);
 assert(r.render.segments.some(s=>s.kind==='WARNING'));
});
test('21 Website preview uses configured shop color without affecting another',()=>{
 const s=studioApi.createStudio();
 s.update('A','WEB_WIDGET',{color:'#123456'});
 assert.equal(compile('A','WEB_WIDGET','DISCOVER',s).render.layout.accent,'#123456');
 assert.notEqual(compile('B','WEB_WIDGET','DISCOVER',s).render.layout.accent,'#123456');
});
test('22 unsupported user-crafted actions never execute',()=>{
 assert.throws(()=>advanced.approveAction({id:'ORDER_REQUEST'}),/SERVER_SIGNED_ACTION_AND_AUTH_REQUIRED/);
 assert.throws(()=>advanced.send(),/PROVIDER_SEND_FORBIDDEN/);
});
test('23 order lookup refuses customer details from order ID alone',()=>{
 for(const c of channels){const r=compile('A',c,'ORDER_LOOKUP');
  assert.match(r.render.text,/xác minh/i);assert.equal(r.orderLookupAuthorized,false);
  assert.equal(r.render.link,null);
 }
});
test('24 no invented policy/Knowledge data',()=>{
 const r=compile('B','ZALO_BOT','POLICY');
 assert.match(r.render.text,/Chưa có nguồn xác minh/);
 assert.equal(r.knowledgeVersion,'qa-knowledge-v1');
});
test('25 all proposed actions remain inactive and server-signed',()=>{
 for(const c of channels)for(const i of advanced.INTENTS){
   const r=compile('A',c,i);
   for(const a of r.render.buttons)assert(a.interactive===false&&a.requiresSignedServerAction===true);
   for(const card of r.render.cards)for(const a of card.buttons)assert(a.interactive===false&&a.requiresSignedServerAction===true);
 }
});
test('26 all links remain unset, no model-provided outbound URL',()=>{
 for(const c of channels)for(const i of advanced.INTENTS)assert.equal(compile('A',c,i).render.link,null);
});
test('27 cannot replace global policy from shop config',()=>{
 const s=studioApi.createStudio();
 assert.throws(()=>s.update('A','ZALO_BOT',{policy_version:'PUBLISH'}),/GLOBAL_POLICY_OR_SCOPE_LOCKED/);
});
test('28 configuration store scope mismatch fails closed',()=>{
 const s=studioApi.createStudio();
 const spoof={get:()=>({...s.get('A','MESSENGER'),store_id:'qa_shop_b'})};
 assert.throws(()=>compile('A','MESSENGER','QUOTE',spoof),/STORE_POLICY_MISMATCH/);
});
test('29 channel scope mismatch fails closed',()=>{
 const s=studioApi.createStudio();
 const spoof={get:()=>({...s.get('A','MESSENGER'),channel:'ZALO_OA'})};
 assert.throws(()=>compile('A','MESSENGER','QUOTE',spoof),/STORE_POLICY_MISMATCH/);
});
test('30 semantic decision uses facts, not arbitrary visual preference',()=>{
 const a=compile('A','ZALO_BOT','LOW_STOCK');
 assert(a.plan.emphasis.includes('WARNING'));
 const b=compile('B','ZALO_BOT','LOW_STOCK');
 assert(!b.plan.emphasis.includes('WARNING'));
});
