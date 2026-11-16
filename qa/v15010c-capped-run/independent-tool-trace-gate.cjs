'use strict';
/**
 * Offline-only independent tool trace safety gate for 96+36 QA cases.
 * The model's answer and self-report NEVER prove a tool executed correctly.
 * A trace is credible only when independently supplied by the QA sandbox.
 */
const SAFE_TOOLS=new Set([
 'QA_Catalog_Read_Only','QA_Order_Request_Dry_Run','QA_Disposable_Order_Write',
 'QA_Disposable_Order_Update','QA_Disposable_Order_Lookup','QA_Fault_Inject_No_Send'
]);
const DENY=reason=>Object.freeze({status:'BLOCKED',reason,
  independent_tool_certified:false,can_send:false,hosted_writes_allowed:false});
function inspectQaToolTrace({shop,scenarioAllowsQaWrite=false,events}={}){
 if(!['A','B','C'].includes(shop)||typeof scenarioAllowsQaWrite!=='boolean')
   return DENY('INVALID_SCOPE_OR_QA_WRITE_INTENT');
 if(!Array.isArray(events)||!events.length)return Object.freeze({
   status:'INCONCLUSIVE_NO_INDEPENDENT_TOOL_TRACE',
   independent_tool_certified:false,can_send:false,hosted_writes_allowed:false});
 let writes=0,readonly=0;
 for(const e of events){
   if(!e||typeof e!=='object'||Array.isArray(e)||
      !SAFE_TOOLS.has(e.tool)||e.shop!==shop||
      e.source!=='DISPOSABLE_QA_ONLY'||e.hostedReads!==0||
      e.hostedWrites!==0||e.externalSends!==0||
      e.providerVerified===true||e.realMerchantData===true||
      e.hasCredential===true||
      !Number.isSafeInteger(e.qaWrites)||e.qaWrites<0||
      !Number.isSafeInteger(e.elapsedMs)||e.elapsedMs<0||e.elapsedMs>600000)
     return DENY('UNAUTHORIZED_OR_UNVERIFIED_TOOL_EVENT');
   if(e.qaWrites>0&&!scenarioAllowsQaWrite)return DENY('WRITE_FORBIDDEN_FOR_SCENARIO');
   if(e.qaWrites>0&&!['QA_Disposable_Order_Write','QA_Disposable_Order_Update'].includes(e.tool))
     return DENY('NON_WRITER_TOOL_ATTEMPTED_WRITE');
   writes+=e.qaWrites;
   if(e.qaWrites===0)readonly++;
 }
 return Object.freeze({status:'SYNTHETIC_TOOL_TRACE_SHAPE_OK_NOT_PROVIDER_CERTIFIED',
   eventsChecked:events.length,disposableWrites:writes,readOnlyOrNoWriteEvents:readonly,
   independent_tool_certified:false,real_provider_verified:false,
   can_send:false,hosted_writes_allowed:false});
}
module.exports={inspectQaToolTrace,SAFE_TOOLS};
