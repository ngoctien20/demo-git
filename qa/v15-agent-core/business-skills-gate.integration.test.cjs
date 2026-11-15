'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {planAgent}=require('./universal-agent-core.cjs');
const {prepareSkill}=require('./business-skills-gate.cjs');
const trust={source:'TRUSTED_SERVER_IDENTITY',authorizedForStaging:true,tenantId:'QA-TENANT-A',storeId:'QA-STORE-A',channel:'messenger',conversationId:'QA-CONV-A',actorRole:'customer',policyVersion:'OFFLINE-V1',botProfileVersion:'V14.7',sendEnabled:false,capabilities:['catalog_read','price_quote','order_draft','support_draft']};
const decide=async(msg,opts={})=>{
 const t={...trust,...opts};const p=await planAgent({request_id:'qa_integration_001',message:msg},{resolveTrusted:async()=>t});
 const proof=({requestId,sessionRef,channel,actorRole,capability,policyVersion})=>({origin:'BACKEND_OFFLINE_AUTHORIZATION',authorizedForStaging:true,requestId,sessionRef,channel,actorRole,capability,policyVersion,subscriptionActive:true,revoked:false,canSend:false,canWriteOrders:false});
 return {p,result:await prepareSkill(p,{reauthorize:async args=>proof(args)})};
};
test('V15 quote plan integrates with independent no-send skill gate',async()=>{const {p,result:r}=await decide('Mã A002 giá bao nhiêu?');assert.equal(p.intent,'PRICE_QUOTE');assert.equal(r.status,'READ_ONLY_ADAPTER_REQUIRED');assert.equal(r.execute_tool,false)});
test('V15 order draft integrates with confirm-required gate',async()=>{const {result:r}=await decide('Tôi mua A002 2 cái');assert.equal(r.status,'CONFIRMATION_REQUIRED');assert.equal(r.orders_written,0)});
test('V15 support request stays draft',async()=>{const {result:r}=await decide('Mình muốn khiếu nại A002');assert.equal(r.status,'CONFIRMATION_REQUIRED');assert.equal(r.can_send,false)});
test('V15 owner report customer denied at core and skill boundaries',async()=>{const {p,result:r}=await decide('Báo cáo doanh thu');assert.equal(p.status,'BLOCKED');assert.equal(r.status,'BLOCKED')});
test('V15 greeting routes deterministic zero-tool',async()=>{const {p,result:r}=await decide('Xin chào');assert.equal(p.tool,null);assert.equal(r.status,'NO_TOOL_REQUIRED')});
test('V15 multi-channel quotes use same core contract, channel scoped',async()=>{for(const ch of ['messenger','zalo_bot','zalo_oa','web_widget']){const {result:r}=await decide('Giá A002', {channel:ch});assert.equal(r.status,'READ_ONLY_ADAPTER_REQUIRED');assert.equal(r.channel,ch);assert.equal(r.provider_sends,0)}});
test('V15 injected client store ID fails closed upstream',async()=>{const p=await planAgent({request_id:'qa_integr_002',message:'giá A002',store_id:'QA-STORE-B'},{resolveTrusted:async()=>trust});assert.equal(p.status,'BLOCKED');assert.equal((await prepareSkill(p,{reauthorize:async()=>({})})).status,'BLOCKED')});
test('V15 backend permission revoked between planning and execution denied',async()=>{const p=await planAgent({request_id:'qa_integr_003',message:'giá A002'},{resolveTrusted:async()=>trust});const r=await prepareSkill(p,{reauthorize:async args=>({origin:'BACKEND_OFFLINE_AUTHORIZATION',authorizedForStaging:true,requestId:args.requestId,sessionRef:args.sessionRef,channel:args.channel,actorRole:args.actorRole,capability:args.capability,policyVersion:args.policyVersion,subscriptionActive:true,revoked:true,canSend:false,canWriteOrders:false})});assert.equal(r.status,'BLOCKED')});
