'use strict';
/**
 * TIEN404 V17.6-B.2 — deterministic Commerce Catalog READ-PLAN guard.
 *
 * SECURITY BOUNDARY: imports the actual (source-only) V17.6-B.1 adapter,
 * which imports the unmodified V17.1L authorization policy.
 * No model, HTTP, database, provider, filesystem write, or live JWT call.
 * This does not authenticate a Supabase user. It never authorizes a read.
 *
 * Policy choice: ONLY an exact SKU proposed by a model is admissible.
 * Arbitrary free-text search remains DENIED until a separate server-owned
 * query normalization/search contract is approved and tested.
 */
const {MODE: ADAPTER_MODE} = require('../v176b1-core-admission/independent-core-adapter.cjs');
const CONTRACT='T404_V176B2_TRUSTED_CATALOG_SKU_READ_PLAN_V1';
const SKU=/^[A-Z0-9]{2,32}(?:[-_][A-Z0-9]{1,24})*$/;
const MAX_SKU=64;
function fail(code) {
  const error=new Error(code);
  error.code=code;
  throw error;
}
function plainValueObject(v) {
  if(v===null||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype) return false;
  if(Reflect.ownKeys(v).some(k=>typeof k!=='string')) return false;
  const descriptors=Object.getOwnPropertyDescriptors(v);
  return Object.values(descriptors).every(d=>Object.hasOwn(d,'value')&&!Object.hasOwn(d,'get')&&!Object.hasOwn(d,'set'));
}
function exactKeys(v,allowed){
  return plainValueObject(v)&&Object.keys(v).length===allowed.length&&
    allowed.every(k=>Object.hasOwn(v,k));
}
function createTrustedCatalogReadPlan({canary,clock}={}){
  if(!canary||canary.MODE!==ADAPTER_MODE||
    typeof canary.authorize!=='function'||typeof canary.receipt!=='function'||
    typeof clock!=='function')fail('TRUSTED_QA_POLICY_AND_SERVER_CLOCK_REQUIRED');
  function compile({session,proposal}={}){
    if(!exactKeys(proposal,['action','sku'])||proposal.action!=='READ_PUBLIC_CATALOG')
      fail('MODEL_FREE_TEXT_OR_EXTRA_FIELDS_DENIED');
    const sku=proposal.sku;
    if(typeof sku!=='string'||sku.length>MAX_SKU||!SKU.test(sku))
      fail('SKU_EXACT_ASCII_FORMAT_REQUIRED');
    const nowMs=clock();
    if(!Number.isSafeInteger(nowMs)||nowMs<=0)fail('SERVER_TIME_REQUIRED');
    // No free-text/query, metadata, customer IDs, SQL, URL, role, or Store
    // claim can be forwarded to the existing source policy.
    const result=canary.authorize(session,'READ_PUBLIC_CATALOG',
      Object.freeze({sku}), 'MODEL_PROPOSAL',nowMs);
    if(!result||result.decision!=='SOURCE_ONLY_READ_PLAN'||
      result.tool!=='READ_PUBLIC_CATALOG'||result.actualDatabaseReads!==0||
      result.actualProviderSends!==0||
      typeof result.tenantId!=='string'||typeof result.storeId!=='string')
      fail('SOURCE_POLICY_DID_NOT_GRANT_SCOPED_READ_PLAN');
    const before=canary.receipt();
    for(const k of ['networkCalls','providerSends','modelCalls','hostedDbReads',
      'hostedDbWrites','orderWrites','stockWrites']) {
      if(before[k]!==0)fail('UNEXPECTED_QA_EFFECT_DETECTED');
    }
    if(before.productionRelease!=='NO_GO'||before.syntheticOnly!==true||
      before.realJWT!==false||before.realNativeProviderProof!==false||
      before.hostedRLS!==false)fail('HOSTED_ADMISSION_MUST_REMAIN_NO_GO');
    return Object.freeze({
      contract:CONTRACT,
      decision:'SOURCE_ONLY_READ_PLAN',
      target:Object.freeze({tenantId:result.tenantId,storeId:result.storeId,
        sku,operation:'CATALOG_SKU_LOOKUP'}),
      data:null,actualDatabaseReads:0,actualWrites:0,actualProviderSends:0,
      actualModelCalls:0,executeAllowed:false,hostedJwtVerified:false,
      hostedStoreRlsVerified:false,productionRelease:'NO_GO'
    });
  }
  return Object.freeze({CONTRACT,compile});
}
module.exports=Object.freeze({CONTRACT,createTrustedCatalogReadPlan});
