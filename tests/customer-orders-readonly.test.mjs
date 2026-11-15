import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ORDER_COLUMNS,ORDER_LIMIT,canReadShopOrders,sanitizedOrder,loadShopOrders} from '../assets/merchant-order-readonly.mjs';
const A='10000000-0000-4000-8000-000000000001';
const B='20000000-0000-4000-8000-000000000002';
const ID='30000000-0000-4000-8000-000000000003';
const good={id:ID,tenant_id:A,status:'pending',total_vnd:'159000',created_at:'2026-11-15T06:00:00Z'};
function fake(data=[good],error=null){
 const calls=[];
 const builder={
  select(cols){calls.push(['select',cols]);return this},
  eq(k,v){calls.push(['eq',k,v]);return this},
  order(k,x){calls.push(['order',k,x]);return this},
  limit(n){calls.push(['limit',n]);return Promise.resolve({data,error})}
 };
 return {client:{from(table){calls.push(['from',table]);return builder}},calls};
}
test('owner sees ONLY verified scoped orders',async()=>{
 const f=fake();const rows=await loadShopOrders({client:f.client,tenantId:A,role:'owner'});
 assert.equal(rows.length,1);assert.equal(rows[0].id,ID);
 assert.equal(rows[0].paymentVerified,false);
 assert.deepEqual(f.calls[0],['from','orders']);
 assert.ok(f.calls.some(x=>x[0]==='eq'&&x[1]==='tenant_id'&&x[2]===A));
 assert.ok(f.calls.some(x=>x[0]==='select'&&x[1]===ORDER_COLUMNS));
 assert.ok(f.calls.some(x=>x[0]==='limit'&&x[1]===ORDER_LIMIT));
 assert.equal(ORDER_COLUMNS,'id,tenant_id,status,total_vnd,created_at');
});
test('role gates owner manager only',()=>{
 assert.equal(canReadShopOrders('manager'),true);
 for(const role of ['staff','admin','customer',null,'PLATFORM_ADMIN']){
   assert.equal(canReadShopOrders(role),false);
 }
});
test('shop staff cannot query orders even if supplied client could',async()=>{
 const f=fake();await assert.rejects(loadShopOrders({client:f.client,tenantId:A,role:'staff'}),/ROLE_DENIED/);
 assert.deepEqual(f.calls,[]);
});
test('cross tenant readback rejects entire batch',async()=>{
 const f=fake([good,{...good,tenant_id:B}]);
 await assert.rejects(loadShopOrders({client:f.client,tenantId:A,role:'owner'}),/TENANT_ORDER_SCOPE_DENIED/);
});
test('malformed order id rejects batch',async()=>{
 await assert.rejects(loadShopOrders({client:fake([{...good,id:'bad'}]).client,tenantId:A,role:'owner'}),/TENANT_ORDER_SCOPE_DENIED/);
});
test('invalid tenant selection is denied',async()=>{
 await assert.rejects(loadShopOrders({client:fake().client,tenantId:'tenant-from-url',role:'owner'}),/SCOPE_UNVERIFIED/);
});
test('data API failure is not replaced by mock',async()=>{
 await assert.rejects(loadShopOrders({client:fake([], {message:'error'}).client,tenantId:A,role:'owner'}),/DATA_UNAVAILABLE/);
});
test('empty shop result is empty not fabricated',async()=>{
 const v=await loadShopOrders({client:fake([]).client,tenantId:A,role:'manager'});assert.deepEqual(v,[]);
});
test('more than 30 rows rejected even if provider returns extra',async()=>{
 await assert.rejects(loadShopOrders({client:fake(Array(31).fill(good)).client,tenantId:A,role:'owner'}),/DATA_UNAVAILABLE/);
});
test('unsafe money amounts rejected rather than rounded',()=>{
 assert.throws(()=>sanitizedOrder({...good,total_vnd:Number.MAX_SAFE_INTEGER+1},A),/AMOUNT_UNVERIFIED/);
 assert.throws(()=>sanitizedOrder({...good,total_vnd:'159.000đ'},A),/AMOUNT_UNVERIFIED/);
});
test('paid order never claims verified payment',()=>{
 const r=sanitizedOrder({...good,status:'paid'},A);
 assert.match(r.statusLabel,/chưa đối soát/i);
 assert.equal(r.paymentVerified,false);
});
test('unknown status does not execute inherited object properties',()=>{
 const r=sanitizedOrder({...good,status:'__proto__'},A);
 assert.match(r.statusLabel,/Trạng thái khác/);
});
test('invalid server created timestamp rejects row',()=>{
 assert.throws(()=>sanitizedOrder({...good,created_at:'invalid'},A),/ORDER_DATE_INVALID/);
});
test('no PII or customer contact in scoped data contract',()=>{
 assert.equal(ORDER_COLUMNS.includes('phone'),false);
 assert.equal(ORDER_COLUMNS.includes('email'),false);
 assert.equal(ORDER_COLUMNS.includes('customer_id'),false);
});
