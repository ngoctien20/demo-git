'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync(__dirname+'/v1855-staging-headerauth-webhook-ingress.workflow.js','utf8');
const evidence=JSON.parse(fs.readFileSync(__dirname+'/../n8n-adapter-qa-evidence.json','utf8'));
function nodeCode(nodeName){
 const i=src.indexOf("name:'"+nodeName+"'");
 assert(i>=0,'node '+nodeName+' exists');
 const j=src.indexOf('jsCode:',i);
 assert(j>=0,'jsCode exists for '+nodeName);
 const m=src.slice(j+7).match(/^("(?:\\.|[^"\\])*")/);
 assert(m,'valid escaped JS source');
 return JSON.parse(m[1]);
}
const validator=nodeCode('Validate Ingress Envelope');
const responseGate=nodeCode('Enforce Safe Readback Response');
const NOW=Date.now();
const REQUEST='v1855-offline-qa-1234';
const basic={installationId:'v1855-materials-sandbox',operation:'catalog.search',query:'VL-101',limit:5,requestId:REQUEST,issuedAt:NOW};
function check(body,headers={'content-type':'application/json'},query={}){
 const event={headers,query,body};
 return Function('$input',validator)({first:()=>({json:event})})[0].json;
}
function sanitized(raw,req){
 return Function('$input','$',responseGate)(
  {first:()=>({json:raw})},
  name=>{assert.equal(name,'Validate Ingress Envelope');return {first:()=>({json:req})}}
 )[0].json;
}
const RESPONSE={success:true,operation:'catalog.search',environment:'sandbox',
 shopName:'Materials QA',requestId:REQUEST,readOnly:true,canWrite:false,
 canConfirm:false,privateOrderAccess:false,
 products:[{sku:'VL-101',name:'Xi măng mẫu',priceVnd:79000,stock:120,unit:'bao',category:'Vật liệu',
 attributes:{weightKg:50,demoOnly:true,privateEmployeePhone:'must-not-leak'}}]};

