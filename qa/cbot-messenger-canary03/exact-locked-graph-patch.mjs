'use strict';
/**
 * TIEN404 CBOT-MSG-CANARY-03
 * Exact n8n node/edge patch blueprint derived from the READ-ONLY observed
 * 27-node Published Messenger graph. All newly added routing is LOCKED and
 * deliberately cannot match a real recipient.
 *
 * This module has ZERO network, filesystem writes, credentials, provider
 * calls or n8n mutation. It returns source-only patch instructions and a
 * sanitized TOPOLOGY PREVIEW, NOT an importable full workflow export.
 *
 * To live-enable a canary later requires a DIFFERENT reviewed patch with:
 * native Page/recipient authorization, atomic one-shot claim, rate limit,
 * tested item pairing, private snapshot/rollback and specific owner consent.
 */
const BASE=Object.freeze({
  workflow_id:'Z7FdV7uDvApfbURQ',
  active_version:'d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92',
  node_count:27,
  loop:'Loop One Message',
  agent:'Messenger AI Agent',
  prepare:'Prepare Messenger Reply',
  send:'Send Messenger Reply - CONFIGURE TOKEN',
  post:'Webhook1',
  get:'Webhook',
  signature:'Verify Signature Timing-Safe',
  signature_if:'Verify Meta Signature',
  dedup:'Skip Duplicate Message ID'
});
const EXISTING_TOOLS=Object.freeze([
  'create_order','update_order_address','manage_order',
  'get_order_status','create_support_ticket'
]);
const NEW=Object.freeze({
  guard:'T404 Canary Identity Guard — LOCKED',
  ifMatch:'T404 Canary Exact Match?',
  ifBlock:'T404 QA Recipient Block?',
  greeting:'T404 Fixed Canary Greeting — NO TOOLS',
  drop:'T404 Drop Unauthorized QA Input — NO SEND'
});
const privateError=(reason)=>Object.freeze({
  contract:'T404_CBOT_MSG_CANARY03_PATCH_RESULT_V1',
  status:'BLOCKED_BASELINE_MISMATCH',reason,
  can_apply_published:false,can_send:false,
  can_write_order:false,can_use_credentials:false,
  can_activate:false,live_patch_exported:false
});
const edges=(connections,node,key='main',index=0)=>
  (connections?.[node]?.[key]?.[index]||[]).filter(Boolean).map(e=>e.node);
