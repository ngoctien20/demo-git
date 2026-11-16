/**
 * TIEN404 V15-SECLOAD-02 — read-only evidence triage
 * This does not call Supabase, Meta, n8n or any network endpoint.
 * It can only analyze sanitized, already witnessed source evidence.
 * A forged green report never becomes a live authorization.
 */
const EXPECTED_WORKFLOW='ZHJmhlRwAiNEtujb';
const EXPECTED_PUBLISHED='d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92';
const EXPECTED_IDS=Object.freeze(['4200','4201','4202','4203']);
const DENY=Object.freeze({
 hostedMultiStoreReleased:false,
 executePrivilegedRpcs:false,
 modifyRls:false,
 productionLoadCertified:false,
 authorizedProviderSends:0,
 publishWorkflow:false,
 actualParallelExecutionCapacityVerified:false
});
const compact=x=>x&&typeof x==='object'&&!Array.isArray(x);
const fails=reason=>Object.freeze({verdict:'NO_GO',reasons:[reason],...DENY});
export function concurrentExecutionMax(runs){
 if(!Array.isArray(runs)||runs.length===0)return 0;
 const events=[];
 for(const r of runs){
  const start=Date.parse(r.startedAt||''),end=Date.parse(r.stoppedAt||'');
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('INVALID_EXECUTION_INTERVAL');
  // Ends sort before new starts at exactly same time -> no overlap.
  events.push({t:start,n:1},{t:end,n:-1});
 }
 events.sort((a,b)=>a.t-b.t||a.n-b.n);
 let active=0,max=0;
 for(const e of events){active+=e.n;max=Math.max(max,active)}
 return max;
}
export function reviewSecLoad02(hosted,manual){
 if(!compact(hosted)||!compact(manual))return fails('INVALID_EVIDENCE');
 const risks=[],positive=[];
 if(hosted.contract!=='T404_V15_SECLOAD02_HOSTED_RLS_PRIVRPC_EVIDENCE_V1'||
   manual.contract!=='T404_V15_SECLOAD02_ACTUAL_N8N_MANUAL_QA_V1')
   return fails('UNKNOWN_CONTRACT');
 if(hosted.canonicalStoreTablesPresent===false &&
  hosted.storeMembershipsPresent===false&&
  hosted.publicCommerceStoreColumnsPresent===false&&
  hosted.publicStoreScopedPoliciesPresent===false)
  risks.push('P0_HOSTED_STORE_AUTHORITY_UNAVAILABLE');
 else return fails('LIVE_STORE_AUTHORITY_CHANGED_NEEDS_REAUDIT');
 if(hosted.publicTablesRlsEnabledCount===20&&hosted.publicTablesCheckedCount===20&&
   hosted.publicTablesWithRlsOffAndAnonSelect===0)
  positive.push('PUBLIC_SCHEMA_RLS_CONFIGURATION_ON');
 else return fails('PUBLIC_RLS_CONFIGURATION_CHANGED');
 if(!Array.isArray(hosted.policies)||hosted.policies.length!==8||
   hosted.policies.some(p=>p.storeIdPolicyCount!==0||p.rls!==true||p.policyCount!==1))
  return fails('POLICY_BASELINE_CHANGED');
 const rpc=hosted.rpc||[];
 if(!Array.isArray(rpc)||rpc.length!==3||rpc.some(r=>
  r.securityDefiner!==true||r.owner!=='postgres'||r.setsSearchPath!==true||
  !/^[0-9a-f]{64}$/.test(r.codeSha256||'')))
  return fails('RPC_DEFINITION_UNVERIFIED_OR_CHANGED');
 const zalo=rpc.find(r=>r.name==='qa_shop_b_zalo_claim');
 const owner=rpc.find(r=>r.name==='qa_owner_pairing');
 const product=rpc.find(r=>r.name==='save_merchant_product');
 if(!zalo?.anonCallable||!zalo.validatesHeaderSecret||
    !zalo.usesVaultSecret||!zalo.usesHmacSenderEvent)
  return fails('ZALO_RPC_GUARD_CHANGED_OR_UNVERIFIED');
 positive.push('ZALO_HEADER_VAULT_HMAC_GUARD_SOURCE_OBSERVED');
 risks.push('P1_ANON_SECURITY_DEFINER_EXTERNAL_HEADER_SECURITY_REVIEW');
 if(!owner?.authenticatedCallable||!owner.usesAuthUid||
   !owner.checksActiveTenantMembership||!owner.checksChallengeExpiryAndAttemptLimit)
  return fails('OWNER_PAIRING_SCOPE_CHANGED');
 positive.push('OWNER_AUTH_UID_AND_CHALLENGE_GUARDS_SOURCE_OBSERVED');
 if(!product?.authenticatedCallable||!product.usesAuthUid||
   !product.writesProductsUsingTenantId||product.writesProductsUsingStoreId!==false)
  return fails('PRODUCT_RPC_SCOPE_CHANGED');
 risks.push('P0_PRODUCT_WRITES_LACK_STORE_SCOPING');
 if(!hosted.hostedSchemaChangePerformed&&!hosted.rpcInvoked&&!hosted.customerRowsRead)
  positive.push('HOSTED_READ_ONLY');
 else return fails('NON_READONLY_HOSTED_AUDIT');
 if(manual.workflowId!==EXPECTED_WORKFLOW||
   manual.active!==false||manual.publishedVersion!==null||
   manual.nodeCount!==2||manual.credentialNodes!==0||
   manual.webhookNodes!==0||manual.externalProviderNodes!==0||
   manual.merchantBusinessToolNodes!==0||
   !Array.isArray(manual.executions)||manual.executions.length!==4)
  return fails('QA_MANUAL_WORKFLOW_CHANGED');
 if(manual.executions.some((e,i)=>
    e.id!==EXPECTED_IDS[i]||e.status!=='success'||
    e.outputPass!==true||e.realProviderSends!==0||
    e.ordersWritten!==0||e.paidModelCalls!==0||e.productionWebhookLoad!==0))
   return fails('QA_EVIDENCE_FAILED');
 let actual;
 try{actual=concurrentExecutionMax(manual.executions)}catch{return fails('INVALID_EXECUTION_INTERVAL')}
 if(actual!==1||manual.actualVerifiedSimultaneouslyRunningExecutions!==1||
    manual.actualObservedPairwiseExecutionOverlaps!==0||
    manual.cloudConcurrencyLimitCertified!==false||
    manual.stagingConcurrentLoadCertified!==false)
   return fails('PARALLEL_LOAD_NOT_PROVEN');
 positive.push('FOUR_N8N_INACTIVE_MANUAL_EXECUTIONS_PASSED');
 risks.push('P1_NO_OVERLAPPING_EXECUTIONS_BOUNDED_TEST_INCONCLUSIVE');
 return Object.freeze({
  verdict:'NO_GO',
  sourceAuditStatus:'VERIFIED_METADATA_ONLY',
  stagingManualSmokeStatus:'4_OF_4_PASS_NO_CONCURRENCY',
  exactManualExecutionIds:EXPECTED_IDS,
  actualSimultaneouslyRunning:maxOrZero(actual),
  observedN8NRunDurationsMs:manual.executions.map(e=>e.durationMs),
  risks:Object.freeze(risks),
  positives:Object.freeze(positive),
  requiresPrivateOperatorApproval:[
   'STORE_LEVEL_RLS_AND_COMPOSITE_OWNERSHIP_MIGRATION',
   'INDEPENDENT_SECURITY_DEFINER_CODE_AND_NATIVE_ROLE_NEGATIVE_TESTS',
   'ISOLATED_REAL_CONCURRENT_STAGING_DRIVER_WITH_QUOTA_AND_STOP_RULE',
   'PRIVATE_N8N_FULL_BACKUP_AND_ROLLBACK',
   'EXPLICIT_PRODUCTION_CUTOVER'
  ],
  ...DENY
 });
}
function maxOrZero(x){return Number.isInteger(x)?x:0}
