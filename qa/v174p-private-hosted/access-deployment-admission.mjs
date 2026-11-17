/**
 * Read-only Cloudflare Access deployment admission comparator (NO RESOURCE WRITES).
 * Operator supplies sanitized live Cloudflare API evidence, not browser-provided flags.
 * A PASS here is never approval to create/modify Access policies or deploy a Worker.
 */
export const ACCESS_ADMISSION_CONTRACT='T404_V174P_HOSTED1_ACCESS_ADMISSION_READ_ONLY_V1';
export const EXPECTED_QA_WORKER='tien404-v174p-private-qa-issuer';
const EXPECTED_SECRETS=Object.freeze(['V174P_SESSION_HMAC_KEY','V174P_ACCESS_JWKS_JSON']);
const deniedHost=host=>host==='ngoctien20.io.vn'||host.endsWith('.pages.dev')||
 host.endsWith('.invalid')||host==='localhost'||host==='127.0.0.1';
function originOf(raw){
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.port||
     u.pathname!=='/'||u.search||u.hash||deniedHost(u.hostname))return null;
  return u.origin;
 }catch{return null;}
}
const safeArray=x=>Array.isArray(x)?x:[];
const isExplicitOperatorRule=v=>v&&typeof v==='object'&&
 (typeof v.email?.email==='string'&&v.email.email.includes('@')||
  typeof v.group?.id==='string'&&v.group.id.length>6);
export function assessAccessDeployment(snapshot={},review={}){
 snapshot=snapshot&&typeof snapshot==='object'&&!Array.isArray(snapshot)?snapshot:{};
 review=review&&typeof review==='object'&&!Array.isArray(review)?review:{};
 const missing=[],checks=[];
 function check(id,ok){
  checks.push({id,verified:ok===true});
  if(ok!==true)missing.push(id);
 }
 const origin=originOf(review.approvedQaOrigin);
 check('approved_dedicated_https_origin',!!origin);
 const worker=safeArray(snapshot.workers).find(w=>w?.name===EXPECTED_QA_WORKER);
 check('dedicated_worker_isolated_and_present',!!worker&&typeof worker.id==='string'&&/^[a-f0-9]{32}$/i.test(worker.id));
 const apps=safeArray(snapshot.accessApps);
 const matches=apps.filter(a=>a?.type==='self_hosted'&&
  a?.destinations?.some(d=>d?.type==='worker'&&d?.worker_id===worker?.id));
 check('dedicated_worker_bound_access_app',matches.length===1);
 const app=matches.length===1?matches[0]:null;
 const appAud=app?.aud;
 check('strict_access_audience',typeof appAud==='string'&&appAud.length>=10&&
       appAud===review.approvedAccessAudience);
 check('no_legacy_pages_or_host_wildcard_claim',!!origin&&!!app&&
  (app.domain===undefined||app.domain===null||app.domain===new URL(origin).hostname)&&
  !String(app.domain||'').includes('*'));
 // The live /access/apps response includes 'policies', while
 // /access/policies lists separately authorized reusable policies.
 // Both must corroborate an exact policy ID before the decision is trusted.
 const policies=safeArray(snapshot.accessPolicies);
 const embedded=safeArray(app?.policies);
 const refs=[...new Set([...safeArray(app?.policy_ids),...embedded.map(p=>p?.id).filter(Boolean)])];
 const assigned=refs.map(id=>{
  const direct=embedded.find(p=>p?.id===id);
  const reusable=policies.find(p=>p?.id===id);
  if(!direct||!reusable||direct.decision!==reusable.decision)return null;
  return {...reusable,include:direct.include,reusable:reusable.reusable===true&&direct.reusable===true};
 });
 check('assigned_reusable_allow_policy',refs.length>0&&refs.length===assigned.length&&
  assigned.every(Boolean)&&assigned.some(p=>p.decision==='allow'&&p.reusable===true));
 check('no_bypass_service_auth_or_everyone',refs.length>0&&assigned.every(p=>p&&
    p.decision==='allow'&&safeArray(p.include).length>0&&
    safeArray(p.include).every(isExplicitOperatorRule)));
 check('approved_operators_private_only',review.operatorsIndependentlyReviewed===true);
 check('workers_dev_and_preview_paths_protected',review.workerAndPreviewEdgeProtected===true);
 check('negative_unauthenticated_edge_test',review.unauthenticatedEdgeDenied===true);
 check('revoked_operator_negative_test',review.revokedOperatorDenied===true);
 const bindingNames=safeArray(worker?.secretBindingNames);
 check('managed_secret_bindings_present',EXPECTED_SECRETS.every(k=>bindingNames.includes(k)));
 check('sqlite_do_binding_present',safeArray(worker?.durableObjectBindings)
  .some(d=>d?.name==='V174P_REPLAY_DO'&&d?.class_name==='V174PReplayGuard'&&d?.sqlite===true));
 check('hosted_atomic_replay_conflict_test',review.hostedAtomicReplayPassed===true);
 check('hosted_rate_limit_429_test',review.hostedRate429Passed===true);
 check('hosted_alarm_ttl_reclamation_test',review.hostedAlarmTtlPassed===true);
 check('qa_cost_scope_approved',review.costScopeWrittenApproval===true);
 check('operator_signed_rollback_test',review.rollbackEvidenceReviewed===true);
 check('private_external_browser_canary_passed',review.externalBrowserCanaryPassed===true);
 return Object.freeze({contract:ACCESS_ADMISSION_CONTRACT,
  worker:EXPECTED_QA_WORKER,origin:origin||null,
  status:missing.length?'BLOCKED':'EVIDENCE_COMPLETE_REQUIRES_INDEPENDENT_APPROVAL',
  missing,checks,cloudflare_resource_changed:false,
  access_policy_changed:false,hosted_browser_executed_by_this_check:false,
  deploy_authorized:false,real_commerce_authorized:false});
}
