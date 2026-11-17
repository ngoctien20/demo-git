/**
 * TIEN404 V17.4P-HOSTED.4A -- offline adapter for sanitized Cloudflare GET responses.
 * No network calls, token retrieval, deployment, resource writes, or authority grant.
 *
 * Critical P1: GET /accounts/:id/workers/workers defaults to 10 entities PER PAGE.
 * A single-page scan can mislabel a Worker collision as absent when total_count > 10.
 */
export const INVENTORY_CONTRACT='T404_V174P_HOSTED4A_COMPLETE_CONTROL_PLANE_INVENTORY_V1';
export const ACCOUNT='ac01685529c0a31fc185335f07648edf';
const PREFIX='/accounts/'+ACCOUNT;
const PATHS=Object.freeze([
 '/workers/scripts','/workers/workers','/access/apps','/access/policies',
 '/workers/durable_objects/namespaces','/workers/domains'
]);
const V175_DOS=Object.freeze([
 {name:'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
  script:'tien404-v175e2-durable-replay-nosend-staging',class:'ReplayBucket'},
 {name:'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults',
  script:'tien404-v175e2a-private-hosted-runner-nosend-staging',class:'RunnerResults'}
]);
const TARGET='tien404-v174p-private-qa-issuer';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const array=x=>Array.isArray(x)?x:[];
function identify(path,item){
 if(!obj(item))return null;
 if(path==='/workers/scripts')return typeof item.id==='string'?item.id:null;
 if(path==='/workers/workers')return typeof item.name==='string'?item.name:null;
 if(path==='/workers/durable_objects/namespaces')return typeof item.name==='string'?item.name:null;
 if(path==='/workers/domains')return typeof item.id==='string'?item.id:null;
 return typeof item.id==='string'?item.id:null;
}
function pagesFor(path,records,errors){
 const wrapped=records?.[path];
 if(!Array.isArray(wrapped)||wrapped.length===0||wrapped.length>30){
  errors.push('missing_or_excessive_pages:'+path);return [];
 }
 const collected=new Map(),perPages=new Set();
 let total=null,usesMeta=null;
 for(const p of wrapped){
  if(!obj(p)||p.success!==true||!Array.isArray(p.result)){
   errors.push('bad_cloudflare_response:'+path);return [];
  }
  const info=p.result_info;
  if(path==='/workers/scripts'&&info==null){
   if(wrapped.length!==1)errors.push('unpaginated_scripts_multiple_batches');
   if(usesMeta===true)errors.push('inconsistent_scripts_metadata');
   usesMeta=false;
   collected.set(1,p.result);continue;
  }
  if(!obj(info)||!Number.isSafeInteger(info.page)||info.page<1||
    !Number.isSafeInteger(info.per_page)||info.per_page<1||
    !Number.isSafeInteger(info.total_count)||info.total_count<0||
    !Number.isSafeInteger(info.count)||info.count!==p.result.length){
    errors.push('unverifiable_page_metadata:'+path);return [];
  }
  if(usesMeta===false)errors.push('inconsistent_scripts_metadata');
  usesMeta=true;
  if(total!==null&&total!==info.total_count)errors.push('changing_total_count:'+path);
  if(collected.has(info.page))errors.push('duplicate_page:'+path+':'+info.page);
  total=info.total_count;
  perPages.add(info.per_page);
  collected.set(info.page,p.result);
 }
 if(usesMeta!==false){
  if(perPages.size!==1)errors.push('inconsistent_page_size:'+path);
  const per_page=[...perPages][0];
  const needed=Math.max(1,Math.ceil((total||0)/(per_page||1)));
  if(needed!==collected.size||needed>30)errors.push('incomplete_pagination:'+path);
  if([...collected.keys()].some(p=>p>needed||p<1)||[...Array(needed)].some((_,i)=>!collected.has(i+1)))
   errors.push('missing_page_index:'+path);
 }
 const ordered=[...collected.entries()].sort((a,b)=>a[0]-b[0]).flatMap(([,v])=>v);
 if(usesMeta!==false&&ordered.length!==total)errors.push('truncated_or_overfull:'+path);
 const ids=ordered.map(item=>identify(path,item));
 if(ids.some(x=>typeof x!=='string'||x.length<1))errors.push('invalid_result_identity:'+path);
 if(new Set(ids).size!==ids.length)errors.push('duplicate_result_identity:'+path);
 return ordered;
}
/**
 * Input is an offline, independently collected map from Cloudflare READ ONLY API.
 * Form: { '/workers/workers':[{success:true,result:[...],result_info:{page:1,
 * per_page:100,count:28,total_count:28}}], ... }.
 *
 * Never store private Access identity or credentials in source. This does NOT
 * prove where the data was collected; separate operator attestation is mandatory.
 */
