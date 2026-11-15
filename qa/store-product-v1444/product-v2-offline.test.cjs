'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createOfflineStoreProductV2,ERROR_CODES,validate}=require('./product-v2-offline.cjs');
const TENANT='11111111-1111-4111-8111-111111111111';
const OTHER_TENANT='22222222-2222-4222-8222-222222222222';
const STORE_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STORE_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STORE_C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OWNER_A='aaaaaaaa-0000-4000-8000-000000000001';
const OWNER_B='bbbbbbbb-0000-4000-8000-000000000002';
const OWNER_C='cccccccc-0000-4000-8000-000000000003';
const ADMIN='dddddddd-0000-4000-8000-000000000004';
const all={
 qaA:{id:OWNER_A,stores:[STORE_A],active:true},
 qaB:{id:OWNER_B,stores:[STORE_B],active:true},
 qaC:{id:OWNER_C,stores:[STORE_C],active:true},
 qaAdmin:{id:ADMIN,stores:[STORE_A,STORE_B],active:true}
};
function ports(){
 const state={...all},roles={};
 return {state,roles,mode:'OFFLINE_SYNTHETIC_AUTH',
  async verifyBearer(token){
   const actor=state[token];
   return actor?{id:actor.id,verifiedBy:'SYNTHETIC_AUTH_SERVER',active:actor.active}:null;
  },
  async getActiveStoreMembership({userId,storeId}){
    const a=Object.values(state).find(x=>x.id===userId);
    if(!a||!a.stores.includes(storeId))return null;
    const role=roles[storeId]||'owner';
    return {source:'SYNTHETIC_CANONICAL_STORE_REGISTRY',userId,
      storeId,tenantId:storeId===STORE_C?OTHER_TENANT:TENANT,
      tenantActive:true,storeActive:true,membershipActive:true,
      role,canEditProducts:true};
  }
 };
}
function service(extra={}){const p=ports();return {p,s:createOfflineStoreProductV2({
 mode:'OFFLINE_SYNTHETIC_QA',ports:p,...extra})};}
