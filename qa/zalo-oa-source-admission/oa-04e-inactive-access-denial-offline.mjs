// TIEN404 V17.ZALO-SOURCE-04E — OFFLINE infrastructure & external-denial transcript gates.
// All inputs are simulated or read-only snapshots injected by tests. No HTTP calls,
// Cloudflare writes, Auth/JWT parsing, Zalo OAuth, outbound messages, Orders or Stock.
import {inspectActualCloudflareWorkerAccess} from './oa-04d-real-access-audit-offline.mjs';

const ID=/^[a-z][a-z0-9-]{8,80}$/;
const UUID=/^[a-f0-9]{32}$/i;
const nowValid=n=>Number.isSafeInteger(n)&&n>0;
const fail=reason=>Object.freeze({
  candidate:false,reason,realOwnerProved:false,edgeAccessProved:false,
  realCanaryExecuted:false,canCreateWorker:false,canDeploy:false,
  canReceiveZalo:false,canSend:false,canWriteOrders:false
});
const shape=stage=>Object.freeze({
  candidate:true,stage,realOwnerProved:false,edgeAccessProved:false,
  realCanaryExecuted:false,canCreateWorker:false,canDeploy:false,
  canReceiveZalo:false,canSend:false,canWriteOrders:false
});

/** Worker script account inventory, source-only. A Worker upload is not proof of
 * inactivity; REQUIRE explicit no-public subdomain, no preview, no routes/domains,
 * zero active deployments, and ONE exact Worker-level Access application.
 * A real metadata read + independent network probe is always still required.
 */
export function inspectInactiveDedicatedOaWorkerSnapshot({worker, routes, domains,accessApps,expected}={}){
  if(!expected||!ID.test(expected.scriptName??'')||
    !UUID.test(expected.workerId??'')||
    !expected.access||typeof expected.access!=='object'||
    !Array.isArray(routes)||!Array.isArray(domains)||!Array.isArray(accessApps))
    return fail('MISSING_TRUSTED_ISOLATED_WORKER_EXPECTATION');
  if(!worker||worker.scriptName!==expected.scriptName||worker.workerId!==expected.workerId)
    return fail('DEDICATED_WORKER_NOT_CREATED_OR_UNVERIFIED');
  if(worker.workersDevEnabled!==false||worker.previewUrlsEnabled!==false||
     worker.activeDeploymentCount!==0||worker.triggersEnabled!==false)
    return fail('WORKER_NOT_PROVEN_INACTIVE');
  if(routes.some(r=>r?.script===expected.scriptName||r?.worker_id===expected.workerId)||
     domains.some(d=>d?.service===expected.scriptName||d?.worker_id===expected.workerId))
    return fail('UNEXPECTED_PUBLIC_WORKER_ROUTE_OR_DOMAIN');
  const apps=accessApps.filter(app=>app?.destinations?.some(d=>
    ['worker','preview_worker'].includes(d?.type)&&d?.worker_id===expected.workerId));
  if(apps.length!==1)return fail('DEDICATED_ACCESS_APP_NOT_UNIQUELY_BOUND');
  const audit=inspectActualCloudflareWorkerAccess(apps[0],expected.access);
  if(audit.configurationCandidate!==true)
    return fail('ACCESS_API_POLICY_NOT_STRICTLY_PINNED');
  return shape('OFFLINE_INACTIVE_WORKER_AND_ACCESS_SNAPSHOT_CANDIDATE');
}

/** One independently witnessed set of EXTERNAL Access probes.
 * No transcript can prove hosted Access in software-only CI. Do not trust
 * a self-supplied 302, 403 or screenshot as an actual edge security proof.
 */
