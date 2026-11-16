'use strict';
/**
 * V15.0-10C — FINITE BUDGET PRE-FLIGHT AND DISPOSABLE REHEARSAL ONLY.
 * The module contains NO model client, credential, network, or execution call.
 * A real benchmark runner MUST independently verify its operator, API model,
 * actual Gateway pricing, exact tenant-safe QA tools and its approved USD cap.
 */
const PRICE_USD_PER_M=Object.freeze({
  'gpt-5-nano':Object.freeze({input:0.05,cachedInput:0.005,output:0.40,deprecated:true}),
  'gpt-6-luna':Object.freeze({input:0.10,cachedInput:0.01,output:0.50,deprecated:false})
});
const deny=reason=>Object.freeze({status:'BLOCKED',reason,
  can_call_provider:false,can_write_hosted:false,can_send:false,authorized_spend_usd:0});
const cents8=n=>Math.ceil((n-1e-14)*1e8)/1e8;

class CappedOfflineBudgetLedger{
  #config;#spent=0;#reserved=0;#requests=0;#seen=new Map();#halt=null;
  constructor(config={}){
    // Never turn textual "I approve a budget" into an invented numerical limit.
    if(!config||typeof config!=='object'||Array.isArray(config))
      throw Error('EXPLICIT_NUMERIC_BUDGET_REQUIRED');
    const {model,budgetUsd,maxModelRequests,maxInputTokens,maxOutputTokens,
      gatewayMultiplier,readOnlyEnvironment,simulationOnly}=config;
    if(!Object.hasOwn(PRICE_USD_PER_M,model)||
       typeof budgetUsd!=='number'||!Number.isFinite(budgetUsd)||budgetUsd<=0||
       !Number.isSafeInteger(maxModelRequests)||maxModelRequests<1||maxModelRequests>2000||
       !Number.isSafeInteger(maxInputTokens)||maxInputTokens<1||maxInputTokens>200000||
       !Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>10000||
       typeof gatewayMultiplier!=='number'||!Number.isFinite(gatewayMultiplier)||
       gatewayMultiplier<1||gatewayMultiplier>10||
       readOnlyEnvironment!=='DISPOSABLE_QA_ONLY'||simulationOnly!==true)
      throw Error('UNAPPROVED_OR_UNBOUNDED_BUDGET_CONFIGURATION');
    this.#config=Object.freeze({...config});
  }
  #bound(){
    const p=PRICE_USD_PER_M[this.#config.model],c=this.#config;
    // All inputs treated at *uncached* rate for conservative reserve.
    return cents8(((c.maxInputTokens*p.input+c.maxOutputTokens*p.output)
      /1e6)*c.gatewayMultiplier);
  }
  reserve(requestRef,{declaredInputTokens}={}){
    if(this.#halt)return deny('HALTED_'+this.#halt);
    if(typeof requestRef!=='string'||!/^[a-zA-Z0-9:_-]{6,128}$/.test(requestRef))
      return deny('BAD_REQUEST_REFERENCE');
    if(this.#seen.has(requestRef))return deny('DUPLICATE_REQUEST_REF');
    if(!Number.isSafeInteger(declaredInputTokens)||
       declaredInputTokens<0||declaredInputTokens>this.#config.maxInputTokens)
      return deny('UNVERIFIED_OR_OVERSIZED_INPUT');
    if(this.#requests>=this.#config.maxModelRequests)return deny('REQUEST_LIMIT_REACHED');
    const amount=this.#bound();
    if(this.#spent+this.#reserved+amount>this.#config.budgetUsd+1e-10)
      return deny('INSUFFICIENT_REMAINING_BUDGET');
    this.#reserved=cents8(this.#reserved+amount);
    this.#requests++;
    this.#seen.set(requestRef,{reserved:amount,state:'RESERVED'});
    return Object.freeze({status:'OFFLINE_RESERVATION_ONLY',ref:requestRef,
      upperBoundUsd:amount,model:this.#config.model,can_call_provider:false,
      can_send:false,can_write_hosted:false});
  }
  settle(requestRef,{inputTokens,outputTokens,cachedTokens=0}={}){
    if(!this.#seen.has(requestRef))return deny('UNKNOWN_REQUEST');
    const r=this.#seen.get(requestRef);
    if(r.state!=='RESERVED')return deny('ALREADY_SETTLED');
    const c=this.#config;
    if(!Number.isSafeInteger(inputTokens)||inputTokens<0||
       inputTokens>c.maxInputTokens||!Number.isSafeInteger(outputTokens)||
       outputTokens<0||outputTokens>c.maxOutputTokens||
       !Number.isSafeInteger(cachedTokens)||cachedTokens<0||cachedTokens>inputTokens){
      this.#halt='INVALID_USAGE_EVIDENCE';
      return deny('INVALID_USAGE_EVIDENCE');
    }
    const p=PRICE_USD_PER_M[c.model],
      observed=cents8(((inputTokens-cachedTokens)*p.input+
         cachedTokens*p.cachedInput+outputTokens*p.output)*c.gatewayMultiplier/1e6);
    if(observed>r.reserved+1e-10){
      this.#halt='OBSERVED_COST_EXCEEDED_RESERVE';
      return deny('OBSERVED_COST_EXCEEDED_RESERVE');
    }
    this.#reserved=cents8(Math.max(0,this.#reserved-r.reserved));
    this.#spent=cents8(this.#spent+observed);
    this.#seen.set(requestRef,{state:'SETTLED',reserved:r.reserved,observed});
    return Object.freeze({status:'SIMULATED_SETTLED_NOT_BILLED',estimatedCostUsd:observed,
      actualInvoiceUsd:null,can_call_provider:false,can_write_hosted:false});
  }
  abort(reason){
    this.#halt=String(reason||'OPERATOR_ABORT').slice(0,80);
    return this.inspect();
  }
  inspect(){
    return Object.freeze({status:this.#halt?'HALTED':'DISPOSABLE_QA_LEDGER_ONLY',
      budgetNumericalUsd:this.#config.budgetUsd,model:this.#config.model,
      maxModelRequests:this.#config.maxModelRequests,
      requestsReserved:this.#requests,
      estimatedSpentUsd:this.#spent,estimatedOutstandingReservedUsd:this.#reserved,
      remainingUncommittedUsd:cents8(Math.max(0,this.#config.budgetUsd-this.#spent-this.#reserved)),
      assumedGatewayMultiplier:this.#config.gatewayMultiplier,
      hardRealBillingCapCertified:false,realGatewayBalanceVerified:false,
      actualBilledUsd:null,can_call_provider:false,can_send:false,can_write_hosted:false,
      haltedReason:this.#halt});
  }
}
function budgetGate(config){
  try{
    const l=new CappedOfflineBudgetLedger(config);return Object.freeze({
      status:'SIMULATED_CAP_REHEARSAL_READY_NOT_APPROVED',
      capUsd:l.inspect().budgetNumericalUsd,
      can_call_provider:false,can_write_hosted:false,can_send:false,
      real_budget_operator_approval_verified:false});
  }catch{return deny('EXPLICIT_NUMERIC_CAP_AND_TRUSTED_OPERATOR_REQUIRED')}
}
module.exports={CappedOfflineBudgetLedger,budgetGate,PRICE_USD_PER_M};
