// TIEN404 V18.0-P0H — private browser Auth **read-only** preflight.
// This function is a *browser local operator aide*, not a backend verifier.
// Inject the official Supabase client already configured by the QA staging app
// in that actor's independently authenticated browser session.
// Do not invoke with service_role, raw JWT strings or unknown third-party clients.
// Never log returned Auth data (user/claims) or report user/session identifiers.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const expectedIssuer='https://ifxlvrhyjhbzbrkdsida.supabase.co/auth/v1';
const deny=(reason)=>Object.freeze({
 stage:'P0H_LOCAL_AUTH_PREFLIGHT',
 status:'BLOCKED',reason,
 localAuthChecked:false,realStoreOwnerVerified:false,
 serverSessionRevocationVerified:false,consentIndependentlyVerified:false,
 actorAandBDistinctVerified:false,
 canRunHostedAB:false,canChangeHosted:false,canGrantStoreRoles:false,
 canSend:false,canPublish:false
});
export async function checkBrowserActorReadOnly(client,opts={}){
 if(opts?.privateOperatorConsentConfirmed!==true)return deny('PRIVATE_CONSENT_REQUIRED');
 if(opts?.environment!=='STAGING_QA_PRIVATE')return deny('WRONG_ENVIRONMENT');
 if(opts?.roleSlot!=='A'&&opts?.roleSlot!=='B')return deny('INVALID_ACTOR_SLOT');
 if(opts?.useRealCustomerData!==false || opts?.noSend!==true)return deny('NO_SEND_NO_CUSTOMER_DATA_REQUIRED');
 if(!client||typeof client!=='object'||!client.auth||
    typeof client.auth.getUser!=='function'||typeof client.auth.getClaims!=='function')
    return deny('OFFICIAL_AUTH_CLIENT_REQUIRED');

 // Official Auth read calls only. Never use getSession() as verification,
 // never accept user_metadata or a user-supplied Store value as authority.
 try{
  const userRes=await client.auth.getUser();
  if(userRes?.error || !uuid.test(userRes?.data?.user?.id||'') ||
     userRes.data.user.is_anonymous===true)
    return deny('OFFICIAL_GETUSER_NOT_VERIFIED');
  const claimsRes=await client.auth.getClaims();
  if(claimsRes?.error)return deny('OFFICIAL_GETCLAIMS_NOT_VERIFIED');
  const c=claimsRes?.data?.claims;
  if(!c || typeof c!=='object')return deny('OFFICIAL_CLAIMS_MISSING');
  const audOK=c.aud==='authenticated' ||
   (Array.isArray(c.aud)&&c.aud.includes('authenticated'));
  const nowSeconds=Math.floor(Date.now()/1000);
  if(c.iss!==expectedIssuer||!audOK||c.role!=='authenticated'||
     c.sub!==userRes.data.user.id || !uuid.test(c.sub||'') ||
     !uuid.test(c.session_id||'') ||
     !Number.isFinite(c.exp)||c.exp<=nowSeconds||
     !Number.isFinite(c.iat)||c.iat>nowSeconds+60)
    return deny('JWT_CLAIMS_OR_SUBJECT_MISMATCH');

  // A positive result only confirms official client response during
  // this browser's local preflight, NOT owner consent/Store membership.
  // It never includes id, email, session_id, phone, claims or JWT.
  return Object.freeze({
    stage:'P0H_LOCAL_AUTH_PREFLIGHT',
    status:'LOCAL_AUTH_CLIENT_READ_ONLY_CHECKED',
    reason:'INDEPENDENT_SERVER_OWNER_AND_SESSION_REVIEW_REQUIRED',
    roleSlot:opts.roleSlot,
    localAuthChecked:true,
    realStoreOwnerVerified:false,
    serverSessionRevocationVerified:false,
    consentIndependentlyVerified:false,
    actorAandBDistinctVerified:false,
    canRunHostedAB:false,canChangeHosted:false,canGrantStoreRoles:false,
    canSend:false,canPublish:false
  });
 }catch{
  return deny('AUTH_CLIENT_OPERATION_UNAVAILABLE');
 }
}
export function reviewTwoLocalPrechecks(a,b){
 // Distinct browser slots, not signed identity proof.
 // These reports are unsigned and can never be accepted as trusted authority.
 const prechecked=Boolean(a?.status==='LOCAL_AUTH_CLIENT_READ_ONLY_CHECKED'&&
  b?.status==='LOCAL_AUTH_CLIENT_READ_ONLY_CHECKED'&&a?.roleSlot==='A'&&b?.roleSlot==='B');
 return Object.freeze({
  stage:'P0H_PAIR_HANDOFF',
  status:prechecked?'PRIVATE_OPERATOR_REVIEW_REQUIRED':'BLOCKED',
  localBrowserPrechecks:prechecked?2:0,
  distinctActorIdentityCryptographicallyProven:false,
  canonicalStoreOwnershipVerified:false,
  sessionServerRevocationProven:false,
  noSendOnly:true,canGrantStoreRoles:false,canRunHostedAB:false,
  canChangeHosted:false,canSend:false,canPublish:false
 });
}