function create(storeId=STORE_A,add={}){
 return {action:'create',storeId,sku:'SKU-SAME',name:'Áo thử nghiệm',
 priceVnd:159000,isActive:true,initialStock:7,
 expectedRevision:null,requestId:'req-create-000001',...add};
}
function update(storeId=STORE_A,add={}){
 return {action:'update',storeId,sku:'SKU-SAME',name:'Áo thử nghiệm V2',
 priceVnd:189000,isActive:true,initialStock:null,
 expectedRevision:1,requestId:'req-update-000001',...add};
}
async function denied(p,code){await assert.rejects(p,e=>e?.code===code);}
test('01 · adapter cannot create in HOSTED mode',()=>{
 assert.throws(()=>createOfflineStoreProductV2(),e=>e.code===ERROR_CODES.BLOCKED);
 assert.throws(()=>createOfflineStoreProductV2({mode:'HOSTED',ports:ports()}),
 e=>e.code===ERROR_CODES.BLOCKED);
});
test('02 · only synthetic authenticated dependency accepted',()=>{
 const p=ports();p.mode='REAL';
 assert.throws(()=>createOfflineStoreProductV2({mode:'OFFLINE_SYNTHETIC_QA',ports:p}),
 e=>e.code===ERROR_CODES.BLOCKED);
});
test('03 · creates a fixture product using integer VND and initial stock',async()=>{
 const {s}=service(),r=await s.apply({bearer:'qaA',body:create()});
 assert.equal(r.status,'CREATED_OFFLINE_FIXTURE_ONLY');
 assert.equal(r.product.priceVnd,159000);
 assert.equal(r.product.stockOnHand,7);
 assert.equal(r.product.revision,1);
 assert.equal(r.hostedWrites,0);
});
test('04 · same-tenant Store A/B can use same SKU and different prices',async()=>{
 const {s}=service();
 await s.apply({bearer:'qaA',body:create()});
 await s.apply({bearer:'qaB',body:create(STORE_B,{priceVnd:279000,requestId:'req-create-000002'})});
 const a=await s.read({bearer:'qaA',storeId:STORE_A,sku:'SKU-SAME'});
 const b=await s.read({bearer:'qaB',storeId:STORE_B,sku:'SKU-SAME'});
 assert.equal(a.priceVnd,159000);assert.equal(b.priceVnd,279000);
 assert.equal(s.inspect().syntheticProducts,2);
});
test('05 · cross-tenant Store C has independent SKU/stock',async()=>{
 const {s}=service();
 await s.apply({bearer:'qaA',body:create()});
 await s.apply({bearer:'qaC',body:create(STORE_C,{initialStock:12,requestId:'req-create-000003'})});
 assert.equal((await s.read({bearer:'qaC',storeId:STORE_C,sku:'SKU-SAME'})).stockOnHand,12);
});
test('06 · Shop B owner cannot create or read Shop A',async()=>{
 const {s}=service();
 await denied(s.apply({bearer:'qaB',body:create()}),ERROR_CODES.MEMBERSHIP);
 await denied(s.read({bearer:'qaB',storeId:STORE_A,sku:'SKU-SAME'}),ERROR_CODES.MEMBERSHIP);
});
test('07 · Shop A cannot write Shop B same tenant',async()=>{
 const {s}=service();
 await denied(s.apply({bearer:'qaA',body:create(STORE_B)}),ERROR_CODES.MEMBERSHIP);
 assert.equal(s.inspect().syntheticProducts,0);
});
test('08 · Shop C cannot use Shop A permission or fake tenant',async()=>{
 const {s}=service();
 await denied(s.apply({bearer:'qaC',body:create(STORE_A)}),ERROR_CODES.MEMBERSHIP);
});
test('09 · malicious user_id/tenant_id/role override is rejected',async()=>{
 const {s}=service();
 await denied(s.apply({bearer:'qaB',body:{...create(),role:'owner',
    user_id:OWNER_A,tenant_id:TENANT}}),ERROR_CODES.INPUT);
});
test('10 · no bearer is rejected before fixture mutation',async()=>{
 const {s}=service();
 await denied(s.apply({body:create()}),ERROR_CODES.AUTH);
});
test('11 · unknown bearer is never accepted',async()=>{
 const {s}=service();
 await denied(s.apply({bearer:'invented',body:create()}),ERROR_CODES.AUTH);
});
test('12 · revoked session cannot replay original request',async()=>{
 const {s,p}=service();
 const input=create();await s.apply({bearer:'qaA',body:input});
 p.state.qaA={...p.state.qaA,active:false};
 await denied(s.apply({bearer:'qaA',body:input}),ERROR_CODES.AUTH);
});
test('13 · removed Store assignment rejected even for prior owner',async()=>{
 const {s,p}=service();
 await s.apply({bearer:'qaA',body:create()});
 p.state.qaA={...p.state.qaA,stores:[]};
 await denied(s.apply({bearer:'qaA',body:update()}),ERROR_CODES.MEMBERSHIP);
});
test('14 · viewer role lacks product-edit permission',async()=>{
 const {s,p}=service();p.roles[STORE_A]='viewer';
 await denied(s.apply({bearer:'qaA',body:create()}),ERROR_CODES.MEMBERSHIP);
});
test('15 · manager role allowed on authorized Store',async()=>{
 const {s,p}=service();p.roles[STORE_A]='manager';
 const r=await s.apply({bearer:'qaA',body:create()});
 assert.equal(r.product.revision,1);
});
test('16 · valid update increments revision but preserves stock',async()=>{
 const {s}=service();
 await s.apply({bearer:'qaA',body:create()});
 const r=await s.apply({bearer:'qaA',body:update()});
 assert.equal(r.product.revision,2);
 assert.equal(r.product.priceVnd,189000);
 assert.equal(r.product.stockOnHand,7);
});
test('17 · stale expectedRevision refuses overwrite',async()=>{
 const {s}=service();
 await s.apply({bearer:'qaA',body:create()});
 await s.apply({bearer:'qaA',body:update()});
 await denied(s.apply({bearer:'qaA',body:update(STORE_A,{requestId:'req-update-000002'})}),
 ERROR_CODES.CONFLICT);
});
test('18 · duplicate create is idempotent (never duplicates row)',async()=>{
 const {s}=service();const input=create();
 await s.apply({bearer:'qaA',body:input});
 const r=await s.apply({bearer:'qaA',body:input});
 assert.equal(r.replayed,true);
 assert.equal(s.inspect().syntheticProducts,1);
 assert.equal(s.inspect().syntheticAuditEvents,1);
});
test('19 · duplicate update idempotent and revision unchanged',async()=>{
 const {s}=service();await s.apply({bearer:'qaA',body:create()});
 const req=update();await s.apply({bearer:'qaA',body:req});
 const r=await s.apply({bearer:'qaA',body:req});
 assert.equal(r.replayed,true);assert.equal(r.product.revision,2);
 assert.equal(s.inspect().syntheticAuditEvents,2);
});
test('20 · same idempotency key with different price is a conflict',async()=>{
 const {s}=service();await s.apply({bearer:'qaA',body:create()});
 await denied(s.apply({bearer:'qaA',body:create(STORE_A,{priceVnd:1})}),ERROR_CODES.DUPLICATE);
});
test('21 · updates cannot smuggle stock mutation',async()=>{
 const {s}=service();await s.apply({bearer:'qaA',body:create()});
 await denied(s.apply({bearer:'qaA',body:update(STORE_A,{initialStock:100})}),ERROR_CODES.INPUT);
 assert.equal((await s.read({bearer:'qaA',storeId:STORE_A,sku:'SKU-SAME'})).stockOnHand,7);
});
test('22 · cannot perform update without expectedRevision',async()=>{
 const {s}=service();await s.apply({bearer:'qaA',body:create()});
 await denied(s.apply({bearer:'qaA',body:update(STORE_A,{expectedRevision:null})}),ERROR_CODES.INPUT);
});
test('23 · cannot create without explicit initial stock',async()=>{
 const {s}=service();
 await denied(s.apply({bearer:'qaA',body:create(STORE_A,{initialStock:null})}),ERROR_CODES.INPUT);
});
test('24 · string VND with separators is rejected rather than becoming zero',async()=>{
 const {s}=service();
 await denied(s.apply({bearer:'qaA',body:create(STORE_A,{priceVnd:'159.000đ'})}),ERROR_CODES.INPUT);
});
test('25 · NaN, Infinity, decimal, negative are rejected',()=>{
 for(const priceVnd of [NaN,Infinity,159.50,-1,1e15]){
   assert.throws(()=>validate(create(STORE_A,{priceVnd})),e=>e.code===ERROR_CODES.INPUT);
 }
});
test('26 · zero VND is accepted as explicit numeric value, not coercion',async()=>{
 const {s}=service();
 const r=await s.apply({bearer:'qaA',body:create(STORE_A,{priceVnd:0})});
 assert.equal(r.product.priceVnd,0);
});
test('27 · invalid SKU and leading/trailing whitespace rejected',()=>{
 for(const sku of ['', ' WRONG','WRONG ','<script>alert(1)</script>']){
   assert.throws(()=>validate(create(STORE_A,{sku})),e=>e.code===ERROR_CODES.INPUT);
 }
});
test('28 · input type or unauthorized field is rejected',()=>{
 assert.throws(()=>validate({...create(),expected_total:159000}),e=>e.code===ERROR_CODES.INPUT);
 assert.throws(()=>validate(null),e=>e.code===ERROR_CODES.INPUT);
});
test('29 · max stock bound and no negative stock',()=>{
 for(const initialStock of [-1,2147483648,2.4]){
   assert.throws(()=>validate(create(STORE_A,{initialStock})),e=>e.code===ERROR_CODES.INPUT);
 }
});
test('30 · duplicate SKU in same Store fails with version conflict',async()=>{
 const {s}=service();await s.apply({bearer:'qaA',body:create()});
 await denied(s.apply({bearer:'qaA',body:create(STORE_A,{requestId:'req-create-000099'})}),
 ERROR_CODES.CONFLICT);
});
test('31 · cannot update a missing product to create it implicitly',async()=>{
 const {s}=service();
 await denied(s.apply({bearer:'qaA',body:update()}),ERROR_CODES.MISSING);
});
test('32 · bounded offline products cannot silently accept more',async()=>{
 const {s}=service({maxProducts:1});
 await s.apply({bearer:'qaA',body:create()});
 await denied(s.apply({bearer:'qaB',body:create(STORE_B,{requestId:'req-create-000002'})}),
 ERROR_CODES.OVERFLOW);
});
test('33 · bounded idempotency ledger fails closed',async()=>{
 const {s}=service({maxRequests:1});
 await s.apply({bearer:'qaA',body:create()});
 await denied(s.apply({bearer:'qaA',body:update()}),ERROR_CODES.OVERFLOW);
});
test('34 · same user authorized for two stores cannot read other by default key',async()=>{
 const {s}=service();
 await s.apply({bearer:'qaAdmin',body:create()});
 await denied(s.read({bearer:'qaAdmin',storeId:STORE_B,sku:'SKU-SAME'}),ERROR_CODES.MISSING);
});
test('35 · no hosted RPC, stock update, order write or provider dispatch exists',()=>{
 const {s}=service();
 for(const k of ['saveToSupabase','sendMessenger','createOrder','publishProduct',
  'updateStock','revokePrivilege','alterRls'])assert.equal(s[k],undefined);
 assert.equal(s.inspect().hostedWrites,0);
 assert.equal(s.inspect().canPublishRpc,false);
});