test('source contains Header Auth and dedicated existing credential name, never token bytes',()=>{
 assert(src.includes("authentication:'headerAuth'"));
 assert(src.includes("newCredential('TIEN404_V1855_READONLY_ADAPTER_AUTH_STAGING')"));
 assert(src.includes("responseMode:'responseNode'"));
 assert(src.includes('rYwrJfJavcaZcjUI'));
 assert(src.includes('Only Safe Read Operations?'));
 assert(!src.includes('n8n-nodes-base.httpRequest'));
 assert(!src.includes('n8n-nodes-base.dataTable'));
 assert(!src.includes('n8n-nodes-base.telegram'));
 assert(!src.includes('n8n-nodes-base.gmail'));
 assert(!src.includes('openAi'));
});
test('valid catalog request yields only installation-bound canonical envelope',()=>{
 const r=check(basic);assert.equal(r.accepted,true);
 assert.equal(r.operation,'catalog.search');assert.equal(r.requestId,REQUEST);
 assert.equal(r.query,'VL-101');assert.equal(r.limit,5);
 assert(!Object.hasOwn(r,'tenantId'));assert(!Object.hasOwn(r,'storeId'));
 assert(!Object.hasOwn(r,'accountId'));assert(!Object.hasOwn(r,'headers'));
});
test('valid cart request normalizes only SKU and numeric quantity',()=>{
 const r=check({...basic,operation:'cart.preview',query:undefined,limit:undefined,cartJson:'[{"sku":"VL-101","quantity":3}]'});
 assert.equal(r.accepted,false); // unexpected query/limit keys are present, even if undefined
 const {query,limit,...withoutExtraneous}=basic;
 const good=check({...withoutExtraneous,operation:'cart.preview',cartJson:'[{"sku":"VL-101","quantity":3}]'});
 assert.equal(good.accepted,true);
 assert.deepEqual(JSON.parse(good.cartJson),[{sku:'VL-101',quantity:3}]);
});
test('invalid installation, write/read order and browser-provided scope fail before adapter',()=>{
 assert.equal(check({...basic,installationId:'foreign-widget'}).reason,'unknown_installation');
 for(const op of ['order.create','order.read','payment.capture']){
  const r=check({...basic,operation:op});assert.equal(r.accepted,false);assert.equal(r.httpStatus,403);
 }
 for(const field of ['tenantId','storeId','accountId','customerId','orderId','authorization']){
  const r=check({...basic,[field]:'attacker'});assert.equal(r.accepted,false);
  assert.equal(r.reason,'unexpected_or_authority_field');
 }
});
test('bad content type, URL query, malformed cart, expired timestamp and duplicate SKU fail closed',()=>{
 assert.equal(check(basic,{'content-type':'text/plain'}).reason,'json_required');
 assert.equal(check(basic,undefined,{debug:'true'}).reason,'query_parameters_forbidden');
 assert.equal(check({...basic,issuedAt:NOW-70000}).reason,'request_timestamp_expired');
 const {query,limit,...b}=basic;
 assert.equal(check({...b,operation:'cart.preview',cartJson:'broken'}).reason,'invalid_cart_json');
 assert.equal(check({...b,operation:'cart.preview',cartJson:'[{"sku":"VL-101","quantity":1},{"sku":"VL-101","quantity":2}]'}).reason,'duplicate_sku');
});
test('response gate exposes only read-only catalog fields, strips nested unknown attributes',()=>{
 const req=check(basic);
 const r=sanitized(RESPONSE,req);
 assert.equal(r.httpStatus,200);
 assert.equal(r.body.products[0].priceVnd,79000);
 assert.equal(r.body.products[0].attributes.weightKg,50);
 assert(!('privateEmployeePhone' in r.body.products[0].attributes));
 assert.equal(r.body.canWrite,false);assert.equal(r.body.canConfirm,false);
 assert.equal(r.body.privateOrderAccess,false);
 assert(!JSON.stringify(r).includes('must-not-leak'));
});
test('forged Store/PII, wrong request ID and unsafe readback are blocked',()=>{
 const req=check(basic);
 for(const mutation of [
   {storeId:'store_b'},
   {tenantId:'tenant_b'},
   {email:'sensitive@example.invalid'},
   {requestId:'wrong'},
   {canWrite:true},
   {privateOrderAccess:true},
   {readOnly:false},
   {environment:'production'}
 ]){const r=sanitized({...RESPONSE,...mutation},req);assert.equal(r.httpStatus,502);assert.equal(r.body.success,false);}
});
test('valid Cart Preview cannot confirm or write',()=>{
 const {query,limit,...b}=basic;
 const req=check({...b,operation:'cart.preview',cartJson:'[{"sku":"VL-101","quantity":3}]'});
 const raw={success:true,operation:'cart.preview',requestId:REQUEST,shopName:'Material QA',
  environment:'sandbox',readOnly:true,canWrite:false,canConfirm:false,privateOrderAccess:false,
  previewOnly:true,subtotalVnd:237000,errors:[],requiresHumanQuote:true,
  lines:[{sku:'VL-101',name:'Xi măng mẫu',unit:'bao',quantity:3,unitPriceVnd:79000,lineTotalVnd:237000,stock:120,needsQuote:true}]};
 const r=sanitized(raw,req);
 assert.equal(r.httpStatus,200);assert.equal(r.body.subtotalVnd,237000);
 assert.equal(r.body.canConfirm,false);assert.equal(r.body.canWrite,false);
 assert.equal(r.body.previewOnly,true);
});
test('actual n8n workflow remains inactive with correct credential and no execution data retention',()=>{
 const w=evidence.n8n.ingress;
 assert.equal(w.active,false);assert.equal(w.published,false);
 assert.equal(w.webhook.authentication,'headerAuth');
 assert.equal(w.webhook.credentialName,'TIEN404_V1855_READONLY_ADAPTER_AUTH_STAGING');
 assert.equal(w.webhook.credentialId,'IS2XrqEFUDv7aGsh');
 assert.equal(w.webhook.dedicatedCredentialBoundVerified,true);
 assert.equal(w.webhook.secretValueInspected,false);
 assert.equal(w.settings.saveManualExecutions,false);
 assert.equal(w.settings.saveDataSuccessExecution,'none');
 assert.equal(w.settings.saveDataErrorExecution,'none');
 assert.equal(w.pinTests.total,5);assert.equal(w.pinTests.passed,5);
 assert.equal(w.pinTests.httpHeaderAuthRealNetworkTested,false);
 assert.equal(evidence.securityGates.productionRelease,false);
});
