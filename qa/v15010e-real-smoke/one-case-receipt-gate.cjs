'use strict';
/**
 * 10E — raw model/tool output is private: only sanitized evidence is acceptable.
 * This validator proves the supplied receipt has the expected *shape*.
 * It does NOT verify n8n's execution or Gateway's actual deducted credits.
 */
const VERIFIED_SCOPE=Object.freeze({
 workflowId:'PPJpr1bd9LxhOI6U',
 successfulExecutionId:'4025',failedFirstExecutionId:'4024',
 model:'gpt-5-nano',tool:'QA_Catalog_Read_Only',
 sku:'A002',quantity:2,unitPriceVnd:159000,totalVnd:318000,stock:25
});
const KEYS=['workflowId','executionId','status','model','tool',
 'shop','sku','quantity','unitPriceVnd','totalVnd','stock',
 'providerSends','hostedWrites','caseTag','source','gatewayCostUsd'];
function blocked(reason){return Object.freeze({status:'BLOCKED',reason,
 canRun132:false,canSend:false,canWriteHosted:false,
 benchmarkCasesCompleted:0,realCostVerified:false});}
function assessSmokeReceipt(r){
 if(!r||typeof r!=='object'||Array.isArray(r)||Object.getPrototypeOf(r)!==Object.prototype)
  return blocked('INVALID_RECEIPT');
 if(Object.keys(r).length!==KEYS.length||KEYS.some(k=>!Object.hasOwn(r,k))||
  Object.keys(r).some(k=>!KEYS.includes(k)))
  return blocked('RAW_OR_EXTRA_FIELDS_REJECTED');
 if(r.workflowId!==VERIFIED_SCOPE.workflowId||
  r.executionId!==VERIFIED_SCOPE.successfulExecutionId||
  r.status!=='success'||r.model!==VERIFIED_SCOPE.model||
  r.tool!==VERIFIED_SCOPE.tool||
  r.shop!=='QA_SHOP_A'||r.sku!=='A002'||r.quantity!==2||
  r.unitPriceVnd!==159000||r.totalVnd!==318000||r.stock!==25||
  r.providerSends!==0||r.hostedWrites!==0||
  r.caseTag!=='SMOKE_QA_A002_2_NOT_DATASET_CASE'||
  r.source!=='MANUAL_N8N_QA_WORKFLOW'||r.gatewayCostUsd!==null)
  return blocked('EXECUTION_OR_NO_SEND_SCOPE_MISMATCH');
 return Object.freeze({status:'SANITIZED_SMOKE_RECEIPT_SHAPE_READY_NOT_BENCHMARK',
  workflowId:r.workflowId,successfulExecutionId:r.executionId,
  toolObserved:r.tool,model:r.model,
  syntheticQuoteVnd:r.totalVnd,
  correctedAfterSchemaError:true,
  providerSends:0,hostedWrites:0,
  actualGatewayCostUsd:null,realCostVerified:false,
  independentRuntimeInspectionStillRequired:true,
  approvedOverallBudgetUsd:1,
  canRun132:false,benchmarkCasesCompleted:0,
  canSend:false,canWriteHosted:false});
}
module.exports={VERIFIED_SCOPE,KEYS,assessSmokeReceipt};
