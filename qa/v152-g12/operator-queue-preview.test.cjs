'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {previewQueue,CONTRACT}=require('./operator-queue-preview.cjs');
const rows=()=>[
 {alias:'QA-G12-001',state:'OPEN',reason:'LEASE_TIMEOUT_NO_SEND'},
 {alias:'QA-G12-002',state:'IN_REVIEW',reason:'SEND_UNCERTAIN'},
 {alias:'QA-G12-003',state:'WAITING_COSIGN',reason:'SEND_UNCERTAIN'},
 {alias:'QA-G12-004',state:'RESOLVED',reason:'SEND_UNCERTAIN'}
];
test('contract stable and preview synthetic only',()=>{
 const r=previewQueue(rows());
 assert.equal(CONTRACT,'T404_G12_OPERATOR_QUEUE_PREVIEW_V1');
 assert.equal(r.source,'SYNTHETIC_OFFLINE_PREVIEW');
 assert.equal(r.pilotAdmission,'NO_GO');assert.equal(r.canPublish,false);
});
test('counts are operator-friendly and exact',()=>{
 const x=previewQueue(rows()).counts;
 assert.deepEqual(x,{needsReview:1,inProgress:1,needsIndependentReview:1,
  reviewed:1,sendUncertain:3});
});
test('resolved review does not mean provider delivered',()=>{
 const r=previewQueue(rows());const item=r.cards.find(x=>x.code==='QA-G12-004');
 assert.equal(item.reviewedDoesNotMeanDelivered,true);
 assert.equal(item.maySendMessage,false);
 assert.equal(r.providerDeliveryStatusCertified,false);
});
test('uncertain send receives high triage priority without auto-reply',()=>{
 const r=previewQueue(rows());
 assert.equal(r.cards[0].highPriority,true);
 assert.equal(r.cards[0].maySendMessage,false);
 assert.equal(r.canRetryProvider,false);
});
test('never create an order from operator queue',()=>{
 const r=previewQueue(rows());
 assert.equal(r.canReadCustomers,false);
 assert.equal(r.cards.every(x=>x.mayCreateOrder===false),true);
});
test('queue preview uses Vietnamese statuses for nontechnical operators',()=>{
 const r=previewQueue(rows());
 for(const label of ['Cần nhân sự kiểm tra','Đang kiểm tra',
    'Chờ xác minh độc lập','Đã ghi nhận đối soát'])
  assert.equal(r.cards.some(x=>x.stateLabel===label),true);
});
test('output does not reveal raw IDs or customer content',()=>{
 const r=previewQueue(rows());const s=JSON.stringify(r);
 for(const x of ['PSID','phone','customer_name','message_text','app_secret',
    'rawBody','provider_access_token','page_id'])
  assert.equal(s.includes(x),false,x);
});
test('unknown state cannot self-promote to resolved',()=>{
 const v=rows();v[0].state='PRODUCTION_APPROVED';
 assert.throws(()=>previewQueue(v),/G12_PRIVATE_PREVIEW_SCHEMA_INVALID/);
});
test('unknown reason is not silently hidden',()=>{
 const v=rows();v[0].reason='AUTOMATIC_PROVIDER_RESEND';
 assert.throws(()=>previewQueue(v),/G12_PRIVATE_PREVIEW_SCHEMA_INVALID/);
});
test('caller-injected phone field is rejected',()=>{
 const v=rows();v[0].phone='NO_REAL_PII';
 assert.throws(()=>previewQueue(v),/G12_PRIVATE_PREVIEW_SCHEMA_INVALID/);
});
test('duplicate case aliases rejected',()=>{
 const v=rows();v[1].alias=v[0].alias;
 assert.throws(()=>previewQueue(v),/G12_PRIVATE_PREVIEW_SCHEMA_INVALID/);
});
test('real Page ID and merchant Store ID alias cannot be used',()=>{
 const v=rows();v[0].alias='2379295362359912';
 assert.throws(()=>previewQueue(v),/G12_PRIVATE_PREVIEW_SCHEMA_INVALID/);
});
test('more than 100 records refused to prevent unbounded export',()=>{
 const v=Array.from({length:101},(_,i)=>({
  alias:'QA-G12-'+String(i+1).padStart(3,'0'),
  state:'OPEN',reason:'LEASE_TIMEOUT_NO_SEND'
 }));
 assert.throws(()=>previewQueue(v),/G12_PRIVATE_PREVIEW_SCHEMA_INVALID/);
});
test('empty preview is never a production authorization',()=>{
 const r=previewQueue([]);
 assert.equal(r.cards.length,0);assert.equal(r.canPublish,false);
 assert.equal(r.realOperatorProofEstablished,false);
 assert.equal(r.actualStoreOwnershipVerified,false);
});
