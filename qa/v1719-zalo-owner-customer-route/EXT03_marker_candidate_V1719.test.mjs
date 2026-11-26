import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const source=readFileSync(new URL('./EXT03_marker_candidate_V1719.n8n.txt',import.meta.url),'utf8');
const script=new vm.Script('(function(){\n'+source+'\n})()');
const e={stage:'READ_ONLY',accepted:true,text:'TIEN404 EXT 03'};
function run(event,response){
 const $=()=>({first:()=>({json:event})});
 const $input={first:()=>({json:response})};
 return script.runInNewContext({$,$input,Date});
}
const base={external_sends:0,orders_written:0};
const scenarios=[
 ['owner',{...base,status:'OWNER_ROUTE_SEPARATE',route:'OWNER',reason:'owner_isolation'},'NOT_ACCEPTED_BY_CUSTOMER_ROUTER','OWNER_ROUTE_SEPARATE'],
 ['customer',{...base,status:'PUBLIC_CUSTOMER_EVENT_ACCEPTED',route:'CUSTOMER',qa_ext03_match:true},'CUSTOMER_ROUTE_ELIGIBLE','CUSTOMER_ROUTE_ELIGIBLE'],
 ['unverified',{...base,status:'BOT_IDENTITY_UNBOUND',route:'UNKNOWN'},'NOT_ACCEPTED_BY_CUSTOMER_ROUTER','ROUTE_UNVERIFIED'],
 ['owner_wrong_route',{...base,status:'OWNER_ROUTE_SEPARATE',route:'CUSTOMER',reason:'owner_isolation'},'NOT_ACCEPTED_BY_CUSTOMER_ROUTER','ROUTE_UNVERIFIED'],
 ['owner_wrong_reason',{...base,status:'OWNER_ROUTE_SEPARATE',route:'OWNER',reason:'wrong'},'NOT_ACCEPTED_BY_CUSTOMER_ROUTER','ROUTE_UNVERIFIED'],
 ['owner_with_send',{...base,status:'OWNER_ROUTE_SEPARATE',route:'OWNER',reason:'owner_isolation',external_sends:1},'NOT_ACCEPTED_BY_CUSTOMER_ROUTER','ROUTE_UNVERIFIED'],
 ['customer_with_write',{...base,status:'PUBLIC_CUSTOMER_EVENT_ACCEPTED',route:'CUSTOMER',qa_ext03_match:true,orders_written:1},'NOT_ACCEPTED_BY_CUSTOMER_ROUTER','ROUTE_UNVERIFIED'],
 ['customer_not_ext03',{...base,status:'PUBLIC_CUSTOMER_EVENT_ACCEPTED',route:'CUSTOMER',qa_ext03_match:false},'NOT_ACCEPTED_BY_CUSTOMER_ROUTER','ROUTE_UNVERIFIED'],
 ['cross_label_owner',{...base,status:'PUBLIC_CUSTOMER_EVENT_ACCEPTED',route:'OWNER',qa_ext03_match:true},'NOT_ACCEPTED_BY_CUSTOMER_ROUTER','ROUTE_UNVERIFIED'],
 ['blank_response',{},'NOT_ACCEPTED_BY_CUSTOMER_ROUTER','ROUTE_UNVERIFIED']
];
for(const [name,response,customer,route] of scenarios)test(name,()=>{
 const got=run(e,response);
 assert.equal(got.length,3);
 assert.deepEqual(Array.from(got,x=>x.json.slot),['v123_ext03_ingress','v123_ext03_customer','v123_ext03_route']);
 assert.equal(got[0].json.outcome,'SEEN_AUTHENTICATED_WEBHOOK');
 assert.equal(got[1].json.outcome,customer);
 assert.equal(got[2].json.outcome,route);
 assert.ok(got.every(x=>Object.keys(x.json).sort().join(',')==='observed_at,outcome,slot'));
 assert.ok(got.every(x=>!Number.isNaN(Date.parse(x.json.observed_at))));
});
for(const [name,event] of [
 ['non_ext03',{...e,text:'TIEN404 EXT 04'}],
 ['untrusted',{...e,accepted:false}],
 ['wrong_stage',{...e,stage:'UNKNOWN'}],
 ['missing_event',{}]
])test(name,()=>assert.equal(run(event,{}).length,0));
