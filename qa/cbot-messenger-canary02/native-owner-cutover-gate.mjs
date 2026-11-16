/**
 * TIEN404 CBOT-MSG-CANARY-02
 * Formal NO-SEND security preflight for a prospective single-webhook,
 * single-responder Messenger greeting branch and private Page evidence intake.
 *
 * This checks declarative source-only metadata; it does NOT independently
 * authenticate Meta Page ownership, verify Meta webhook signatures, check
 * a real recipient allowlist, or grant a publish/send authorization.
 *
 * Caution: A "PASS" graph check is structural only. Exact workflow node
 * parameters and n8n execution semantics require independent QA before any
 * separately approved live change.
 */
import {LIVE_AGENT_TOOLS,LIVE_WORKFLOW} from '../cbot-messenger-canary/isolated-canary-guard.mjs';

export const OWNER_EVIDENCE_STATES=Object.freeze([
 'NOT_OBSERVED','FUNCTIONAL_WEBHOOK_ONLY','INDEPENDENT_PRIVATE_REVIEW_PENDING'
]);
export const MUST_REVIEW=Object.freeze([
 'META_BUSINESS_PAGE_NATIVE_ADMIN_ROLE',
 'META_APP_PAGE_ASSIGNMENT_AND_MESSAGES_PERMISSION',
 'META_APP_WEBHOOK_MESSAGES_SUBSCRIPTION',
 'META_PAGE_SUBSCRIBED_APPS_READ_ONLY',
 'MERCHANT_CONSENT_EXACT_PAGE_TENANT_STORE',
 'PRIVATE_QA_PSID_OWNERSHIP_AND_EXPIRING_ALLOWLIST',
 'SINGLE_RESPONDER_VERSIONED_CONFIG_ROLLBACK'
]);
export const REQUIRED_CANARY_NODES=Object.freeze([
 'EXISTING_WEBHOOK','HMAC_VERIFIED','DEDUP_VERIFIED','PRIVATE_PAGE_STORE_RESOLVER',
 'QA_RECIPIENT_ALLOWLIST','CANARY_EXCLUSIVE_ROUTER','APPROVED_PROFILE_VERSION',
 'CANARY_DETERMINISTIC_REPLY','CANARY_RATE_TTL_GUARD','SEND_ONCE_EXISTING_NODE'
]);
const expectedStatus='NOT_OBSERVED';
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.getPrototypeOf(v)===Object.prototype;
const exact=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&
 Object.keys(v).every(k=>keys.includes(k));
const final=(reasons,structural)=>Object.freeze({
 contract:'TIEN404_CBOT_MSG_CANARY02_READINESS_V1',
 verdict:'NO_GO_NO_LIVE_CUTOVER',
 reasons:Object.freeze([...reasons]),
 source_only:true,
 structural_canary_candidate_valid:structural,
 independent_meta_page_owner_verified:false,
 independent_store_binding_verified:false,
 private_recipient_allowlist_verified:false,
 workflow_diff_signed:false,
 can_change_published:false,can_change_meta_subscription:false,
 can_activate_canary:false,can_send_provider:false,can_write_orders:false,
 can_read_customer_data:false,can_use_credentials:false,
 provider_messages_sent:0,orders_written:0,model_api_calls:0
});
function arrayOfStrings(x){
 return Array.isArray(x)&&x.every(v=>typeof v==='string')&&
  new Set(x).size===x.length;
}
const onlyNames=[
 'EXISTING_WEBHOOK','HMAC_VERIFIED','DEDUP_VERIFIED','PRIVATE_PAGE_STORE_RESOLVER',
 'QA_RECIPIENT_ALLOWLIST','CANARY_EXCLUSIVE_ROUTER','APPROVED_PROFILE_VERSION',
 'CANARY_DETERMINISTIC_REPLY','CANARY_RATE_TTL_GUARD','SEND_ONCE_EXISTING_NODE',
 'LEGACY_MESSENGER_AGENT'
];
/**
 * Minimal topology validator on an isolated source review schema.
 * No external calls; fail closed if missing mandatory barriers, duplicate
 * responders or a reachable legacy AI Agent on the canary path.
 */