const only=(arr,target)=>arr.length===1&&arr[0]===target;
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const newNode=(name,type,id,parameters,position)=>Object.freeze({
 id,name,type,typeVersion:type==='n8n-nodes-base.if'?2.4:2,
 position:Object.freeze(position),parameters
});
const ifParams=(field,id)=>({
 conditions:{
  options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:4},
  conditions:[{
   id,
   leftValue:'={{ $json.'+field+' }}',rightValue:'',
   operator:{type:'boolean',operation:'true',singleValue:true}
  }],
  combinator:'and'
 },
 options:{}
});
const lockedGuard=String.raw\`/**
 * INTENTIONALLY LOCKED. Never interpret a user-supplied
 * pageId/senderId/role/approval as trusted authority.
 * This node receives a message already signed and deduplicated upstream,
 * but it CANNOT certify Meta Page admin or a private QA recipient.
 */
return $input.all().map((item,i)=>({
 json:{...item.json,t404_canary_match:false,t404_qa_block:false,
  t404_guard_state:'LOCKED_AWAITING_PRIVATE_OWNER_REVIEW'},
 pairedItem:{item:i}
}));\`;
const fixedGreeting=String.raw\`// NO_SEND by itself. Deterministic preview; no Agent/tools/network.
return $input.all().map((item,i)=>({
 json:{...item.json,
 output:'TIEN404-CANARY-01: Xin chào! Tôi hỗ trợ thông tin cửa hàng QA, chưa tiếp nhận đặt hàng.'},
 pairedItem:{item:i}
}));\`;
const suppress=String.raw\`// NO_SEND and NO legacy Agent execution for a future targeted QA block.
// Returns zero items: does not reach Prepare Messenger Reply or Meta Send.
return [];\`;
export const CANARY03_BASELINE=BASE;
export const CANARY03_ADDED_NAMES=NEW;
export const CANARY03_LEGACY_TOOL_NAMES=EXISTING_TOOLS;
export function verifyObservedBaseline(meta){
 const errors=[];
 if(!plain(meta)||meta.id!==BASE.workflow_id||
   meta.activeVersionId!==BASE.active_version||
   meta.active!==true||!Array.isArray(meta.nodes)||
   meta.nodes.length!==BASE.node_count||!plain(meta.connections))
  return {valid:false,errors:['WRONG_PUBLISHED_ID_VERSION_OR_GRAPH']};
 const types=Object.fromEntries(meta.nodes.map(n=>[n.name,n.type]));
 if(Object.keys(types).length!==meta.nodes.length)
  errors.push('DUPLICATE_NODE_NAMES');
 if(types[BASE.loop]!=='n8n-nodes-base.splitInBatches'||
   types[BASE.agent]!=='@n8n/n8n-nodes-langchain.agent'||
   types[BASE.prepare]!=='n8n-nodes-base.code'||
   types[BASE.send]!=='n8n-nodes-base.httpRequest'||
   types[BASE.post]!=='n8n-nodes-base.webhook'||
   types[BASE.get]!=='n8n-nodes-base.webhook'||
   types[BASE.signature]!=='n8n-nodes-base.code'||
   types[BASE.signature_if]!=='n8n-nodes-base.if'||
   types[BASE.dedup]!=='n8n-nodes-base.dataTable')
  errors.push('EXPECTED_NODE_TYPES_CHANGED');
 for(const name of Object.values(NEW))
  if(types[name])errors.push('CANARY_PATCH_ALREADY_PRESENT');
 if(!only(edges(meta.connections,BASE.loop,'main',1),BASE.agent)||
    !only(edges(meta.connections,BASE.agent),BASE.prepare)||
    !only(edges(meta.connections,BASE.prepare),BASE.send))
  errors.push('EXACT_ROUTING_EDGE_CHANGED');
 if(!only(edges(meta.connections,BASE.post),'Crypto')||
    !only(edges(meta.connections,'Crypto'),BASE.signature)||
    !only(edges(meta.connections,BASE.signature),BASE.signature_if)||
    !only(edges(meta.connections,BASE.signature_if,'main',0),'Respond to Webhook2')||
    !only(edges(meta.connections,'Respond to Webhook2'),'Extract Messenger Text')||
    !only(edges(meta.connections,'Extract Messenger Text'),BASE.dedup)||
    !only(edges(meta.connections,BASE.dedup),BASE.loop))
  errors.push('WEBHOOK_HMAC_DEDUP_CHAIN_MISMATCH');
 const webhookNodes=meta.nodes.filter(n=>n.type==='n8n-nodes-base.webhook');
 if(webhookNodes.length!==2||
    webhookNodes.some(n=>n.parameters?.path!=='tien404-messenger-qa')||
    webhookNodes.find(n=>n.name===BASE.post)?.parameters?.httpMethod!=='POST')
  errors.push('WEBHOOK_PATH_OR_COUNT_MISMATCH');
 const sendNodes=meta.nodes.filter(n=>n.name===BASE.send);
 if(sendNodes.length!==1)errors.push('SHARED_SEND_COUNT_MISMATCH');
 for(const name of EXISTING_TOOLS)
  if(!edges(meta.connections,name,'ai_tool').includes(BASE.agent))
   errors.push('LEGACY_TOOL_LINK_MISSING_'+name);
 const prep=meta.nodes.find(n=>n.name===BASE.prepare);
 const prepCode=String(prep?.parameters?.jsCode||'');
 if(!prepCode.includes("$('Loop One Message')")||
    !prepCode.includes('context.currentRunIndex')||
    !prepCode.includes('incoming.output'))
  errors.push('PREPARE_REPLY_PAIRING_CONTRACT_CHANGED');
 return {valid:errors.length===0,errors};
}

/** Source-only patch. No full graph, customer IDs or credentials are emitted. */
export function previewLockedExactPatch(meta){
 const result=verifyObservedBaseline(meta);
 if(!result.valid)return privateError(result.errors.join('|'));
 const additions=[
 newNode(NEW.guard,'n8n-nodes-base.code',
  '8b891075-0a6c-48b2-8ce2-26f3f50ad211',
  {mode:'runOnceForAllItems',jsCode:lockedGuard},[1910,500]),
 newNode(NEW.ifMatch,'n8n-nodes-base.if',
  '76326963-14ea-4d7c-b7b0-6d99bf825baf',
  ifParams('t404_canary_match','38039281-8d1f-4b9c-8b6c-f7288c19448a'),[2120,500]),
 newNode(NEW.ifBlock,'n8n-nodes-base.if',
  '6be9ef47-39ac-408e-86fa-b322bc12b829',
  ifParams('t404_qa_block','419d1b24-1bf2-4654-b0a1-df53d83131c2'),[2350,630]),
 newNode(NEW.greeting,'n8n-nodes-base.code',
  '762cf178-799d-44a1-9583-687488ec6a57',
  {mode:'runOnceForAllItems',jsCode:fixedGreeting},[2350,405]),
 newNode(NEW.drop,'n8n-nodes-base.code',
  'a1e9bb8b-157d-43c9-b665-8177a85c2f7a',
  {mode:'runOnceForAllItems',jsCode:suppress},[2610,760])
 ];
 const to=(node)=>({node,type:'main',index:0});
 const patch={
  replace_connection:{
   from:BASE.loop,output:'main',output_index:1,
   old:[to(BASE.agent)],new:[to(NEW.guard)]
  },
  add_connections:{
   [NEW.guard]:{main:[[to(NEW.ifMatch)]]},
   [NEW.ifMatch]:{main:[[to(NEW.greeting)],[to(NEW.ifBlock)]]},
   [NEW.ifBlock]:{main:[[to(NEW.drop)],[to(BASE.agent)]]},
   [NEW.greeting]:{main:[[to(BASE.prepare)]]}
  },
  // No connection from NEW.drop: it returns zero items by design.
  added_nodes:additions,
  original_published_version:BASE.active_version,
  publish_authorized:false,
  qa_sender_present:false,
  native_page_owner_attested_privately:false,
  one_time_atomic_claim_implemented:false
 };
 const preview=JSON.parse(JSON.stringify(meta.connections));
 preview[BASE.loop].main[1]=[to(NEW.guard)];
 Object.assign(preview,patch.add_connections);
 const graph=Object.fromEntries(Object.entries(preview).map(([n,v])=>[n,
   (v.main||[]).flat().filter(Boolean).map(x=>x.node)]));
 // Structural reachability check: the greeting has no path through
 // either legacy AI Agent or its business tool connections.
 const reachable=(src)=>{const seen=new Set(),q=[src];while(q.length){
  const n=q.shift();if(seen.has(n))continue;seen.add(n);
  for(const e of graph[n]||[])q.push(e);
 }return seen;};
 const canaryReach=reachable(NEW.greeting);
 const dropReach=reachable(NEW.drop);
 const structuralSafe=!canaryReach.has(BASE.agent)&&!dropReach.has(BASE.agent)&&
  canaryReach.has(BASE.prepare)&&canaryReach.has(BASE.send)&&
  !dropReach.has(BASE.prepare)&&!dropReach.has(BASE.send)&&
  additions.every(n=>!n.credentials);
 return Object.freeze({
  contract:'T404_CBOT_MSG_CANARY03_PATCH_RESULT_V1',
  status:structuralSafe?'PATCH_BLUEPRINT_VALID_LOCKED_NOT_APPLIED':'BLOCKED_UNSAFE_GRAPH',
  original_node_count:meta.nodes.length,
  proposed_node_count:meta.nodes.length+additions.length,
  original_published_version:BASE.active_version,
  changes:patch,
  canary_path_reaches_ai_agent:canaryReach.has(BASE.agent),
  canary_path_reaches_single_sender:canaryReach.has(BASE.send),
  drop_path_reaches_sender:dropReach.has(BASE.send),
  existing_legacy_tool_edges_preserved:true,
  structurally_no_write_canary_path:structuralSafe,
  new_webhook_nodes:0,new_provider_send_nodes:0,
  real_page_target_verified:false,private_qa_recipient_bound:false,
  atomic_one_shot_guard_implemented:false,
  can_apply_published:false,can_send:false,can_activate:false,
  can_write_order:false,can_use_credentials:false,live_patch_exported:false
 });
}
