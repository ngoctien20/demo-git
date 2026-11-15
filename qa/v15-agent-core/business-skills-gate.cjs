'use strict';
/** V15.0-04 Business Skills source-only policy boundary.
 * Pure authorization PLAN; NEVER executes a tool, sends a provider message,
 * stores memory, charges a model, or writes Orders/Products.
 * Identity/capability must be independently reauthorized by a private backend.
 */
const SKILLS=Object.freeze({
  catalog_read:Object.freeze({effect:'READ_ONLY',roles:['customer','owner','manager','staff','service']}),
  price_quote:Object.freeze({effect:'READ_ONLY',roles:['customer','owner','manager','staff']}),
  order_status_read:Object.freeze({effect:'READ_ONLY',roles:['customer','owner','manager','staff']}),
  owner_report_read:Object.freeze({effect:'READ_ONLY',roles:['owner','manager']}),
  order_draft:Object.freeze({effect:'DRAFT_CONFIRMATION_REQUIRED',roles:['customer','owner','manager']}),
  support_draft:Object.freeze({effect:'DRAFT_CONFIRMATION_REQUIRED',roles:['customer','owner','manager','staff']})
});
function block(reason){return Object.freeze({status:'BLOCKED',reason,execute_tool:false,
  provider_sends:0,orders_written:0,hosted_reads:0,model_calls:0,can_send:false});}
async function prepareSkill(agentPlan,{reauthorize}={}){
  if(!agentPlan||typeof agentPlan!=='object'||Array.isArray(agentPlan)||
     typeof reauthorize!=='function')return block('PRIVATE_BACKEND_REAUTH_REQUIRED');
  if(agentPlan.status!=='CANDIDATE_OFFLINE_NO_SEND'||agentPlan.contract_version!=='V15.0-01'||
     agentPlan.can_send!==false||agentPlan.provider_sends!==0||
     agentPlan.real_llm_calls!==0||agentPlan.actual_orders_written!==0||
     agentPlan.tools_executed!==0||agentPlan.trusted_store_isolated!==true)
     return block('AGENT_PLAN_NOT_SAFE');
  if(agentPlan.tool===null)return Object.freeze({status:'NO_TOOL_REQUIRED',execute_tool:false,
    provider_sends:0,orders_written:0,hosted_reads:0,model_calls:0,can_send:false});
  if(!agentPlan.tool||typeof agentPlan.tool!=='object'||Array.isArray(agentPlan.tool)||
     typeof agentPlan.tool.capability!=='string'||!Object.hasOwn(SKILLS,agentPlan.tool.capability))
     return block('UNSUPPORTED_SKILL');
  const capability=agentPlan.tool.capability,skill=SKILLS[capability];
  if(!agentPlan.allowed_capabilities?.includes(capability)||
     !skill.roles.includes(agentPlan.actor_role))return block('CAPABILITY_OR_ROLE_DENIED');
  if(skill.effect==='READ_ONLY' && agentPlan.tool.read_only!==true)return block('READ_ONLY_POLICY_CONFLICT');
  if(skill.effect!=='READ_ONLY' && (agentPlan.tool.read_only!==false||agentPlan.tool.requires_confirmation!==true))
     return block('DRAFT_CONFIRMATION_POLICY_CONFLICT');
  let proof;try{proof=await reauthorize({requestId:agentPlan.request_id,
     sessionRef:agentPlan.session_ref,channel:agentPlan.channel,
     actorRole:agentPlan.actor_role,capability,policyVersion:agentPlan.policy_version});}
  catch{return block('BACKEND_REAUTH_FAILED')}
  if(!proof||proof.origin!=='BACKEND_OFFLINE_AUTHORIZATION'||proof.authorizedForStaging!==true||
     proof.requestId!==agentPlan.request_id||proof.sessionRef!==agentPlan.session_ref||
     proof.channel!==agentPlan.channel||proof.actorRole!==agentPlan.actor_role||
     proof.capability!==capability||proof.policyVersion!==agentPlan.policy_version||
     proof.subscriptionActive!==true||proof.revoked!==false||
     proof.canSend!==false||proof.canWriteOrders!==false)
     return block('BACKEND_CAPABILITY_ATTESTATION_INVALID');
  return Object.freeze({status:skill.effect==='READ_ONLY'?'READ_ONLY_ADAPTER_REQUIRED':'CONFIRMATION_REQUIRED',
    stage:'OFFLINE_PLAN_ONLY',capability,effect:skill.effect,request_id:agentPlan.request_id,
    session_ref:agentPlan.session_ref,channel:agentPlan.channel,policy_version:agentPlan.policy_version,
    execute_tool:false,can_send:false,provider_sends:0,orders_written:0,hosted_reads:0,model_calls:0,
    next_gate:skill.effect==='READ_ONLY'?'TRUSTED_BACKEND_READ_WITH_FRESH_STORE_AUTH':'OWNER_APPROVED_TRANSACTION_GATE_AND_USER_CONFIRMATION'});
}
module.exports={SKILLS,prepareSkill};
