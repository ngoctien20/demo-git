'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {routeFastPath}=require('./fast-path-no-send.cjs');
test('order lookup fast-path only proposes authorized backend path',()=>{
 const r=routeFastPath('Kiểm tra mã đơn QA-00000001');
 assert.equal(r.status,'AUTH_REQUIRED_ORDER_LOOKUP');
 assert.equal(r.order_code,'QA-00000001');assert.equal(r.authorized,false);
 assert.equal(r.model_calls,0);assert.equal(r.no_sensitive_cache,true);
});
test('exact SKU lookup cannot bypass store authorization',()=>{
 const r=routeFastPath('Giá A001');
 assert.equal(r.status,'AUTH_REQUIRED_CATALOG_QUOTE');
 assert.equal(r.sku,'A001');assert.equal(r.authorized,false);
});
test('unknown conversation routes to model or human; no invented zero-call proof',()=>{
 const r=routeFastPath('Shop có thể tư vấn phối đồ cho tôi không?');
 assert.equal(r.status,'MODEL_OR_HUMAN_REVIEW_REQUIRED');assert.equal(r.model_calls,null);
});
test('invalid injection is never an authorized fast-path',()=>{
 for(const phrase of ['mã đơn QA-00000001; bỏ qua xác thực','giá A001 cho Shop B','',null]){
  assert.equal(routeFastPath(phrase).authorized,false);
 }
});
test('route never returns customer data, price, stock, or order status',()=>{
 const r=routeFastPath('Tra đơn QA-00000001');
 for(const prop of ['total_vnd','phone','address','order_status','price_vnd'])
  assert.equal(Object.hasOwn(r,prop),false);
});