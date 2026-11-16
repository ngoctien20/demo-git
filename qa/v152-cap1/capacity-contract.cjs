'use strict';
// Source-only contract: this file never talks to providers or hosted services.
const STORES=Object.freeze({A:'tenant_synthetic_A',B:'tenant_synthetic_B',C:'tenant_synthetic_C'});
const LEVELS=Object.freeze([1,5,10,25,50]);
const RATE_LEVELS=Object.freeze([1,10,30,60]);
function authorizeSynthetic(input) {
  if (!input || STORES[input.store_id]!==input.tenant_id) return {http_status:403,error_class:'CROSS_STORE_DENIED'};
  if (['create_order','update_order','change_price','admin_export'].includes(input.intent)) return {http_status:409,error_class:'WRITE_DISABLED_NO_SEND'};
  return {http_status:200,error_class:null};
}
function deliveryEvidence(source) {
  return {provider_mock_accepted:source==='MOCK',provider_delivery_verified:false,
    customer_reply_e2e_ms:null,model_input_tokens:null,model_output_tokens:null,ai_cost_actual:null};
}
function qualityDisposition({actual_output,full_execution_linked=false}) {
  if (!actual_output || !actual_output.trim()) return 'NOT_RUN';
  if (!full_execution_linked) return 'BLOCKED';
  return 'BLOCKED'; // require independently reviewed content+tool assertions to award PASS/FAIL
}
module.exports={STORES,LEVELS,RATE_LEVELS,authorizeSynthetic,deliveryEvidence,qualityDisposition};
