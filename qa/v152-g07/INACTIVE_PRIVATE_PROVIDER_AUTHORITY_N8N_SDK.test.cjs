'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sdk=fs.readFileSync(path.join(__dirname,'INACTIVE_PRIVATE_PROVIDER_AUTHORITY_N8N_SDK.js'),'utf8');
const scripts=[...sdk.matchAll(/jsCode:("(?:\\.|[^"\\])*")/g)].map(x=>JSON.parse(x[1]));
assert.equal(scripts.length,4);
const T1='11111111-1111-4111-8111-111111111111',T2='22222222-2222-4222-8222-222222222222';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',SC='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const registry=[
 ['MESSENGER','QA_PAGE_A',T1,SA,'QA_BOT_A_V1','ACTIVE',2000000000000],
 ['MESSENGER','QA_PAGE_B',T1,SB,'QA_BOT_B_V1','ACTIVE',2000000000000],
 ['ZALO_OA','QA_OA_B',T1,SB,'QA_BOT_B_V1','ACTIVE',2000000000000],
 ['ZALO_BOT','QA_BOT_ROUTE_A',T1,SA,'QA_BOT_A_V1','ACTIVE',2000000000000],
 ['WEBSITE','QA_WIDGET_C',T2,SC,'QA_BOT_C_V1','ACTIVE',2000000000000],
 ['MESSENGER','QA_PAGE_REVOKED',T1,SA,'QA_BOT_A_V1','REVOKED',2000000000000],
 ['MESSENGER','QA_PAGE_EXPIRED',T1,SA,'QA_BOT_A_V1','ACTIVE',1600000000000]
].map(([provider,installation_ref,tenant_id,store_id,bot_profile_version,binding_status,expires_at_ms])=>({
 provider,installation_ref,tenant_id,store_id,bot_profile_version,binding_status,expires_at_ms,
 registry_version:1,qa_owner_marker:true,qa_only:true,read_only:true,
 approval_scope:'QA_SYNTHETIC_NO_REAL_OWNER'
}));
const clone=x=>JSON.parse(JSON.stringify(x));
function run(source,rows=[],refs={}){
 const items=rows.map(x=>({json:x}));
 const ctx={
  $input:{first:()=>items[0],all:()=>items},
  $:name=>{
   if(!Object.hasOwn(refs,name))throw Error('UNKNOWN_QA_NODE_REF');
   const v=refs[name].map(x=>({json:x}));
   return {first:()=>v[0],all:()=>v};
  }
 };
 const data=vm.runInNewContext('(function(){'+source+'\n})()',ctx,{timeout:1000});
 return clone(data.map(x=>x.json));
}
function pipeline({reg=registry,mutateGen,mutateResults}={}){
 const generated=run(scripts[0],[{}])[0];
 if(mutateGen)mutateGen(generated);
 const guard=run(scripts[1],reg)[0];
 const actual=run(scripts[2],reg,{
  'Generate G07 Private Review QA Corpus':[generated],
  'Validate G07 Synthetic Registry No-Go':[guard],
  'Read G07 QA Installation Registry':reg
 })[0];
 if(mutateResults)mutateResults(actual);
 return {generated,guard,actual,final:()=>run(scripts[3],[actual])[0]};
}
test('SDK contains manual trigger + 4 Code + one read-only QA table GET',()=>{
 assert.equal((sdk.match(/n8n-nodes-base\.manualTrigger/g)||[]).length,1);
 assert.equal((sdk.match(/n8n-nodes-base\.code/g)||[]).length,4);
 assert.equal((sdk.match(/n8n-nodes-base\.dataTable/g)||[]).length,1);
 assert.equal((sdk.match(/operation:'get'/g)||[]).length,1);
 for(const forbidden of ['n8n-nodes-base.webhook','n8n-nodes-base.httpRequest',
 '@n8n/n8n-nodes-langchain','n8n-nodes-base.postgres',
 'n8n-nodes-base.supabase','n8n-nodes-base.googleSheets',
 'newCredential(','process.env','sendMessage(','createOrder('])
  assert.equal(sdk.includes(forbidden),false,forbidden);
});
test('uses G05 QA registry only; NEVER reads Commerce catalog or real Orders',()=>{
 assert.equal(sdk.includes('3KfooDe1hXk3yN0r'),true);
 assert.equal(sdk.includes('qOrmoXfIobogX16d'),false);
 assert.equal(sdk.includes('TIEN404_COMMERCE_ORDERS'),false);
});
test('all 20 real admission attempts denied, no real provider authorization',()=>{
 const f=pipeline().final();
 assert.equal(f.status,'G07_PRIVATE_REVIEW_20_OF_20_REAL_ADMISSION_DENIED');
 assert.equal(f.blocked,20);
 assert.equal(f.real_signed_events_admitted,0);
 assert.equal(f.real_provider_authority_verified,false);
 assert.equal(f.provider_sends,0);
 assert.equal(f.commerce_catalog_reads,0);
 assert.equal(f.hosted_writes,0);
 assert.equal(f.can_publish,false);
 assert.equal(f.release_status,'REAL_SIGNED_NO_SEND_ADMISSION_BLOCKED');
});
test('self-reported all-green flags cannot grant live signed admission',()=>{
 const p=pipeline();
 const c=p.generated.cases[18],x=p.actual.results[18];
 assert.equal(c.simulated_reason,'ALL_GREEN_SELF_REPORTED');
 assert.equal(c.claim_real_owner,true);assert.equal(c.claim_real_provider_signature,true);
 assert.equal(c.claim_current_recovery,true);assert.equal(c.claim_durable_replay,true);
 assert.equal(x.status,'DENY_REAL_SIGNED_ADMISSION');
 assert.equal(x.commerce_catalog_read,false);
});
test('Messenger signed-shaped QA HMAC does not certify real app secret',()=>{
 const f=pipeline();
 assert.equal(f.generated.cases[0].simulated_reason,'FAKE_META_HMAC_ONLY');
 assert.equal(f.actual.results[0].status,'DENY_REAL_SIGNED_ADMISSION');
});
test('Zalo Bot secret header does not certify OA signature',()=>{
 const f=pipeline();
 assert.equal(f.generated.cases[2].simulated_reason,'FAKE_BOT_HEADER_ONLY');
 assert.equal(f.actual.results[2].status,'DENY_REAL_SIGNED_ADMISSION');
 assert.equal(f.generated.cases[3].simulated_reason,'QA_OA_NATIVE_PROTOCOL_UNVERIFIED');
});
test('unknown installation is fail closed',()=>{
 const f=pipeline();
 assert.equal(f.actual.results[5].reason,'PRIVATE_INSTALLATION_BINDING_NOT_ADMISSIBLE');
 assert.equal(f.actual.results[5].status,'DENY_REAL_SIGNED_ADMISSION');
});
test('revoked and expired installations remain real NO-GO',()=>{
 const f=pipeline();
 for(const n of [6,7])assert.equal(f.actual.results[n].status,'DENY_REAL_SIGNED_ADMISSION');
});
test('client Store and Tenant override claims are never an authority source',()=>{
 const f=pipeline();
 for(const n of [13,14])assert.equal(f.actual.results[n].status,'DENY_REAL_SIGNED_ADMISSION');
});
test('invalid OAuth/App review or no recovery cannot be made green by labels',()=>{
 const f=pipeline();
 for(const n of [8,9,10,11,16,17,18,19])
  assert.equal(f.actual.results[n].status,'DENY_REAL_SIGNED_ADMISSION');
});
test('input provider signature set true unexpectedly refuses entire QA batch',()=>{
 assert.throws(()=>pipeline({mutateGen:x=>x.real_provider_signature_received=true}),
  /G07_UNTRUSTED_SOURCE_OR_REGISTRY/);
});
test('real merchant verification label unexpectedly set true blocks QA',()=>{
 assert.throws(()=>pipeline({mutateGen:x=>x.original_merchant_source_verified=true}),
  /G07_UNTRUSTED_SOURCE_OR_REGISTRY/);
});
test('missing bound QA registry is denied',()=>{
 assert.throws(()=>pipeline({reg:registry.slice(1)}),
  /G05_QA_REGISTRY_COUNT_DRIFT/);
});
test('duplicate provider+installation QA mapping is denied',()=>{
 const a=clone(registry);a[1].installation_ref=a[0].installation_ref;
 assert.throws(()=>pipeline({reg:a}),/G05_QA_REGISTRY_AMBIGUOUS_INSTALLATION/);
});
test('wrong Store ownership in QA registry is denied structurally',()=>{
 const a=clone(registry);a[0].store_id=SB;
 assert.throws(()=>pipeline({reg:a}),/G05_QA_REGISTRY_AUTHORITY_OR_FIXTURE_DRIFT/);
});
test('registry cannot falsely claim REAL_OWNER_APPROVED',()=>{
 const a=clone(registry);a[0].approval_scope='REAL_OWNER_APPROVED';
 assert.throws(()=>pipeline({reg:a}),/G05_QA_REGISTRY_AUTHORITY_OR_FIXTURE_DRIFT/);
});
test('registry cannot carry credentials or tokens',()=>{
 const a=clone(registry);a[0].appSecret='not-a-real-credential';
 assert.throws(()=>pipeline({reg:a}),/G05_QA_REGISTRY_SCHEMA_DRIFT/);
});
test('negative applicant cannot be changed to allowed result without fail',()=>{
 const p=pipeline({mutateResults:x=>x.results[0].status='ALLOW_REAL_SIGNED'});
 assert.throws(()=>p.final(),/G07_FAILED_CLOSED_ADMISSION_QA_G07_01/);
});
test('a fake egress flag fails final no-send assertion',()=>{
 const p=pipeline({mutateResults:x=>x.provider_sends=1});
 assert.throws(()=>p.final(),/G07_REAL_AUTHORITY_OR_NO_SEND_GATE_VIOLATED/);
});
test('QA final response reveals no IDs or secrets',()=>{
 const str=JSON.stringify(pipeline().final());
 for(const s of [T1,T2,SA,SB,SC,'QA_PAGE_A','QA_G07_FAKE_META_SECRET','appSecret'])
  assert.equal(str.includes(s),false,s);
});
