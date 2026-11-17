// TIEN404 V17.MULTI-CHANNEL-03A — private *offline* two-session JWT/RLS
// acceptance rehearsal. No JWT values enter this API. No Auth/DB calls here.
// A future operator-signed private runner would supply independently scoped
// getUser/PostgREST results for two distinct browser sessions. A mock does NOT
// prove real JWT or RLS. A positive result is only a REVIEW CANDIDATE.
const MODE='OFFLINE_FIXTURE_ONLY';
const FAIL=code=>Object.freeze({candidate:false,code,
 actualJwtVerified:false,actualRlsVerified:false,realUatComplete:false,
 canReadRealInbox:false,canChangeRls:false,canDeploy:false,noSend:true,
 customerRowsRead:0});
const ID=/^[A-Za-z0-9_.:-]{3,128}$/;
const ok=x=>typeof x==='string'&&ID.test(x);
const action='READ_ONLY_STAFF_INBOX';
function safeSession(s,slot,clock) {
 return !!s && s.source==='QA_SYNTHETIC_AUTH_SERVER_RECEIPT' &&
  s.slot===slot && s.authenticated===true && s.jwtSignatureChecked===true &&
  s.revoked===false && s.isAnonymous===false &&
  ok(s.userAlias) && ok(s.sessionAlias) &&
  ok(s.tenantRef) && ok(s.storeRef) &&
  Number.isSafeInteger(s.expiresAtMs) && s.expiresAtMs>clock &&
  s.action===action;
}
function safeRead(r,session) {
 return !!r && r.source==='QA_SYNTHETIC_POSTGREST_RLS_RECEIPT' &&
  r.slot===session.slot &&
  r.tenantRef===session.tenantRef &&
  r.storeRef===session.storeRef &&
  r.sentinelOwnVisible===true && r.sentinelCrossStoreHidden===true &&
  r.adminBypassUsed===false && r.serviceRoleUsed===false &&
  r.storeRlsPolicyActuallyApplied===true &&
  r.noWrites===true &&
  r.realDatabaseRowDataReturned===false;
}
export async function inspectDualStoreUatRehearsal(deps) {
 if(!deps || deps.executionMode!==MODE || deps.realJwtRunnerEnabled!==false ||
  typeof deps.inspectAuthSlot!=='function' ||
  typeof deps.inspectRlsSlot!=='function' ||
  typeof deps.inspectRevocation!=='function')
  return FAIL('PRIVATE_RUNNER_NOT_AUTHORIZED');
 const now=deps.nowMs??Date.now();
 if(!Number.isSafeInteger(now)||now<=0)return FAIL('CLOCK_INVALID');
 let a,b;
 try{
  a=await deps.inspectAuthSlot('A');
  b=await deps.inspectAuthSlot('B');
 }catch{return FAIL('AUTH_RECEIPT_UNAVAILABLE');}
 if(!safeSession(a,'A',now)||!safeSession(b,'B',now))
  return FAIL('SIGNED_SESSION_SHAPES_MISSING_OR_UNTRUSTED');
 if(a.userAlias===b.userAlias || a.sessionAlias===b.sessionAlias ||
  a.storeRef===b.storeRef || a.tenantRef!==b.tenantRef)
  return FAIL('SAME_TENANT_DIFFERENT_OWNER_AND_STORE_NOT_PROVED');
 let ra,rb,revocation;
 try {
  ra=await deps.inspectRlsSlot('A');
  rb=await deps.inspectRlsSlot('B');
  revocation=await deps.inspectRevocation();
 }catch{return FAIL('RLS_OR_REVOCATION_EVIDENCE_UNAVAILABLE');}
 if(!safeRead(ra,a)||!safeRead(rb,b))
  return FAIL('CROSS_STORE_RLS_NEGATIVE_AND_POSITIVE_SENTINELS_REQUIRED');
 if(!revocation || revocation.source!=='QA_SYNTHETIC_REVOCATION_RECEIPT'||
   revocation.tenantRef!==a.tenantRef ||
   revocation.staffRoleRevokedDenied!==true ||
   revocation.afterRevocationFreshAuthDenied!==true ||
   revocation.noWrites!==true)
  return FAIL('REVOCATION_READBACK_NOT_PROVED');
 return Object.freeze({
  candidate:true,code:'SYNTHETIC_REHEARSAL_ONLY',
  reviewRequired:true,checksPerformed:5,
  actualJwtVerified:false,actualRlsVerified:false,realUatComplete:false,
  canReadRealInbox:false,canChangeRls:false,canDeploy:false,noSend:true,
  customerRowsRead:0
 });
}
