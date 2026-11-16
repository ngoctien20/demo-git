/**
 * TIEN404 CBOT-MSG-CANARY-01 — isolated synthetic shadow preview + LIVE
 * cutover BLOCKING ANALYSIS. No network, webhook, token, model, provider send,
 * real Page, Orders, Supabase connection, or workflow write.
 *
 * This module is NOT a native Meta verifier or approved Page→Store resolver.
 * The existing V16.7 runtime mint is a QA fixture only. A real canary may be
 * developed using this reviewed response shape after independent approval.
 */
import {createSyntheticMerchantRuntime} from '../v167-merchant/merchant-registry.mjs';

export const LIVE_WORKFLOW=Object.freeze({
 id:'Z7FdV7uDvApfbURQ',
 published_version:'d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92',
 live01_execution:'4176'
});
export const LIVE_AGENT_TOOLS=Object.freeze([
 'create_order','manage_order','update_order_address','get_order_status',
 'create_support_ticket'
]);
export const CANARY_PROFILE=Object.freeze({
 version:2,
 bot_name:'Trợ lý Tạp hóa A — Canary QA',
 greeting:'TIEN404-CANARY-01: Xin chào! Tôi hỗ trợ thông tin cửa hàng QA, chưa tiếp nhận đặt hàng.',
 tone:'thân thiện'
});

const isPlain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const safety=Object.freeze({
 synthetic_only:true,actual_page_authority_verified:false,
 actual_store_authority_verified:false,actual_published_version_changed:false,
 authorized_live_canary:false,can_send:false,can_publish:false,
 can_write_order:false,can_use_paid_model:false,
 sent_messages:0,orders_written:0,hosted_writes:0,model_calls:0
});
const forbidden=reason=>Object.freeze({
 status:'BLOCKED',reason,...safety
});

/**
 * Only the pinned local QA Merchant runtime can mint an issued context.
 * Caller-provided tenant/store or Messenger user text never authorizes a
 * live provider reply, even if a malicious payload says it is signed.
 */
export function createIsolatedCanaryShadow(){
 const runtime=createSyntheticMerchantRuntime();
 const issued=new WeakSet();
 const draft=runtime.proposeBotChange({
  actor_id:'QA_MANAGER_A',store_id:'QA_STORE_A',expected_version:1,
  patch:{bot_name:CANARY_PROFILE.bot_name,
   greeting:CANARY_PROFILE.greeting,tone:CANARY_PROFILE.tone}
 });
 const approval=runtime.ownerApproveDraft({
  actor_id:'QA_OWNER_A',store_id:'QA_STORE_A',
  candidate_version:draft.candidate_version
 });
 const profile=runtime.previewApprovedDraft({
  actor_id:'QA_OWNER_A',store_id:'QA_STORE_A'
 });
 if(approval.state!=='OWNER_APPROVED_PREVIEW_ONLY'||
    profile.preview_version!==CANARY_PROFILE.version||profile.not_published!==true)
  throw new Error('QA_DRAFT_PREVIEW_GUARD_FAILED');
 function issueSyntheticContext({account_id,event_id,synthetic_text='xin chao',
   channel='MESSENGER',contract='QA_VERIFIED_CHANNEL_EVENT_V1'}={}){
  const scope=runtime.resolveTrustedQaChannel({
   contract,channel,account_id,event_id,synthetic_text
  });
  const wrapper=Object.freeze({scope});
  issued.add(wrapper);
  return wrapper;
 }
 function previewCanary(context){
  if(!context||!issued.has(context))return forbidden('NON_ISSUED_CONTEXT');
  let envelope;
  try{envelope=runtime.workflowEnvelope(context.scope)}
  catch{return forbidden('STALE_OR_REVOKED_SCOPE')}
  if(envelope.channel!=='MESSENGER'||envelope.intent!=='FAST_FAQ')
   return forbidden('CANARY_GREETING_ONLY');
  const baseline=runtime.route(context.scope);
  if(envelope.store_id!=='QA_STORE_A')return Object.freeze({
   status:'NOT_TARGETED_SHOP_BASELINE_PREVIEW',
   current_greeting:baseline.answer_preview,profile_version:envelope.config_version,
   ...safety
  });
  if(envelope.config_version!==1)return forbidden('STALE_BASELINE_CONFIG');
  return Object.freeze({
   status:'OFFLINE_CANARY_PREVIEW_ONLY',
   current_greeting:baseline.answer_preview,
   preview_greeting:profile.greeting,
   preview_bot_name:profile.bot_name,
   candidate_version:profile.preview_version,
   proposed_tag:'TIEN404-CANARY-01',
   owner_approved_state:'OWNER_APPROVED_PREVIEW_ONLY',
   ...safety
  });
 }
 return Object.freeze({issueSyntheticContext,previewCanary});
}

