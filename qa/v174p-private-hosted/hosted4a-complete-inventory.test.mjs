import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCompleteInventory,ACCOUNT,REQUIRED_READ_ONLY_ENDPOINTS} from './hosted4a-complete-inventory.mjs';
const NOW=Date.parse('2026-11-17T08:10:00.000Z');
function fixtures(){
 const scripts=Array.from({length:23},(_,i)=>({id:'tien404-synthetic-worker-'+String(i).padStart(2,'0')}));
 const v175=[
  'tien404-v175e1-private-issuer-nosend-staging',
  'tien404-v175e2-ab-gateway-nosend-staging',
  'tien404-v175e2-durable-replay-nosend-staging',
  'tien404-v175e2-installation-registry-nosend-staging',
  'tien404-v175e2a-private-hosted-runner-nosend-staging'
 ];
 scripts.push(...v175.map(id=>({id})));
 const workers=scripts.map((x,i)=>({name:x.id,id:i.toString(16).padStart(32,'0')}));
 const dos=[
  {id:'a'.repeat(32),name:'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',script:'tien404-v175e2-durable-replay-nosend-staging',class:'ReplayBucket'},
  {id:'b'.repeat(32),name:'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults',script:'tien404-v175e2a-private-hosted-runner-nosend-staging',class:'RunnerResults'}
 ];
 const app=[{id:'c'.repeat(32),name:'tien404-ai-git-staging - Cloudflare Pages',destinations:[{type:'public'}]}];
 const domains=[{id:'d'.repeat(32),name:'existing-public.example.com'}];
 const api=(data,{info=true}={})=>({success:true,result:data,
  ...(info?{result_info:{page:1,per_page:100,count:data.length,total_count:data.length}}:{})});
 return {
  '/workers/scripts':[api(scripts,{info:false})],
  '/workers/workers':[api(workers)],
  '/access/apps':[api(app)],
  '/access/policies':[api([])],
  '/workers/durable_objects/namespaces':[api(dos)],
  '/workers/domains':[api(domains)]
 };
}
const scan=x=>normalizeCompleteInventory(x,ACCOUNT,NOW-30000,NOW);
const denied=(mut,code)=>{
 const x=fixtures();mut(x);
 const result=scan(x);assert.equal(result.status,'BLOCKED');
 assert(result.errors.some(e=>e===code||e.startsWith(code)),JSON.stringify(result.errors));
 assert.equal(result.deploy_authorized,false);
};
test('01 28 full Worker pages vs 28 scripts yield complete read-only inventory',()=>{
 const x=scan(fixtures());assert.deepEqual(x.errors,[]);
 assert.equal(x.status,'COMPLETE_READ_ONLY_NEEDS_INDEPENDENT_REVIEW');
 assert.equal(x.totals['/workers/workers'],28);
 assert.equal(x.inventory.page_verification.total_workers,28);
 assert.equal(x.deploy_authorized,false);
 assert.equal(x.independently_attested,false);
});
test('02 incomplete default Cloudflare first page 10 of 28 BLOCKS',()=>{
 denied(x=>{
  x['/workers/workers'][0]={success:true,result:x['/workers/workers'][0].result.slice(0,10),
   result_info:{page:1,per_page:10,count:10,total_count:28}};
 },'incomplete_pagination:/workers/workers');
});
test('03 fully paginated pages 10+10+8 are accepted',()=>{
 const x=fixtures(),all=x['/workers/workers'][0].result;
 x['/workers/workers']=[0,1,2].map(i=>({success:true,result:all.slice(i*10,(i+1)*10),
  result_info:{page:i+1,per_page:10,count:Math.min(10,28-i*10),total_count:28}}));
 assert.deepEqual(scan(x).errors,[]);
});
test('04 omit middle page denies',()=>{
 denied(x=>{
  const all=x['/workers/workers'][0].result;
  x['/workers/workers']=[0,2].map(i=>({success:true,result:all.slice(i*10,(i+1)*10),
   result_info:{page:i+1,per_page:10,count:i===0?10:8,total_count:28}}));
 },'incomplete_pagination:/workers/workers');
});
test('05 missing successful API response denies',()=>{
 denied(x=>{x['/access/policies'][0].success=false;},'bad_cloudflare_response:/access/policies');
});
test('06 missing metadata for worker pages denies',()=>{
 denied(x=>{delete x['/workers/workers'][0].result_info;},'unverifiable_page_metadata:/workers/workers');
});
test('07 changing total_count between pages denies',()=>{
 denied(x=>{
  const w=x['/workers/workers'][0].result;
  x['/workers/workers']=[0,1,2].map(i=>({success:true,result:w.slice(i*10,(i+1)*10),
   result_info:{page:i+1,per_page:10,count:i===2?8:10,total_count:i===2?29:28}}));
 },'changing_total_count:/workers/workers');
});
test('08 duplicate worker UUID is rejected',()=>{
 denied(x=>{x['/workers/workers'][0].result[1].id=x['/workers/workers'][0].result[0].id;},'worker_uuid_invalid_or_duplicate');
});
test('09 duplicate worker name rejected',()=>{
 denied(x=>{x['/workers/workers'][0].result[1].name=x['/workers/workers'][0].result[0].name;},'duplicate_result_identity:/workers/workers');
});
test('10 script list missing one name vs Workers fails cross-check',()=>{
 denied(x=>{x['/workers/scripts'][0].result.pop();},'script_worker_inventory_mismatch');
});
test('11 active target Worker on page 3 is detected',()=>{
 denied(x=>{
  const a=x['/workers/workers'][0].result;
  a[27].name='tien404-v174p-private-qa-issuer';
  x['/workers/scripts'][0].result[27].id=a[27].name;
 },'target_v174p_resource_already_exists');
});
test('12 existing Access policy that matches target name is denied',()=>{
 denied(x=>{x['/access/apps'][0].result[0].name='Access for tien404-v174p-private-qa-issuer';},'target_v174p_resource_already_exists');
});
test('13 DO namespace with target script name denied',()=>{
 denied(x=>{
  x['/workers/durable_objects/namespaces'][0].result.push({name:'some-namespace',script:'tien404-v174p-private-qa-issuer',class:'V174PReplayGuard'});
  const v=x['/workers/durable_objects/namespaces'][0].result_info;v.count++;v.total_count++;
 },'target_v174p_resource_already_exists');
});
test('14 missing V17.5 replay namespace must block',()=>{
 denied(x=>{
  x['/workers/durable_objects/namespaces'][0].result.pop();
  x['/workers/durable_objects/namespaces'][0].result_info.count=1;
  x['/workers/durable_objects/namespaces'][0].result_info.total_count=1;
 },'v175_namespace_identity_changed');
});
test('15 namespace class owner changed is unsafe even if name unchanged',()=>{
 denied(x=>{x['/workers/durable_objects/namespaces'][0].result[0].script='some-other-service';},'v175_namespace_identity_changed');
});
test('16 cannot infer approval from complete inventory',()=>assert.equal(scan(fixtures()).deploy_authorized,false));
test('17 stale snapshot above 10 minutes denied',()=>{
 const x=fixtures();const r=normalizeCompleteInventory(x,ACCOUNT,NOW-600001,NOW);
 assert(r.errors.includes('inventory_stale_or_future'));
});
test('18 wrong account ID denied',()=>{const r=normalizeCompleteInventory(fixtures(),'unknown',NOW,NOW);assert(r.errors.includes('wrong_account'));});
test('19 account-wide Access target requires review instead of blanket policy change',()=>{
 denied(x=>{x['/access/apps'][0].result[0].destinations=[{type:'all_workers'}]},'account_wide_worker_access_policy_review_required');
});
test('20 unexpected endpoint cannot be assumed safe',()=>{
 denied(x=>{x['/unknown/resource']=[{success:true,result:[]}]},'unrecognized_endpoint');
});
test('21 all required six Cloudflare endpoints present',()=>assert.equal(REQUIRED_READ_ONLY_ENDPOINTS.length,6));
test('22 no domain listing must block',()=>denied(x=>{delete x['/workers/domains'];},'missing_or_excessive_pages:/workers/domains'));
test('23 mismatch between reported page count and returned rows denied',()=>denied(x=>{
 x['/access/apps'][0].result_info.count=5;
},'unverifiable_page_metadata:/access/apps'));
test('24 inaccessible page with duplicate index denies',()=>denied(x=>{
 const p=x['/access/apps'][0];x['/access/apps'].push(structuredClone(p));
},'duplicate_page:/access/apps'));
