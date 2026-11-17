'use strict';
/**
 * G0.8 Real Provider Evidence × Inactive Commerce Core — no-send release gate.
 * Pure diagnostic: MUST NOT reuse a signed DEMO+SEND webhook as a no-send
 * Commerce acceptance. Does NOT ingest credentials, customer messages, PII,
 * production callback config, hosted database or real storefront data.
 */
const CONTRACT='T404_G08_LIVE_VS_NO_SEND_PROVENANCE_V1';
const OBS=[
 ['LEGACY_MESSENGER_DEMO_WEBHOOK','Z7FdV7uDvApfbURQ','4176','webhook'],
 ['CENTRAL_COMMERCE_CORE_UNBOUND_NEGATIVE','7XzLd51D7C6tlaS4','4381','manual'],
 ['G07_REAL_ADMISSION_REFUSAL_QA','mmt3ToandWrLAcjH','4401','manual']
];
const FLAGS=[
 'realProviderNoSendOwnerAuthorized','realMerchantStoreOwnershipAttested',
 'canonicalStoreRegistryVerified','durableReplayAcrossWorkersVerified',
 'realSignedNoSendCommerceUatPassed','realSameTenantStoreRlsJwtPassed',
 'currentIndependentRestoreAccepted','productionCallbackIsolationApproved'
];
const OBS_KEYS=['sourceKind','workflowId','executionId','status','mode',
 'realProviderEventObserved','signatureVerifiedFlag','providerSendNodeRan',
 'commerceStoreAuthorityVerified','syntheticTest','hostedWritesCheckedHere'];
const keys=(x)=>Object.keys(x).sort();
const exact=(x,k)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&
 JSON.stringify(keys(x))===JSON.stringify([...k].sort());
const denied=(blockers=[],diagnostic={})=>Object.freeze({
 contract:CONTRACT,status:'REAL_SIGNED_COMMERCE_NOSEND_ADMISSION_NO_GO',
 blockers:Object.freeze([...new Set(blockers)].sort()),
 diagnostic:Object.freeze({...diagnostic}),
 realNoSendCallbackObserved:false,
 independentlyVerifiedMerchantStoreBinding:false,
 metaProviderHmacClaimIsFromLegacyDemoOnly:true,
 sourceTestsNeverAuthorizeHostedRls:true,
 mayReuseDemoCallback:false,mayReadCommerceOrders:false,mayWriteCommerceOrders:false,
 maySendProviderReply:false,mayPublish:false,mayMigrate:false,
 mayChangeProductionCallback:false,mayAttachCredentials:false,mayBill:false
});
function inspect(s,now='2026-11-17T03:47:10Z'){
 const issues=new Set(),block=x=>issues.add(x);
 if(!exact(s,['contract','source','snapshotAtUtc','observations','current']))
  return denied(['INVALID_OR_EXTRA_SOURCE_FIELDS']);
 if(s.contract!==CONTRACT||s.source!=='N8N_CONNECTED_EXECUTION_METADATA_READ_ONLY')
  block('UNAUTHENTICATED_DATA_SOURCE');
 if(typeof s.snapshotAtUtc!=='string'||!s.snapshotAtUtc.endsWith('Z')||
  !Number.isFinite(Date.parse(s.snapshotAtUtc))||!Number.isFinite(Date.parse(now))||
  Date.parse(now)-Date.parse(s.snapshotAtUtc)>24*60*60*1000||
  Date.parse(s.snapshotAtUtc)>Date.parse(now)+60000)
  block('SOURCE_RECEIPT_STALE_OR_FUTURE');
 if(!Array.isArray(s.observations)||s.observations.length!==3)
  block('THREE_INDEPENDENT_EXECUTIONS_REQUIRED');
 const observed=Array.isArray(s.observations)?s.observations:[];
 for(let i=0;i<OBS.length;i++){
  const row=observed[i],expected=OBS[i];
  if(!exact(row,OBS_KEYS)){block('EXECUTION_RECORD_SCHEMA_DRIFT');continue;}
  if(row.sourceKind!==expected[0]||row.workflowId!==expected[1]||
     row.executionId!==expected[2]||row.mode!==expected[3]||row.status!=='success')
     block('WORKFLOW_EXECUTION_PROVENANCE_MISMATCH');
  const isDemo=i===0;
  if(row.realProviderEventObserved!==isDemo||
     row.signatureVerifiedFlag!==isDemo||
     row.providerSendNodeRan!==isDemo||
     row.syntheticTest===isDemo||
     row.commerceStoreAuthorityVerified!==false||
     row.hostedWritesCheckedHere!==false)
   block('SOURCE_EVENTS_DO_NOT_PROVE_REAL_NOSEND');
 }
 if(!exact(s.current,FLAGS)){block('RELEASE_GATE_FIELDS_INVALID');}
 else{
  for(const field of FLAGS){
   if(s.current[field]!==true)block('UNVERIFIED_'+field);
  }
 }
 // Even self-reported "all green" is a statement, not private primary source:
 // release authority requires an independent approved runtime control plane.
 if(!issues.size)block('ORIGINAL_PROVIDER_AND_STORE_AUTHORITY_NOT_REVIEWED_HERE');
 return denied([...issues],{
  legacySignedWebhookIsNotNoSend:true,
  centralCoreTestIsSyntheticOnly:true,
  g07AdmissionTestDeliberatelyDeniesRealTraffic:true,
  originalLiveSiteMessengerPreserved:true,
  requiredPrivateProofs:FLAGS.length
 });
}
module.exports=Object.freeze({CONTRACT,OBS,FLAGS,inspect});
if(require.main===module){
 try{
  const input=require('node:fs').readFileSync(0,'utf8');
  if(input.length>16000)throw Error('INCOMING_SOURCE_TOO_LONG');
  const out=inspect(JSON.parse(input),new Date().toISOString());
  console.log(JSON.stringify(out,null,2));
  process.exitCode=3; // Always NO GO, even all boolean flags are true.
 }catch(_e){
  process.stderr.write('G08_UNTRUSTED_INPUT_NO_GO\n');
  process.exitCode=2;
 }
}
