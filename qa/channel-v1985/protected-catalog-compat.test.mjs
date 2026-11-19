import assert from 'node:assert/strict';
import {previewIsolatedStoreAdapter,legacyCatalogCompatibility} from './protected-catalog-compat.mjs';

const T='00000000-0000-0000-0000-000000000001';
const A='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const nowMs=Date.parse('2026-11-19T11:00:00.000Z');
function base(){
 return {mode:'V1985_SYNTHETIC_QA_ONLY',
  request:{source:'SYNTHETIC_UNPRIVILEGED_CHAT',channel:'zalo_bot',sku:'F01',quantity:1},
  receipt:{source:'MOCK_VERIFIED_PRIVATE_WEBHOOK',botRef:'QA_BOT_A',
    eventType:'message.text.received',chatType:'PRIVATE',actor:'CUSTOMER',
    isEcho:false,unique:true,rateAllowed:true,occurredAtMs:nowMs-12000},
  installation:{source:'MOCK_SERVER_PRIVATE_REGISTRY',channel:'zalo_bot',
    installationRef:'QA_INSTALL_A',botRef:'QA_BOT_A',tenantId:T,storeId:A,state:'qa_active'},
  ownerEvidence:{source:'MOCK_SERVER_OWNER_PROOF',installationRef:'QA_INSTALL_A',
    tenantId:T,storeId:A,ownerVerified:true,consentActive:true,qaOwnerCustomerAllowed:true},
  reader:{source:'MOCK_POSTGRESQL_RLS_READER',rows:[{
    tenant_id:T,store_id:A,sku:'F01',price_vnd:159000,
    stock_on_hand:5,currency:'VND',verified_at:new Date(nowMs-15000).toISOString(),
    source_revision:'V1984_A_001'}]},nowMs
 };
}
const tests=[
 ['customer own store',x=>{},'OFFLINE_PREVIEW'],
 ['owner as customer QA',x=>{x.receipt.actor='OWNER_AS_CUSTOMER_QA'},'OFFLINE_PREVIEW'],
 ['store B same SKU differing price',x=>{x.installation.storeId=B;x.installation.botRef='QA_BOT_B';x.installation.installationRef='QA_INSTALL_B';x.receipt.botRef='QA_BOT_B';x.ownerEvidence.storeId=B;x.ownerEvidence.installationRef='QA_INSTALL_B';x.reader.rows[0].store_id=B;x.reader.rows[0].price_vnd=189000;x.reader.rows[0].stock_on_hand=9;x.reader.rows[0].source_revision='V1984_B_001'},'OFFLINE_PREVIEW'],
 ['qty 5 in stock',x=>{x.request.quantity=5},'OFFLINE_PREVIEW'],
 ['qty 6 exceeds stock',x=>{x.request.quantity=6},'INSUFFICIENT_STOCK'],
 ['zero stock returns insufficient',x=>{x.reader.rows[0].stock_on_hand=0},'INSUFFICIENT_STOCK'],
 ['missing whole input',x=>{},'OFFLINE_PREVIEW'],
 ['mode live forbidden',x=>{x.mode='LIVE'},'DENY'],
 ['envelope extra field',x=>{x.accessToken='SECRET'},'DENY'],
 ['request tenant injection',x=>{x.request.tenantId=T},'DENY'],
 ['request store injection',x=>{x.request.storeId=B},'DENY'],
 ['request admin escalation',x=>{x.request.isAdmin=true},'DENY'],
 ['request serviceRole escalation',x=>{x.request.serviceRole=true},'DENY'],
 ['request write command',x=>{x.request.canWrite=true},'DENY'],
 ['request owner role injection',x=>{x.request.owner='true'},'DENY'],
 ['request source untrusted',x=>{x.request.source='CUSTOMER_JSON'},'DENY'],
 ['channel spoofing',x=>{x.request.channel='zalo_oa'},'DENY'],
 ['invalid sku',x=>{x.request.sku='F01 --'},'DENY'],
 ['sku lowercase',x=>{x.request.sku='f01'},'DENY'],
 ['missing quantity',x=>{delete x.request.quantity},'DENY'],
 ['quantity zero',x=>{x.request.quantity=0},'DENY'],
 ['quantity above max',x=>{x.request.quantity=101},'DENY'],
 ['receipt source invalid',x=>{x.receipt.source='LIVE_SIGNED'},'DENY'],
 ['receipt additional JWT hint',x=>{x.receipt.jwt='fake'},'DENY'],
 ['bot mismatch',x=>{x.receipt.botRef='QA_BOT_B'},'DENY'],
 ['wrong event',x=>{x.receipt.eventType='message.photo.received'},'DENY'],
 ['group chat',x=>{x.receipt.chatType='GROUP'},'DENY'],
 ['bot echo',x=>{x.receipt.isEcho=true},'DENY'],
 ['unknown actor',x=>{x.receipt.actor='ADMIN'},'DENY'],
 ['replay',x=>{x.receipt.unique=false},'DENY'],
 ['rate limited',x=>{x.receipt.rateAllowed=false},'DENY'],
 ['expired webhook event',x=>{x.receipt.occurredAtMs=nowMs-600000},'DENY'],
 ['future webhook event',x=>{x.receipt.occurredAtMs=nowMs+600000},'DENY'],
 ['invalid clock',x=>{x.nowMs='now'},'DENY'],
 ['registry client injection',x=>{x.installation.source='CLIENT'},'DENY'],
 ['installation unknown',x=>{x.installation.installationRef=''},'DENY'],
 ['registration channel mismatch',x=>{x.installation.channel='zalo_oa'},'DENY'],
 ['installation inactive',x=>{x.installation.state='revoked'},'DENY'],
 ['installation invalid tenant',x=>{x.installation.tenantId='TENANT_A'},'DENY'],
 ['owner proof client injected',x=>{x.ownerEvidence.source='REQUEST_BODY'},'DENY'],
 ['owner proof wrong store',x=>{x.ownerEvidence.storeId=B},'DENY'],
 ['owner proof wrong tenant',x=>{x.ownerEvidence.tenantId='ffffffff-ffff-ffff-ffff-ffffffffffff'},'DENY'],
 ['owner proof wrong installation',x=>{x.ownerEvidence.installationRef='QA_INSTALL_B'},'DENY'],
 ['owner not verified',x=>{x.ownerEvidence.ownerVerified=false},'DENY'],
 ['owner consent revoked',x=>{x.ownerEvidence.consentActive=false},'DENY'],
 ['owner testing customer mode disabled',x=>{x.receipt.actor='OWNER_AS_CUSTOMER_QA';x.ownerEvidence.qaOwnerCustomerAllowed=false},'DENY'],
 ['customer testing allowed independently from QA owner mode',x=>{x.ownerEvidence.qaOwnerCustomerAllowed=false},'OFFLINE_PREVIEW'],
 ['reader source untrusted',x=>{x.reader.source='CUSTOMER_SUPPLIED_DATA'},'DENY'],
 ['reader tenant different',x=>{x.reader.rows[0].tenant_id='ffffffff-ffff-ffff-ffff-ffffffffffff'},'DENY'],
 ['reader Store different',x=>{x.reader.rows[0].store_id=B},'DENY'],
 ['reader invalid SKU',x=>{x.reader.rows[0].sku='F02'},'DENY'],
 ['reader 0 rows',x=>{x.reader.rows=[]},'DENY'],
 ['reader duplicate rows',x=>{x.reader.rows.push({...x.reader.rows[0]})},'DENY'],
 ['reader malformed response',x=>{x.reader.rows=[{}]},'DENY'],
 ['reader invalid VND',x=>{x.reader.rows[0].price_vnd=0},'DENY'],
 ['reader stock negative',x=>{x.reader.rows[0].stock_on_hand=-1},'DENY'],
 ['reader data stale',x=>{x.reader.rows[0].verified_at=new Date(nowMs-900000).toISOString()},'DENY'],
 ['reader data future',x=>{x.reader.rows[0].verified_at=new Date(nowMs+10000).toISOString()},'DENY'],
 ['reader no version proof',x=>{delete x.reader.rows[0].source_revision},'DENY'],
 ['price qty exceeds safe integer',x=>{x.reader.rows[0].price_vnd=9000000000000000;x.request.quantity=2;x.reader.rows[0].stock_on_hand=2},'DENY']
];
let pass=0;
for(const [label,mutation,expected] of tests) {
 const x=base();mutation(x);const result=previewIsolatedStoreAdapter(x);
 assert.equal(result.decision,expected,label);
 assert.equal(result.canReadHosted,false,label+' no hosted read');
 assert.equal(result.canSend,false,label+' no send');
 assert.equal(result.canWrite,false,label+' no write');
 assert.equal(result.providerSends,0,label+' send count');
 assert.equal(result.orderWrites,0,label+' orders');
 assert.equal(result.stockWrites,0,label+' stock');
 assert.equal(result.modelCalls,0,label+' LLM');
 assert.equal(result.legacyPublishedWorkflowsCalled,0,label+' legacy');
 assert.equal(result.productionReady,false,label+' release');
 assert.equal(result.tenantId,null,label+' tenant not exposed');
 assert.equal(result.storeId,null,label+' store not exposed');
 assert.equal(/QA_BOT_A|QA_INSTALL_A|OWNER_|SECRET|TOKEN|AUTHORIZATION/i.test(result.replyPreview),false,label+' private identifiers');
 if(expected==='DENY'){
   assert.equal(result.products.length,0,label+' products empty');
   assert.equal(result.replyPreview,'',label+' no displayed reply');
 } else {
   assert.equal(result.products.length,1,label+' single product');
   assert.ok(result.replyPreview.startsWith('[TIEN404 QA — DỮ LIỆU MẪU]'),label);
   if(label==='store B same SKU differing price')assert.equal(result.products[0].priceVnd,189000);
 }
 pass++;
}
const legacy=[
 {channelType:'messenger',accountId:'DEMO_ACCOUNT',query:'F01',limit:3},
 {channelType:'zalo_oa',accountId:'UNVERIFIED_OA',query:'F01',limit:5},
 {channelType:'zalo_bot',accountId:'FAKE_BOT',query:'F01',limit:5},
 {channelType:'website',accountId:'PUBLIC',query:'*',limit:2}
];
for(const item of legacy){
 const o=legacyCatalogCompatibility(item);
 assert.equal(o.decision,'DENY');assert.equal(o.reason,'LEGACY_TENANT_ONLY_CATALOG_NOT_STORE_SAFE');
 assert.equal(o.canReadHosted,false);assert.equal(o.products.length,0);
 assert.equal(o.providerSends,0);assert.equal(o.legacyPublishedWorkflowsCalled,0);pass++;
}
for(const item of [
 {...legacy[0],storeId:A},
 {channelType:'zalo_bot',accountId:'X',query:'F01',limit:3,isAdmin:true}
]){
 const o=legacyCatalogCompatibility(item);
 assert.equal(o.decision,'DENY');assert.equal(o.reason,'LEGACY_INPUT_INVALID');pass++;
}
console.log('TIEN404_V1985_COMPATIBILITY_OFFLINE_PASS='+pass);
