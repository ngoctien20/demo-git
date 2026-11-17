// TIEN404 V17.ZALO-SOURCE-04D — Cloudflare READ-ONLY API-shaped Access audit.
// This module never calls Cloudflare, never changes Access, never deploys a Worker.
// Input is an already obtained trusted inventory; spoofed input CANNOT grant access.
const reject=reason=>Object.freeze({configurationCandidate:false,reason,
  accessAdmissionProved:false,ownerConsentProved:false,
  canDeploy:false,canHandleProviderTraffic:false,canSend:false,canWriteOrders:false});
const candidate=()=>Object.freeze({configurationCandidate:true,
  reason:'API_SHAPE_CANDIDATE_NEEDS_INDEPENDENT_EXTERNAL_DENY_AND_LOGIN_TEST',
  accessAdmissionProved:false,ownerConsentProved:false,
  canDeploy:false,canHandleProviderTraffic:false,canSend:false,canWriteOrders:false});
const normal=s=>typeof s==='string'?s.trim().toLowerCase():null;
const EMAIL=/^[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9.-]+\.[a-z]{2,24}$/;
const exact=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every(x=>b.includes(x));
const maxSessionMs=s=>{
  if(typeof s!=='string')return Number.NaN;
  const m=/^(\d+)(m|h)$/.exec(s);
  return m?Number(m[1])*(m[2]==='m'?60000:3600000):Number.NaN;
};
/** strict worker-level Access inventory check, based on real Cloudflare API response shape.
 * Expected fields must come from approved PRIVATE inventory (not client arguments).
 * A one-email/one-worker matching configuration is only a candidate, never proof
 * of enforced edge Access. External unauthenticated and owner-only tests are required.
 */
export function inspectActualCloudflareWorkerAccess(app,expected){
  if(!app||typeof app!=='object'||Array.isArray(app)||
     !expected||typeof expected!=='object'||
     !expected.workerId||typeof expected.workerId!=='string'||
     !expected.accessName||typeof expected.accessName!=='string'||
     !expected.aud||typeof expected.aud!=='string'||expected.aud.length<16||
     !Array.isArray(expected.exactOperatorEmails)||expected.exactOperatorEmails.length<1)
    return reject('TRUSTED_CONFIGURATION_EXPECTATION_MISSING');
  const allow=expected.exactOperatorEmails.map(normal);
  if(allow.some(x=>!x||!EMAIL.test(x))||new Set(allow).size!==allow.length)
    return reject('INVALID_TRUSTED_OPERATOR_ALLOWLIST');
  if(app.type!=='self_hosted'||app.name!==expected.accessName||
     app.aud!==expected.aud||typeof app.id!=='string'||!app.id)
    return reject('DEDICATED_WORKER_APPLICATION_NOT_MATCHED');
  if(!Array.isArray(app.destinations)||app.destinations.length!==1||
     app.destinations[0]?.type!=='worker'||
     app.destinations[0]?.worker_id!==expected.workerId||
     // Public path overrides bypass Access. All Workers/Pages policies can harm other services.
     (Array.isArray(app.destinations[0]?.overrides)&&app.destinations[0].overrides.length>0))
    return reject('WORKER_DESTINATION_NOT_PRIVATE_EXACT_MATCH');
  if(typeof app.domain==='string'&&
      (app.domain.includes('*')||app.domain.includes('pages.dev')))
    return reject('BROAD_OR_UNRELATED_HOSTNAME');
  const duration=maxSessionMs(app.session_duration);
  if(!Number.isFinite(duration)||duration<60000||duration>3600000)
    return reject('ACCESS_SESSION_POLICY_TOO_BROAD_OR_UNSET');
  if(!Array.isArray(app.policies)||app.policies.length!==1)
    return reject('SINGLE_EXPLICIT_ALLOW_POLICY_REQUIRED');
  const p=app.policies[0];
  if(!p||p.decision!=='allow'||
    !Array.isArray(p.include)||p.include.length<1||
    (Array.isArray(p.require)&&p.require.some(x=>!x||typeof x!=='object'))||
    (Array.isArray(p.exclude)&&p.exclude.some(x=>!x||typeof x!=='object')))
    return reject('NON_ALLOW_OR_MALFORMED_POLICY');
  const got=[];
  for(const selector of p.include){
    if(!selector||typeof selector!=='object'||Array.isArray(selector)||
       Object.keys(selector).length!==1||!Object.hasOwn(selector,'email')||
       !selector.email||typeof selector.email.email!=='string')
      return reject('BROAD_OR_NON_IDENTITY_SELECTOR_FORBIDDEN');
    const e=normal(selector.email.email);
    if(!e||!EMAIL.test(e))return reject('MALFORMED_APPROVED_EMAIL');
    got.push(e);
  }
  if(new Set(got).size!==got.length||!exact(got,allow))
    return reject('OPERATOR_EMAIL_ALLOWLIST_MISMATCH');
  return candidate();
}
