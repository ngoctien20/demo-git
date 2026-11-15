'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const s=JSON.parse(fs.readFileSync(path.join(__dirname,'n8n-manual-qa-stages.json'),'utf8'));
const names=['03 - Synthetic Messenger Zalo Website Fixtures',
 '04 - Private QA Identity Resolver Fast Router','05 - Đối chiếu PASS FAIL No Send'];
function run(name='ALL'){
 let items=[{json:{scenario:name}}];
 for(const stage of names){
  const source=s.stageCodes[stage],code=new vm.Script('(function(){\n'+source+'\n})()');
  items=code.runInNewContext({$input:{first:()=>items[0]||null,all:()=>items}},{timeout:1200});
 }
 return items.map(x=>x.json);
}
const results=run('ALL');
test('01 bound to exact Inactive n8n workflow and version snapshot',()=>{
 assert.equal(s.workflowId,'nyDslS3mswATPTNH');
 assert.equal(s.inactive,true);assert.equal(s.noProviderHmac,true);
 assert.equal(s.noRealAi,true);assert.equal(s.noSend,true);
});
test('02 all 36 manual scenarios return exactly 36 PASS outputs',()=>{
 assert.equal(results.length,36);
 assert.equal(results.filter(x=>x.status==='PASS').length,36);
 assert.equal(new Set(results.map(x=>x.scenario)).size,36);
});
test('03 each case has zero send, order or hosted writes',()=>{
 for(const x of results){
 assert.equal(x.providerSends,0);assert.equal(x.hostedWrites,0);assert.equal(x.orderWrites,0);
 assert.equal(x.actualSendAuthorized,false);assert.equal(x.realProviderVerified,false);
 assert.equal(x.realHmacVerified,false);assert.equal(x.realAiModelCalled,false);
 }
});
test('04 QA covers three shops on four independent channels',()=>{
 for(const shop of ['A','B','C'])for(const channel of ['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET']){
 assert.equal(results.find(x=>x.scenario==='QUOTE_'+shop+'_'+channel)?.status,'PASS');
 assert.equal(results.find(x=>x.scenario==='HELLO_'+shop+'_'+channel)?.status,'PASS');
 }
});
test('05 Shop A and Shop B are same tenant but different Store',()=>{
 const a=results.find(x=>x.scenario==='QUOTE_A_MESSENGER');
 const b=results.find(x=>x.scenario==='QUOTE_B_MESSENGER');
 assert.equal(a.tenantId,b.tenantId);assert.notEqual(a.storeId,b.storeId);
});
test('06 Shop C has separate tenant from Shop A and Shop B',()=>{
 const a=results.find(x=>x.scenario==='QUOTE_A_MESSENGER');
 const c=results.find(x=>x.scenario==='QUOTE_C_ZALO_BOT');
 assert.notEqual(a.tenantId,c.tenantId);
});
test('07 mismatched provider and injected Store/Tenant fail closed',()=>{
 for(const name of ['BLOCK_PROVIDER_MISMATCH','BLOCK_TENANT_OVERRIDE','BLOCK_STORE_OVERRIDE']){
 const r=results.find(x=>x.scenario===name);assert.equal(r.actual,'DENIED');
 assert.equal(r.storeId,null);assert.equal(r.tenantId,null);
 }
});
test('08 expired subscription, closed Store and revoked binding all denied',()=>{
 for(const name of ['BLOCK_INACTIVE_BINDING','BLOCK_SUBSCRIPTION_EXPIRED','BLOCK_STORE_CLOSED']){
 const x=results.find(y=>y.scenario===name);assert.equal(x.actual,'DENIED');
 }
});
test('09 real order requests are blocked, complex query only AI_PENDING',()=>{
 assert.equal(results.find(x=>x.scenario==='BLOCK_REAL_ORDER').actual,'BLOCKED');
 assert.equal(results.find(x=>x.scenario==='COMPLEX_AI_PENDING').actual,'AI_PENDING');
});
test('10 wrong-SKU case exercises correct WEB_WIDGET channel and deny reason',()=>{
 const x=results.find(y=>y.scenario==='BLOCK_WRONG_SKU');
 assert.equal(x.channel,'WEB_WIDGET');
 assert.equal(x.reason,'SKU_NOT_IN_THIS_SHOP');
});
test('11 isolated single scenario selection returns one output',()=>{
 const x=run('QUOTE_A_MESSENGER');
 assert.equal(x.length,1);assert.equal(x[0].scenario,'QUOTE_A_MESSENGER');
 assert.equal(x[0].status,'PASS');
});
test('12 nonexisting selector fails closed without executing any provider call',()=>{
 assert.equal(run('NONEXISTING_QA_ONLY').length,0);
});
test('13 raw PSID, token, hosted endpoint or real Meta API not present',()=>{
 for(const code of Object.values(s.stageCodes)){
  for(const word of ['fetch(', 'axios(', 'process.env.', 'createClient(',
   'graph.facebook.com','executeWorkflow(','KrSn4DNR9ALX5ng4']){
    assert.equal(code.includes(word),false,word);
  }
 }
});