export function reviewSingleResponderTopology(design){
 const errs=[];
 const reject=x=>{errs.push(x)};
 if(!exact(design,['contract','mode','nodes','canary_edges','baseline_edges',
 'message_ingress_count','send_node_count','agent_tools_attached_to_baseline',
 'canary_node_types','canary_enabled'])){
  reject('INVALID_TOPOLOGY_SCHEMA');return Object.freeze({pass:false,reasons:errs});
 }
 if(design.contract!=='TIEN404_CBOT_CANARY02_SOURCE_TOPOLOGY_V1'||
  design.mode!=='SOURCE_ONLY_PROPOSED'||design.canary_enabled!==false||
  design.message_ingress_count!==1||design.send_node_count!==1)
  reject('MUST_HAVE_ONE_INBOUND_ONE_OUTBOUND_DISABLED_CANARY');
 if(!arrayOfStrings(design.nodes)||design.nodes.length!==onlyNames.length||
    !onlyNames.every(n=>design.nodes.includes(n)))
  reject('NODE_ALLOWLIST_MISMATCH');
 if(!arrayOfStrings(design.agent_tools_attached_to_baseline)||
    !LIVE_AGENT_TOOLS.every(n=>design.agent_tools_attached_to_baseline.includes(n))||
    design.agent_tools_attached_to_baseline.length!==LIVE_AGENT_TOOLS.length)
  reject('PUBLISHED_BASELINE_WRITER_TOOLS_NOT_ACCOUNTED');
 if(!exact(design.canary_node_types,{...Object.fromEntries(onlyNames.map(k=>[k,true]))}))
  reject('NODE_TYPES_MISSING_OR_EXTRA');
 else{
  for(const n of REQUIRED_CANARY_NODES){
   if(design.canary_node_types[n]!=='SAFE_METADATA_OR_DETERMINISTIC'&&
     !(n==='SEND_ONCE_EXISTING_NODE'&&design.canary_node_types[n]==='PROVIDER_SEND_SHARED')){
     reject('UNSAFE_CANARY_NODE_TYPE');break;
   }
  }
  if(design.canary_node_types.LEGACY_MESSENGER_AGENT!=='AGENT_WITH_LEGACY_TOOLS')
   reject('LEGACY_AGENT_NOT_RECORDED');
 }
 if(!Array.isArray(design.canary_edges)||!Array.isArray(design.baseline_edges)||
   design.canary_edges.length===0||design.baseline_edges.length===0||
   ![...design.canary_edges,...design.baseline_edges].every(e=>
      Array.isArray(e)&&e.length===2&&e.every(v=>typeof v==='string'&&onlyNames.includes(v)))){
  reject('INVALID_EDGE_SCHEMA');return Object.freeze({pass:false,reasons:Object.freeze(errs)});
 }
 const canon=e=>e[0]+'=>'+e[1];
 if(new Set(design.canary_edges.map(canon)).size!==design.canary_edges.length)
  reject('DUPLICATE_CANARY_EDGE');
 const order=[
  'EXISTING_WEBHOOK','HMAC_VERIFIED','DEDUP_VERIFIED',
  'PRIVATE_PAGE_STORE_RESOLVER','QA_RECIPIENT_ALLOWLIST',
  'CANARY_EXCLUSIVE_ROUTER','APPROVED_PROFILE_VERSION',
  'CANARY_DETERMINISTIC_REPLY','CANARY_RATE_TTL_GUARD',
  'SEND_ONCE_EXISTING_NODE'
 ];
 const expected=order.slice(1).map((v,i)=>order[i]+'=>'+v);
 if(design.canary_edges.length!==expected.length||
  expected.some((edge,i)=>canon(design.canary_edges[i])!==edge))
  reject('CANARY_BYPASS_OR_EXTRA_EDGE');
 if(design.canary_edges.some(e=>e.includes('LEGACY_MESSENGER_AGENT')))
  reject('CANARY_REACHES_WRITABLE_AGENT');
 const normal=[
  ['EXISTING_WEBHOOK','HMAC_VERIFIED'],
  ['HMAC_VERIFIED','DEDUP_VERIFIED'],
  ['DEDUP_VERIFIED','PRIVATE_PAGE_STORE_RESOLVER'],
  ['PRIVATE_PAGE_STORE_RESOLVER','QA_RECIPIENT_ALLOWLIST'],
  ['QA_RECIPIENT_ALLOWLIST','CANARY_EXCLUSIVE_ROUTER'],
  ['CANARY_EXCLUSIVE_ROUTER','LEGACY_MESSENGER_AGENT'],
  ['LEGACY_MESSENGER_AGENT','SEND_ONCE_EXISTING_NODE']
 ];
 if(design.baseline_edges.length!==normal.length||
   normal.some(([src,dst],i)=>design.baseline_edges[i]?.[0]!==src||
      design.baseline_edges[i]?.[1]!==dst))
  reject('BASELINE_ROUTE_NOT_EXCLUSIVE_OR_NOT_ACCOUNTED');
 return Object.freeze({pass:errs.length===0,reasons:Object.freeze(errs)});
}