export function normalizeCompleteInventory(input,accountId=ACCOUNT,collectedAtMs=Date.now(),now=Date.now()){
 const errors=[];
 if(accountId!==ACCOUNT)errors.push('wrong_account');
 if(!Number.isSafeInteger(collectedAtMs)||collectedAtMs>now||
    now-collectedAtMs>600000)errors.push('inventory_stale_or_future');
 const records=obj(input)?input:{};
 if(Object.keys(records).some(k=>!PATHS.includes(k)))errors.push('unrecognized_endpoint');
 const values=Object.fromEntries(PATHS.map(path=>[path,pagesFor(path,records,errors)]));
 const scripts=values['/workers/scripts'].map(x=>x.id);
 const workers=values['/workers/workers'].map(x=>x.name);
 const workerIds=values['/workers/workers'].map(x=>x.id);
 if(workerIds.some(id=>typeof id!=='string'||!/^[a-f0-9]{32}$/i.test(id))||
    new Set(workerIds).size!==workerIds.length)errors.push('worker_uuid_invalid_or_duplicate');
 const left=[...scripts].sort(),right=[...workers].sort();
 if(JSON.stringify(left)!==JSON.stringify(right))errors.push('script_worker_inventory_mismatch');
 const namespaces=values['/workers/durable_objects/namespaces'];
 for(const expected of V175_DOS){
  const matches=namespaces.filter(x=>x.name===expected.name);
  if(matches.length!==1||matches[0].script!==expected.script||matches[0].class!==expected.class)
   errors.push('v175_namespace_identity_changed:'+expected.name);
 }
 const apps=values['/access/apps'];
 if(apps.some(a=>a?.destinations?.some(d=>d?.type==='all_workers')))
  errors.push('account_wide_worker_access_policy_review_required');
 const targetIndex=workers.indexOf(TARGET);
 const targetId=targetIndex>=0?workerIds[targetIndex]:null;
 if(scripts.includes(TARGET)||workers.includes(TARGET)||
    namespaces.some(x=>x.name?.includes(TARGET)||x.script===TARGET)||
    apps.some(x=>x.name?.includes(TARGET)||
      (targetId!==null&&x.destinations?.some(d=>d?.worker_id===targetId))))
  errors.push('target_v174p_resource_already_exists');
 if(values['/workers/domains'].some(x=>x.name?.includes(TARGET)))
  errors.push('target_worker_domain_collision');
 const result=Object.freeze({
  contract:INVENTORY_CONTRACT,
  status:errors.length?'BLOCKED':'COMPLETE_READ_ONLY_NEEDS_INDEPENDENT_REVIEW',
  errors,
  totals:Object.freeze(Object.fromEntries(PATHS.map(p=>[p,values[p].length]))),
  inventory:Object.freeze({
   account_id:accountId,
   source:'CLOUDFLARE_CONTROL_PLANE_READ_ONLY',
   collected_at_ms:collectedAtMs,
   script_names:scripts,
   worker_names:workers,
   do_namespace_names:namespaces.map(x=>x.name),
   access_app_names:apps.map(x=>x.name),
   page_verification:Object.freeze({
    status:errors.length?'INCOMPLETE':'COMPLETE',
    cross_consistent:errors.length===0,
    total_workers:workers.length,
    total_scripts:scripts.length
   })
  }),
  deploy_authorized:false,
  access_change_authorized:false,
  qa_host_authorized:false,
  independently_attested:false
 });
 return result;
}
export const REQUIRED_READ_ONLY_ENDPOINTS=PATHS;
