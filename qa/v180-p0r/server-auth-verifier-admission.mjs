// TIEN404 V18.0-P0R: SOURCE-ONLY protected server verifier contract.
// Not an HTTP handler; no live adapter, stored receipt, token logging, Store grant or send path.
// All ports MUST be server-owned and independently security-reviewed before integration.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDLE=/^[A-Za-z0-9_-]{16,128}$/;
const required=['verifyProtectedAccess','getTrustedAccessBinding','verifySignedClaims',
  'fetchLiveAuthUser','lookupCurrentAuthSession','lookupCurrentOwnerMembership',
  'lookupIndependentConsent'];
const deny=code=>{const err=new Error(code);err.name='AdmissionDenied';err.code=code;throw err;};
const same=(a,b)=>typeof a==='string'&&a===b;
const okUUID=x=>typeof x==='string'&&UUID.test(x);
const validTime=x=>typeof x==='number'&&Number.isFinite(x);
const fresh=(x,now)=>validTime(x)&&x>now;

export function createCandidateVerifier({ports, issuer, accessIssuer, accessAudience,
  tenantScope, nowSeconds=()=>Math.floor(Date.now()/1000)}={}) {
  if(!ports||required.some(k=>typeof ports[k]!=='function')||
     typeof issuer!=='string'||!/^https:\/\/[^/]+\/auth\/v1$/.test(issuer)||
     !/^https:\/\//.test(accessIssuer||'')||
     typeof accessAudience!=='string'||accessAudience.length<3||
     !okUUID(tenantScope)||typeof nowSeconds!=='function') deny('VERIFIER_NOT_CONFIGURED');
  const internal=new WeakMap();
  async function admitActor({bearer,accessAssertion,consentHandle,pairingHandle}={}) {
    const now=nowSeconds();
    if(!validTime(now)||typeof bearer!=='string'||bearer.length<24||
       bearer.length>4096||typeof accessAssertion!=='string'||
       !HANDLE.test(consentHandle||'')||!HANDLE.test(pairingHandle||''))
      deny('INPUT_NOT_ADMISSIBLE');
    // Access gate MUST independently validate signed Access assertion, not a client boolean.
    const access=await ports.verifyProtectedAccess(accessAssertion);
    if(access?.signatureVerified!==true||!same(access.issuer,accessIssuer)||
       !same(access.audience,accessAudience)||!fresh(access.expiresAt,now)||
       typeof access.principalId!=='string'||access.principalId.length<8)
      deny('PRIVATE_ACCESS_DENIED');
    const binding=await ports.getTrustedAccessBinding(access.principalId);
    if(binding?.active!==true||!okUUID(binding.authUserId))
      deny('ACCESS_OWNER_BINDING_DENIED');
    // verifySignedClaims must use official Supabase Auth / verified JWKS, not decode JWT.
    const claims=await ports.verifySignedClaims(bearer);
    if(claims?.signatureVerified!==true||!same(claims.iss,issuer)||
       !same(claims.aud,'authenticated')||!same(claims.role,'authenticated')||
       !okUUID(claims.sub)||!okUUID(claims.session_id)||
       !validTime(claims.iat)||claims.iat>now+60||
       !fresh(claims.exp,now)||claims.is_anonymous===true||
       !same(claims.sub,binding.authUserId)) deny('SIGNED_CLAIMS_DENIED');
    // Live user + current session must BOTH match; an unexpired JWT alone is insufficient.
    const user=await ports.fetchLiveAuthUser(bearer);
    if(user?.verified!==true||user?.disabled===true||!same(user.id,claims.sub))
      deny('LIVE_AUTH_USER_DENIED');
    const session=await ports.lookupCurrentAuthSession(claims.session_id);
    if(session?.exists!==true||session.revoked===true||
       !same(session.id,claims.session_id)||!same(session.userId,claims.sub)||
       (session.expiresAt!=null&&!fresh(session.expiresAt,now)))
      deny('SESSION_REVOKED_OR_MISMATCHED');
    const member=await ports.lookupCurrentOwnerMembership(tenantScope,claims.sub);
    if(member?.active!==true||!same(member.role,'owner')||
       !same(member.userId,claims.sub)||!same(member.tenantId,tenantScope))
      deny('TENANT_OWNER_DENIED');
    const consent=await ports.lookupIndependentConsent(consentHandle,claims.sub,pairingHandle);
    if(consent?.verified!==true||consent?.approvedByOwner!==true||
       consent?.used===true||!same(consent.scope,'read_only_identity')||
       !same(consent.userId,claims.sub)||!same(consent.pairingHandle,pairingHandle)||
       !fresh(consent.expiresAt,now)) deny('OWNER_CONSENT_DENIED');
    // No raw identifiers are returned to the caller. Evidence is process-local only.
    const opaque=Object.freeze(Object.create(null));
    internal.set(opaque,{subject:claims.sub,session:claims.session_id,
      principal:access.principalId,tenant:tenantScope,pairing:pairingHandle,
      expiresAt:Math.min(access.expiresAt,claims.exp,consent.expiresAt),
      consentHandle});
    return opaque;
  }
  async function correlatePair(a,b) {
    const x=internal.get(a),y=internal.get(b),now=nowSeconds();
    if(!x||!y||x===y||!validTime(now)) deny('PAIR_EVIDENCE_UNTRUSTED');
    if(!fresh(x.expiresAt,now)||!fresh(y.expiresAt,now))
      deny('PAIR_EVIDENCE_EXPIRED');
    if(x.subject===y.subject||x.session===y.session||x.principal===y.principal||
       x.consentHandle===y.consentHandle) deny('PAIR_NOT_INDEPENDENT');
    if(x.tenant!==y.tenant||x.pairing!==y.pairing) deny('PAIR_SCOPE_MISMATCH');
    // Re-check revocation and consent immediately at correlation time; fail closed.
    for(const item of [x,y]) {
      const current=await ports.lookupCurrentAuthSession(item.session);
      if(current?.exists!==true||current.revoked===true||
         current.id!==item.session||current.userId!==item.subject||
         (current.expiresAt!=null&&!fresh(current.expiresAt,now)))
         deny('PAIR_SESSION_REVOKED');
      const permission=await ports.lookupCurrentOwnerMembership(item.tenant,item.subject);
      if(permission?.active!==true||permission.role!=='owner'||
         permission.tenantId!==item.tenant||permission.userId!==item.subject)
         deny('PAIR_OWNER_REVOKED');
      const consent=await ports.lookupIndependentConsent(item.consentHandle,item.subject,item.pairing);
      if(consent?.verified!==true||consent.approvedByOwner!==true||
         consent.used===true||!fresh(consent.expiresAt,now)||
         consent.scope!=='read_only_identity'||consent.userId!==item.subject||
         consent.pairingHandle!==item.pairing)
         deny('PAIR_CONSENT_REVOKED');
    }
    return Object.freeze({
      status:'IN_MEMORY_PAIR_CORRELATION_CANDIDATE',
      serverPortsLiveVerified:false, // Adapter validation and hosted execution NOT supplied here.
      signedReceiptIssued:false,
      storeAuthorityVerified:false, storeReadAuthorized:false,
      orderAccessAuthorized:false, providerSendAuthorized:false,
      productionApproved:false
    });
  }
  return Object.freeze({admitActor,correlatePair});
}