/**
 * Fast fail-closed assessment of ACTUAL Published graph. An owner receipt
 * and one safe execution are NOT sufficient to reroute an active production
 * Page with legacy writable tools attached to the Agent.
 *
 * A future verified release should use a different reviewed authorization
 * service and security signoff, not set inputs on this local source object.
 */
export function assessRealCanaryCutover({published,receipt,proposed}={}){
 const reasons=[];
 if(!isPlain(published)||
   published.workflow_id!==LIVE_WORKFLOW.id||
   published.published_version!==LIVE_WORKFLOW.published_version||
   !Array.isArray(published.agent_tool_names)||
   !LIVE_AGENT_TOOLS.every(n=>published.agent_tool_names.includes(n))||
   published.active!==true){
  reasons.push('ACTUAL_PUBLISHED_GRAPH_NOT_MATCHED');
 }else{
  reasons.push('LEGACY_WRITABLE_AGENT_TOOLS_STILL_ATTACHED');
 }
 if(!isPlain(receipt)||receipt.contract!=='TIEN404_CBOT_MSG_LIVE01_USER_RECEIPT_V1'||
   receipt.reference_real_execution!==LIVE_WORKFLOW.live01_execution||
   receipt.user_reported_response_visible!==true||
   receipt.user_reported_response_matches_execution!==true){
  reasons.push('USER_VISIBLE_BASELINE_RECEIPT_NOT_CONFIRMED');
 }
 if(!isPlain(proposed)||proposed.stage!=='SOURCE_ONLY_CANDIDATE'||proposed.no_send!==true||
    proposed.target_scope!=='ONE_PRIVATELY_VERIFIED_PAGE_AND_ONE_QA_RECIPIENT'||
    proposed.writable_tool_nodes!==0||proposed.sends_without_owner_consent!==false){
  reasons.push('PROPOSED_ISOLATED_CANARY_GRAPH_UNSAFE');
 }
 reasons.push('NATIVE_PAGE_AND_OWNER_STORE_PRIVATE_EVIDENCE_REQUIRED');
 reasons.push('REQUIRE_OWNER_APPROVAL_OF_EXACT_N8N_PATCH_AND_ROLLBACK');
 reasons.push('REQUIRE_NO_WRITER_ROUTE_AND_NON_DUPLICATE_PROVIDER_RESPONDER');
 reasons.push('REQUIRE_QA_RECIPIENT_SCOPE_AND_RATE_BUDGET');
 return Object.freeze({
  contract:'T404_CBOT_MSG_CANARY_CUTOVER_PREFLIGHT_V1',
  decision:'NO_GO_NOT_DEPLOYED',
  reasons:Object.freeze(reasons),
  actual_live01_user_receipt:!!receipt&&receipt.user_reported_response_visible===true,
  source_only:true,no_send:true,
  can_apply_n8n_patch:false,can_publish:false,can_change_webhook:false,
  can_use_meta_token:false,can_send:false,can_create_order:false,
  can_read_private_page_id:false,can_read_hosted_custom_config:false,
  paid_model_calls:0,orders_written:0,provider_messages_sent:0
 });
}

/** Strict read-only JSON candidate validator for a separate manual workflow. */
export function verifyManualNoSendWorkflow(candidate){
 if(!isPlain(candidate)||candidate.active!==false||
    !Array.isArray(candidate.nodes)||candidate.nodes.length!==2||
    !candidate.nodes.some(n=>n.type==='n8n-nodes-base.manualTrigger')||
    !candidate.nodes.some(n=>n.type==='n8n-nodes-base.code')||
    !isPlain(candidate.connections))return false;
 const names=new Set(candidate.nodes.map(n=>n.name));
 if(names.size!==2)return false;
 const allowTypes=new Set(['n8n-nodes-base.manualTrigger','n8n-nodes-base.code']);
 for(const node of candidate.nodes){
  if(!allowTypes.has(node.type)||node.disabled===true||
    Object.hasOwn(node,'credentials'))return false;
  if(node.type==='n8n-nodes-base.code'){
   const source=String(node.parameters?.jsCode||'');
   if(source.length<40||source.length>6000||
      /(?:\bfetch\s*\(|\bthis\.helpers|process\.env|axios|httpRequest|https?:\/\/|webhook|meta\.|sendMessage|db\.dump|executeQuery|toolWorkflow|apiKey|token|credentials)/i.test(source))
    return false;
   if(!/NO_SEND/.test(source)||!/CANARY/.test(source))return false;
  }
 }
 const main=candidate.nodes.find(n=>n.type==='n8n-nodes-base.manualTrigger');
 const code=candidate.nodes.find(n=>n.type==='n8n-nodes-base.code');
 const sources=Object.keys(candidate.connections);
 return sources.length===1&&sources[0]===main.name&&
  candidate.connections[main.name]?.main?.length===1&&
  candidate.connections[main.name].main[0]?.length===1&&
  candidate.connections[main.name].main[0][0].node===code.name&&
  !Object.hasOwn(candidate.connections,code.name);
}