const recordKeys=['contract','source','observed_date_jst','workflow_id',
 'published_version','published_active','published_node_count',
 'legacy_ai_tool_nodes','published_send_nodes','published_dynamic_profile',
 'real_meta_app_page_subscription','real_native_page_admin',
 'real_merchant_page_store_consent','real_qa_recipient_verified',
 'hosted_channel_bindings','canonical_store_tables',
 'store_membership_tables','store_scoped_select_policies',
 'qa_manual_workflow_id','qa_manual_workflow_active',
 'qa_manual_execution_id','qa_manual_execution_status',
 'live01_actual_execution','live01_user_confirmed','private_review_ticket',
 'actual_published_patch_applied'];
export function reviewNativeOwnershipAndCutover(evidence,design){
 const reasons=[];
 if(!exact(evidence,recordKeys)||
    evidence.contract!=='TIEN404_CBOT_CANARY02_ACTUAL_READONLY_BASELINE_V1'||
    evidence.source!=='N8N_GITHUB_SUPABASE_METADATA_AND_USER_REPORT'||
    evidence.workflow_id!==LIVE_WORKFLOW.id||
    evidence.published_version!==LIVE_WORKFLOW.published_version||
    evidence.published_active!==true||evidence.published_node_count!==27||
    evidence.published_send_nodes!==1||
    !arrayOfStrings(evidence.legacy_ai_tool_nodes)||
    LIVE_AGENT_TOOLS.some(n=>!evidence.legacy_ai_tool_nodes.includes(n))||
    evidence.legacy_ai_tool_nodes.length!==LIVE_AGENT_TOOLS.length||
    evidence.published_dynamic_profile!==false||
    evidence.qa_manual_workflow_id!=='VSmXkK7Y1Bb3Dg2w'||
    evidence.qa_manual_workflow_active!==false||
    evidence.qa_manual_execution_id!=='4177'||
    evidence.qa_manual_execution_status!=='success'||
    evidence.live01_actual_execution!=='4176'||
    evidence.live01_user_confirmed!==true||
    evidence.private_review_ticket!==null||
    evidence.actual_published_patch_applied!==false){
  return final(['INVALID_OR_SELF_ASSERTED_REAL_EVIDENCE'],false);
 }
 for(const k of ['hosted_channel_bindings','canonical_store_tables',
    'store_membership_tables','store_scoped_select_policies']){
  if(!Number.isSafeInteger(evidence[k])||evidence[k]<0)
   return final(['UNTRUSTED_HOSTED_AGGREGATE'],false);
 }
 for(const k of ['real_meta_app_page_subscription','real_native_page_admin',
    'real_merchant_page_store_consent','real_qa_recipient_verified']){
  if(evidence[k]!==expectedStatus)
   return final(['SELF_REPORTED_NATIVE_PROOF_NOT_ACCEPTED'],false);
 }
 if(evidence.hosted_channel_bindings===0)reasons.push('NO_REAL_HOSTED_PROVIDER_BINDING');
 if(evidence.canonical_store_tables===0||evidence.store_membership_tables===0)
  reasons.push('CANONICAL_STORE_AND_MEMBERSHIP_MISSING');
 if(evidence.store_scoped_select_policies===0)reasons.push('NO_HOSTED_STORE_SELECT_RLS');
 reasons.push('META_APP_PAGE_SUBSCRIPTION_PRIVATE_EVIDENCE_NOT_REVIEWED');
 reasons.push('NATIVE_PAGE_OWNER_CONSENT_NOT_REVIEWED');
 reasons.push('MERCHANT_TO_STORE_CONSENT_NOT_REVIEWED');
 reasons.push('PRIVATE_QA_RECIPIENT_NOT_BOUND');
 reasons.push('EXACT_WORKFLOW_PATCH_AND_ROLLBACK_NOT_INDEPENDENTLY_APPROVED');
 reasons.push('CURRENT_AGENT_STILL_HAS_FIVE_LEGACY_TOOLS');
 const topo=reviewSingleResponderTopology(design);
 for(const e of topo.reasons)reasons.push('TOPOLOGY_'+e);
 // Even if topology is structurally valid, this function cannot grant real
 // authority from source data or fabricated local strings.
 return final(reasons,topo.pass);
}
