'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {CONTRACT,createNoSendCommerceAdapter}=require('./trusted-store-commerce-adapter.cjs');
const NOW=Date.parse('2026-11-17T03:00:00Z');
const T1='11111111-1111-4111-8111-111111111111';
const T2='22222222-2222-4222-8222-222222222222';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SC='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const HASH='a'.repeat(64);
const INSTALL={
 'MESSENGER:PAGE_A':{tenantId:T1,storeId:SA,botProfileVersion:'QA_BOT_A_1'},
 'MESSENGER:PAGE_B':{tenantId:T1,storeId:SB,botProfileVersion:'QA_BOT_B_1'},
 'ZALO_OA:OA_B':{tenantId:T1,storeId:SB,botProfileVersion:'QA_BOT_B_1'},
 'WEBSITE:WEB_C':{tenantId:T2,storeId:SC,botProfileVersion:'QA_BOT_C_1'},
 'ZALO_BOT:BOT_A':{tenantId:T1,storeId:SA,botProfileVersion:'QA_BOT_A_1'}
};
const PRICES={[SA]:159000,[SB]:259000,[SC]:309000};
const STOCK={[SA]:5,[SB]:2,[SC]:8};
const NAME={[SA]:'QA hàng A',[SB]:'QA hàng B',[SC]:'QA hàng C'};
const deepcopy=x=>JSON.parse(JSON.stringify(x));
let counter=0;
function fixture({provider='MESSENGER',accountId='PAGE_A',action='CATALOG_LOOKUP',
 sku='A002',quantity=action==='CATALOG_LOOKUP'?1:2,
 changeEvent,changeBinding,changePolicy,changeCatalog,
 clocks,delayCatalog}={}){
 const runId=++counter,trace=[],reads={bindings:0,policies:0,catalogs:0};
 const e={source:'SERVER_ATTESTED_PROVIDER_EVENT',verified:true,provider,accountId,
  eventId:'QA_EVENT_'+runId,subjectHash:HASH,occurredAtMs:NOW};
 const deps={
  clock:clocks||(()=>NOW),
  verifyInbound:async({rawBody,headers})=>{
   trace.push('verify');
   assert.ok(Buffer.isBuffer(rawBody));
   assert.deepEqual(headers,{});
   const v=deepcopy(e);if(changeEvent)changeEvent(v);return v;
  },
  readInstallationBinding:async({provider:p,accountId:a})=>{
   trace.push('binding');reads.bindings++;
   const setup=INSTALL[p+':'+a];if(!setup)throw Error('INSTALLATION_LOOKUP_NOT_FOUND');
   const b={source:'PRIVATE_SERVER_INSTALLATION_REGISTRY',verified:true,
    provider:p,accountId:a,...setup,registryVersion:1,status:'ACTIVE',
    expiresAtMs:NOW+3600000,independentOwnerAuthorityClaimed:true,
    canonicalTenantAndStore:true};
   if(changeBinding)changeBinding(b,reads.bindings);
   return b;
  },
  authorizeStoreRead:async({tenantId,storeId,botProfileVersion,registryVersion,action:readAction})=>{
   trace.push('policy');reads.policies++;
   const p={source:'SERVER_STORE_POLICY_READBACK',verified:true,tenantId,storeId,
    botProfileVersion,registryVersion,storeActive:true,subscriptionActive:true,
    merchantAuthorityActive:true,allowedActions:['CATALOG_LOOKUP','CART_PREVIEW'],
    priceMode:'RETAIL_ONLY',policyVersion:'QA_POLICY_V1'};
   assert.equal(readAction,action);
   if(changePolicy)changePolicy(p,reads.policies);
   return p;
  },
  readCatalogSnapshot:async({tenantId,storeId,registryVersion,action:readAction})=>{
   trace.push('catalog');reads.catalogs++;
   if(delayCatalog)await delayCatalog();
   const c={source:'STORE_SCOPED_CATALOG_READBACK',verified:true,scope:'TENANT_AND_STORE',
    tenantId,storeId,registryVersion,revision:10,
    products:[{source:'SERVER_VERIFIED_STORE_PRODUCT',tenantId,storeId,
     itemId:'QA_ITEM_1',sku:'A002',name:NAME[storeId],priceVnd:PRICES[storeId],
     stock:STOCK[storeId],active:true}]};
   assert.equal(readAction,action);
   if(changeCatalog)changeCatalog(c);
   return c;
  }
 };
 const adapter=createNoSendCommerceAdapter(deps);
 const req={rawBody:Buffer.from('{"fixture":"no-real-event"}'),headers:{},
 action,sku,quantity};
 return {adapter,req,trace,reads};
}
const rejects=(name,opts,code,editReq)=>test(name,async()=>{
 const x=fixture(opts);if(editReq)editReq(x.req);
 await assert.rejects(x.adapter.run(x.req),e=>{
  assert.equal(e.message,code);return true;
 });
 assert.equal(x.adapter.stats().hostedWrites,0);
});
test('identical SKU has distinct verified per-Store price and stock under same Tenant',async()=>{
 const a=fixture({action:'CART_PREVIEW',quantity:2});
 const b=fixture({provider:'MESSENGER',accountId:'PAGE_B',action:'CART_PREVIEW',quantity:2});
 const ar=await a.adapter.run(a.req),br=await b.adapter.run(b.req);
 assert.equal(ar.totalVnd,318000);assert.equal(br.totalVnd,518000);
 assert.equal(ar.unitPriceVnd,159000);assert.equal(br.unitPriceVnd,259000);
 assert.equal(ar.status,'STORE_CART_PREVIEW_REQUIRES_CONFIRMATION');
 assert.equal(br.status,'STORE_CART_PREVIEW_REQUIRES_CONFIRMATION');
 assert.equal(ar.canCreateOrder,false);assert.equal(br.providerSends,0);
 assert.equal(ar.actualJwtVerifiedHere,false);assert.equal(br.actualRlsVerifiedHere,false);
 assert.deepEqual(a.trace,['verify','binding','policy','catalog','binding','policy']);
});
test('Zalo OA same Shop B, different provider, reads B authorized price',async()=>{
 const a=fixture({provider:'ZALO_OA',accountId:'OA_B'});
 const r=await a.adapter.run(a.req);
 assert.equal(r.unitPriceVnd,259000);assert.equal(r.availability,'AVAILABLE');
 assert.equal(r.contract,CONTRACT);
});
test('Website T2 Shop C is isolated from both Shop A and B',async()=>{
 const a=fixture({provider:'WEBSITE',accountId:'WEB_C',action:'CART_PREVIEW',quantity:3});
 const r=await a.adapter.run(a.req);
 assert.equal(r.totalVnd,927000);assert.equal(r.unitPriceVnd,309000);
});
test('Zalo Bot fixture is separate from Zalo OA and store A scoped',async()=>{
 const x=fixture({provider:'ZALO_BOT',accountId:'BOT_A'});
 const r=await x.adapter.run(x.req);assert.equal(r.unitPriceVnd,159000);
});
test('not found SKU is not sourced from different Store',async()=>{
 const x=fixture({sku:'Z123'});
 const r=await x.adapter.run(x.req);
 assert.equal(r.status,'SKU_NOT_FOUND_IN_AUTHORIZED_STORE');
 assert.equal(r.unitPriceVnd,undefined);
});
test('out of stock never writes orders or quantity',async()=>{
 const x=fixture({accountId:'PAGE_B',action:'CART_PREVIEW',quantity:3});
 const r=await x.adapter.run(x.req);
 assert.equal(r.status,'INSUFFICIENT_STORE_STOCK');assert.equal(r.totalVnd,undefined);
 assert.equal(x.adapter.stats().orderWrites,0);
});
test('replay of same verified event is blocked even with a new request SKU',async()=>{
 const x=fixture(),a=await x.adapter.run(x.req),b=await x.adapter.run({...x.req,sku:'B002'});
 assert.equal(a.status,'STORE_CATALOG_MATCH');
 assert.equal(b.status,'DUPLICATE_EVENT_IGNORED');
 assert.equal(x.reads.catalogs,1);
});
test('real order write and provider send hard-disabled',()=>{
 const x=fixture();
 assert.throws(()=>x.adapter.createOrder(),/REAL_ORDER_WRITE_DISABLED/);
 assert.throws(()=>x.adapter.sendMessage(),/PROVIDER_SEND_DISABLED/);
});
test('in-flight parallel replay is denied without duplicate catalog read',async()=>{
 let release;const pending=new Promise(ok=>release=ok);
 const x=fixture({delayCatalog:()=>pending});
 const first=x.adapter.run(x.req);
 // allow verifier/binding/policy to get to the catalog await
 for(let i=0;i<12;i++)await Promise.resolve();
 const second=await x.adapter.run(x.req);
 assert.equal(second.status,'DUPLICATE_EVENT_IGNORED');
 release();const finish=await first;
 assert.equal(finish.status,'STORE_CATALOG_MATCH');
 assert.equal(x.reads.catalogs,1);
});
rejects('reject request with client-provided tenantId',{},'UNTRUSTED_REQUEST_OR_SCOPE_CLAIM',r=>r.tenantId=T1);
rejects('reject request with client-provided storeId',{},'UNTRUSTED_REQUEST_OR_SCOPE_CLAIM',r=>r.storeId=SA);
rejects('reject customer attempted unit price override',{},'UNTRUSTED_REQUEST_OR_SCOPE_CLAIM',r=>r.unitPriceVnd=1);
rejects('reject customer attempted wholesale authorization',{},'UNTRUSTED_REQUEST_OR_SCOPE_CLAIM',r=>r.priceMode='WHOLESALE');
rejects('reject AI invented product authorization',{},'UNTRUSTED_REQUEST_OR_SCOPE_CLAIM',r=>r.productAuthority='MODEL_GUESS');
rejects('reject non Buffer provider bytes',{},'UNTRUSTED_REQUEST_OR_SCOPE_CLAIM',r=>r.rawBody='hello');
rejects('reject zero-length provider bytes',{},'UNTRUSTED_REQUEST_OR_SCOPE_CLAIM',r=>r.rawBody=Buffer.alloc(0));
rejects('reject oversized provider bytes',{},'UNTRUSTED_REQUEST_OR_SCOPE_CLAIM',r=>r.rawBody=Buffer.alloc(131073));
rejects('reject unknown customer operation',{},'UNTRUSTED_REQUEST_OR_SCOPE_CLAIM',r=>r.action='CREATE_ORDER');
rejects('reject negative quantity',{},'UNTRUSTED_REQUEST_OR_SCOPE_CLAIM',r=>r.quantity=-1);
rejects('reject large quantity',{},'UNTRUSTED_REQUEST_OR_SCOPE_CLAIM',r=>r.quantity=51);
rejects('reject catalog quantity other than one',{},'UNTRUSTED_REQUEST_OR_SCOPE_CLAIM',r=>r.quantity=2);
rejects('reject unsafe SKU markup',{},'UNTRUSTED_REQUEST_OR_SCOPE_CLAIM',r=>r.sku='<script>alert(1)</script>');
rejects('reject unsafe script quantity',{},'UNTRUSTED_REQUEST_OR_SCOPE_CLAIM',r=>r.quantity='2');
rejects('reject attacker-supplied scope via incoming event',{changeEvent:e=>e.storeId=SA},'ATTESTED_INBOUND_REQUIRED');
rejects('reject attacker-supplied tenant via incoming event',{changeEvent:e=>e.tenantId=T1},'ATTESTED_INBOUND_REQUIRED');
rejects('reject provider unsigned event',{changeEvent:e=>e.verified=false},'ATTESTED_INBOUND_REQUIRED');
rejects('reject unknown provider',{changeEvent:e=>e.provider='FAKE_PROVIDER'},'ATTESTED_INBOUND_REQUIRED');
rejects('reject missing event identity',{changeEvent:e=>e.eventId=''},'ATTESTED_INBOUND_REQUIRED');
rejects('reject malformed sender digest',{changeEvent:e=>e.subjectHash='customer-raw-id'},'ATTESTED_INBOUND_REQUIRED');
rejects('reject old event',{changeEvent:e=>e.occurredAtMs=NOW-10*60*1000},'ATTESTED_INBOUND_REQUIRED');
rejects('reject future event',{changeEvent:e=>e.occurredAtMs=NOW+10*60*1000},'ATTESTED_INBOUND_REQUIRED');
rejects('reject wrong provider-to-installation binding',{changeBinding:b=>b.provider='MESSENGER_FAKE'},'INSTALLATION_STORE_BINDING_DENIED');
rejects('reject wrong Page/account binding',{changeBinding:b=>b.accountId='PAGE_B'},'INSTALLATION_STORE_BINDING_DENIED');
rejects('reject expired installation',{changeBinding:b=>b.expiresAtMs=NOW},'INSTALLATION_STORE_BINDING_DENIED');
rejects('reject revoked installation',{changeBinding:b=>b.status='REVOKED'},'INSTALLATION_STORE_BINDING_DENIED');
rejects('reject disabled installation',{changeBinding:b=>b.status='DISABLED'},'INSTALLATION_STORE_BINDING_DENIED');
rejects('reject unknown canonical Tenant',{changeBinding:b=>b.tenantId='tenant-alias'},'INSTALLATION_STORE_BINDING_DENIED');
rejects('reject unknown canonical Store',{changeBinding:b=>b.storeId='store-alias'},'INSTALLATION_STORE_BINDING_DENIED');
rejects('reject installation without independent Owner marker',{changeBinding:b=>b.independentOwnerAuthorityClaimed=false},'INSTALLATION_STORE_BINDING_DENIED');
rejects('reject unsigned registry claim',{changeBinding:b=>b.verified=false},'INSTALLATION_STORE_BINDING_DENIED');
rejects('reject zero registry version',{changeBinding:b=>b.registryVersion=0},'INSTALLATION_STORE_BINDING_DENIED');
rejects('reject registry with injected credential field',{changeBinding:b=>b.secret='DO_NOT_RETURN'},'INSTALLATION_STORE_BINDING_DENIED');
rejects('reject wrong Tenant in policy',{changePolicy:p=>p.tenantId=T2},'STORE_READ_POLICY_DENIED');
rejects('reject cross-Store policy',{changePolicy:p=>p.storeId=SB},'STORE_READ_POLICY_DENIED');
rejects('reject unapproved bot profile policy',{changePolicy:p=>p.botProfileVersion='WRONG_BOT_PROFILE'},'STORE_READ_POLICY_DENIED');
rejects('reject revoked merchant authority',{changePolicy:p=>p.merchantAuthorityActive=false},'STORE_READ_POLICY_DENIED');
rejects('reject paused Store',{changePolicy:p=>p.storeActive=false},'STORE_READ_POLICY_DENIED');
rejects('reject subscription expired',{changePolicy:p=>p.subscriptionActive=false},'STORE_READ_POLICY_DENIED');
rejects('reject insufficient read capability',{changePolicy:p=>p.allowedActions=['CATALOG_LOOKUP'] ,action:'CART_PREVIEW'},'STORE_READ_POLICY_DENIED');
rejects('reject unsafe wholesale pricing',{changePolicy:p=>p.priceMode='WHOLESALE'},'STORE_READ_POLICY_DENIED');
rejects('reject stale policy version',{changePolicy:p=>p.policyVersion='invalid version'},'STORE_READ_POLICY_DENIED');
rejects('reject policy with extra untrusted billing scope',{changePolicy:p=>p.canBill=true},'STORE_READ_POLICY_DENIED');
rejects('reject catalog scoped only by Tenant',{changeCatalog:c=>c.scope='TENANT_ONLY'},'STORE_SCOPED_CATALOG_DENIED');
rejects('reject catalog under different Tenant',{changeCatalog:c=>c.tenantId=T2},'STORE_SCOPED_CATALOG_DENIED');
rejects('reject catalog under different Store',{changeCatalog:c=>c.storeId=SB},'STORE_SCOPED_CATALOG_DENIED');
rejects('reject stale registry version in catalog',{changeCatalog:c=>c.registryVersion=0},'STORE_SCOPED_CATALOG_DENIED');
rejects('reject unverified catalog source',{changeCatalog:c=>c.verified=false},'STORE_SCOPED_CATALOG_DENIED');
rejects('reject forged product from other Store',{changeCatalog:c=>c.products[0].storeId=SB},'PRODUCT_PRICE_STOCK_OR_STORE_SCOPE_INVALID');
rejects('reject forged product from other Tenant',{changeCatalog:c=>c.products[0].tenantId=T2},'PRODUCT_PRICE_STOCK_OR_STORE_SCOPE_INVALID');
rejects('reject negative product price',{changeCatalog:c=>c.products[0].priceVnd=-1},'PRODUCT_PRICE_STOCK_OR_STORE_SCOPE_INVALID');
rejects('reject decimal product price',{changeCatalog:c=>c.products[0].priceVnd=159000.5},'PRODUCT_PRICE_STOCK_OR_STORE_SCOPE_INVALID');
rejects('reject string VND price',{changeCatalog:c=>c.products[0].priceVnd='159.000đ'},'PRODUCT_PRICE_STOCK_OR_STORE_SCOPE_INVALID');
rejects('reject negative stock',{changeCatalog:c=>c.products[0].stock=-2},'PRODUCT_PRICE_STOCK_OR_STORE_SCOPE_INVALID');
rejects('reject duplicate SKU',{changeCatalog:c=>c.products.push({...c.products[0],itemId:'QA_ITEM_2'})},'PRODUCT_PRICE_STOCK_OR_STORE_SCOPE_INVALID');
rejects('reject duplicate product ID',{changeCatalog:c=>c.products.push({...c.products[0],sku:'B002'})},'PRODUCT_PRICE_STOCK_OR_STORE_SCOPE_INVALID');
rejects('reject Product PII/secret appended',{changeCatalog:c=>c.products[0].phone='DO_NOT_READ'},'PRODUCT_PRICE_STOCK_OR_STORE_SCOPE_INVALID');
rejects('reject spoofed free price extra field',{changeCatalog:c=>c.products[0].discountVnd=159000},'PRODUCT_PRICE_STOCK_OR_STORE_SCOPE_INVALID');
rejects('reject oversized product catalog',{changeCatalog:c=>c.products=Array(101).fill(c.products[0])},'STORE_SCOPED_CATALOG_DENIED');
rejects('reject mismatched installation Store during second read',{changeBinding:(b,n)=>{if(n===2)b.storeId=SB}},'INSTALLATION_CHANGED_DURING_READ');
rejects('reject changed registry version during second read',{changeBinding:(b,n)=>{if(n===2)b.registryVersion=2}},'INSTALLATION_CHANGED_DURING_READ');
rejects('reject revoked installation just before response',{changeBinding:(b,n)=>{if(n===2)b.status='REVOKED'}},'INSTALLATION_STORE_BINDING_DENIED');
rejects('reject revoked Store authority just before response',{changePolicy:(p,n)=>{if(n===2)p.merchantAuthorityActive=false}},'STORE_READ_POLICY_DENIED');
rejects('reject price policy changed during read',{changePolicy:(p,n)=>{if(n===2)p.policyVersion='QA_POLICY_V2'}},'STORE_POLICY_CHANGED_DURING_READ');
test('retail Unit VND integer overflow never creates a pending order',async()=>{
 const x=fixture({action:'CART_PREVIEW',quantity:50,changeCatalog:c=>{
  c.products[0].priceVnd=1000000000000;c.products[0].stock=50;
 }});
 await assert.rejects(x.adapter.run(x.req),/VND_TOTAL_OVERFLOW/);
 assert.equal(x.adapter.stats().orderWrites,0);
});
test('responses never expose canonical IDs or fake header raw bytes',async()=>{
 const x=fixture(),r=await x.adapter.run(x.req),text=JSON.stringify(r);
 for(const s of [T1,T2,SA,SB,SC,'fixture','PAGE_A',HASH])assert.equal(text.includes(s),false);
 assert.equal(r.canPublish,false);
 assert.equal(r.actualProviderSignatureVerifiedHere,false);
});
test('injected dependency implementations mandatory',()=>{
 assert.throws(()=>createNoSendCommerceAdapter({}),/SERVER_INJECTED_DEPENDENCIES_REQUIRED/);
});