export function inspectExternalAccessNoSendTranscript(receipt,expected){
  if(!expected||typeof expected.teamAccessHost!=='string'||
    !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(expected.teamAccessHost)||
    typeof expected.aud!=='string'||expected.aud.length<16||
    !receipt||typeof receipt!=='object'||Array.isArray(receipt)||
    !nowValid(receipt.collectedAtMs)||!nowValid(expected.nowMs))
    return fail('MISSING_TRUSTED_EXTERNAL_UAT_CONTEXT');
  if(Math.abs(expected.nowMs-receipt.collectedAtMs)>5*60*1000)
    return fail('EXTERNAL_EVIDENCE_STALE_OR_FUTURE');
  const anon=receipt.anonymous,other=receipt.unauthorizedOperator,
        approved=receipt.approvedOperator,oauth=receipt.oauthPath,
        hook=receipt.webhookPath,write=receipt.approvalPost;
  if(!anon||![302,303].includes(anon.status)||anon.workerInvoked!==false||
    typeof anon.location!=='string')
    return fail('ANONYMOUS_EDGE_CHALLENGE_NOT_SHOWN');
  try{
    const u=new URL(anon.location);
    if(u.protocol!=='https:'||u.hostname!==expected.teamAccessHost||
       !u.pathname.startsWith('/cdn-cgi/access/'))
      return fail('ACCESS_CHALLENGE_ORIGIN_NOT_PINNED');
  }catch{return fail('INVALID_ACCESS_CHALLENGE_LOCATION');}
  if(!other||![302,303,401,403].includes(other.status)||
    other.workerInvoked!==false||other.authorizedToExecute===true)
    return fail('UNAUTHORIZED_OPERATOR_NOT_DENIED_AT_EDGE');
  if(!approved||approved.status!==200||approved.workerInvoked!==true||
    approved.accessAud!==expected.aud||approved.ctxAccessVerified!==true||
    !approved.body||approved.body.stage!=='SOURCE_04B_OPERATOR_ACCESS_CONFIRMED_ONLY'||
    approved.body.providerOwnershipVerified!==false||
    approved.body.signedProviderEventVerified!==false||
    approved.body.canReceiveProviderTraffic!==false||
    approved.body.canActivate!==false||
    approved.body.canSend!==false||approved.body.canWriteOrders!==false)
    return fail('AUTHORIZED_OPERATOR_NOT_RESTRICTED_TO_NO_SEND');
  for(const p of [oauth,hook]){
    if(!p||p.status!==404||p.workerInvoked!==true||
       p.body?.reason!=='PROVIDER_ENDPOINT_NOT_HOSTED_HERE')
      return fail('PROVIDER_ENDPOINT_EXPOSED_ON_OPERATOR_WORKER');
  }
  if(!write||write.status!==423||write.workerInvoked!==true||
     write.body?.canActivate!==false||write.body?.noSend!==true)
    return fail('APPROVAL_OR_WRITE_ENDPOINT_NOT_LOCKED');
  const ids=[anon,other,approved,oauth,hook,write].map(x=>x.correlationId);
  if(ids.some(x=>typeof x!=='string'||!/^QA-[A-Za-z0-9_-]{8,80}$/.test(x))||
     new Set(ids).size!==ids.length)
    return fail('INDEPENDENT_PROBE_RECEIPTS_MISSING');
  // A passing synthetic transcript is NOT external evidence. Only an
  // independently authenticated operator and authoritative edge logs can attest.
  return shape('SYNTHETIC_EXTERNAL_ACCESS_TRANSCRIPT_CANDIDATE_NOT_HOSTED_PROOF');
}

/** Missing readiness gates cannot be filled with checkboxes or ChatGPT approval.
 * This constant output is an explicit preflight and NOT an activation authority.
 */
export function ownerAndCostReleaseGate(_selfReportedProof){
  return Object.freeze({
    stage:'PRIVATE_REAL_OA_AND_WORKER_AUTHORIZATION_NOT_ADMITTED',
    required:[
      'REAL_ZALO_OA_ADMIN_OAUTH_CONSENT',
      'ONE_TIME_PKCE_CODE_EXCHANGE_AND_OA_PROFILE_READBACK',
      'TWO_DIFFERENT_PRIVATE_AUTHENTICATED_OWNER_AND_OPERATOR',
      'SAME_TENANT_TWO_STORE_SUPABASE_JWT_RLS_PROOF',
      'INACTIVE_WORKER_CREATED_WITH_EXPLICIT_COST_AND_OWNER_APPROVAL',
      'DEDICATED_CLOUDFLARE_ACCESS_WITHOUT_BYPASS',
      'INDEPENDENT_EXTERNAL_ANONYMOUS_DENIAL_AND_OPERATOR_LOGIN',
      'PRIVATE_MANAGED_TOKEN_VAULT_AND_PROVIDER_NATIVE_MAC_CANARY',
      'ZERO_PROVIDER_SEND_ZERO_COMMERCE_WRITE_AND_ROLLBACK'
    ],
    realOwnerProved:false,canCreateWorker:false,canDeploy:false,
    canReceiveZalo:false,canSend:false,canWriteOrders:false
  });
}
