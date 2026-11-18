/**
 * V18.3.6H trusted server SESSION ADAPTER CONTRACT — offline candidate.
 *
 * This class does NOT verify cryptographic JWT signatures by itself.
 * verifyJwt MUST be supplied by a trusted Supabase server adapter configured
 * with a fixed project issuer/audience and approved JWKS/algorithm.
 * All callbacks must be created server-side, never supplied by clients.
 *
 * No actual Auth sessions or provider tokens are used in this project QA.
 */
export class TrustedSessionDenied extends Error {
  constructor(code) { super('SESSION_DENIED_'+code); this.name='TrustedSessionDenied'; this.code=code; }
}
const fail=code=>{throw new TrustedSessionDenied(code);};
const nonempty=(s)=>typeof s==='string' && s.length>0 && s.length<=512;
function configs(o) {
  const callbacks=['resolveOpaqueSessionHandle','verifyJwt','fetchUser','lookupActiveSession',
    'readCanonicalStoreMembership','clock'];
  if (!o || typeof o!=='object' ||
      callbacks.some(x=>typeof o[x]!=='function') ||
      !nonempty(o.expectedIssuer) ||
      o.expectedIssuer.includes('*') ||
      o.expectedAudience!=='authenticated' ||
      !Number.isInteger(o.maxSessionCheckAgeSeconds) ||
      o.maxSessionCheckAgeSeconds<0 || o.maxSessionCheckAgeSeconds>30)
    fail('CONFIGURATION');
}
function seconds(clock) {
  const v=Math.floor(clock()/1000);
  if (!Number.isSafeInteger(v)||v<1_500_000_000) fail('CLOCK');
  return v;
}
async function trustedCall(callback, ...args) {
  try { return await callback(...args); }
  catch { fail('DEPENDENCY_UNAVAILABLE'); }
}
function validateClaims(result,expectedIssuer,expectedAudience,now) {
  if (!result || result.cryptographicallyVerified!==true ||
      result.trustedIssuerAndKey!==true || !result.claims)
    fail('JWT_NOT_VERIFIED');
  const c=result.claims;
  if (!nonempty(c.sub)||!nonempty(c.session_id) ||
      c.iss!==expectedIssuer || c.aud!==expectedAudience ||
      c.role!=='authenticated' || c.is_anonymous===true ||
      !Number.isSafeInteger(c.iat) || c.iat>now ||
      !Number.isSafeInteger(c.exp) || c.exp<=now)
    fail('JWT_CLAIMS_INVALID');
  return c;
}
function validateStoreMembership(row,userId,tenantId,storeId,now) {
  if (!row || row.source!=='private_canonical_store_authority' ||
      row.rowCount!==1 || row.userId!==userId ||
      row.tenantId!==tenantId || row.storeId!==storeId ||
      row.status!=='active' || row.storeStatus!=='active' ||
      row.tenantMembershipActive!==true || row.revokedAt!==null ||
      (row.expiresAt!==null &&
        (!Number.isSafeInteger(row.expiresAt)||row.expiresAt<=now)) ||
      !nonempty(row.revision) || !Array.isArray(row.capabilities) ||
      row.capabilities.some(c=>!['CATALOG_READ','ORDER_READ'].includes(c)))
    fail('MEMBERSHIP_INVALID');
  return {
    userId,tenantId,storeId,status:'active',storeStatus:'active',
    tenantMembershipActive:true,revokedAt:null,expiresAt:row.expiresAt,
    revision:row.revision,capabilities:[...row.capabilities],
  };
}
/** Return the two callbacks expected by the V18.3.6G read-only signer. */
export function createTrustedSessionAdapter(options) {
  configs(options);
  return Object.freeze({
    async verifySession(opaqueHandle) {
      if (!nonempty(opaqueHandle)) fail('SESSION_HANDLE');
      const now=seconds(options.clock);
      // This callback resolves the opaque handle in a PRIVATE session store.
      // It must not return a token into a log, browser or n8n context.
      const record=await trustedCall(options.resolveOpaqueSessionHandle,opaqueHandle);
      if (!record || record.source!=='trusted_server_session_store' ||
          !nonempty(record.accessToken)) fail('OPAQUE_SESSION_NOT_FOUND');
      const verification=await trustedCall(options.verifyJwt,record.accessToken);
      const claims=validateClaims(verification,options.expectedIssuer,options.expectedAudience,now);
      const user=await trustedCall(options.fetchUser,record.accessToken);
      if (!user || user.source!=='trusted_supabase_auth_server' ||
          user.id!==claims.sub || user.deleted===true || user.disabled===true ||
          user.isAnonymous===true || user.verified!==true) fail('USER_MISMATCH_OR_DISABLED');
      // JWT validity alone is NOT immediate session revocation proof.
      // This callback must query a protected authoritative session state.
      const live=await trustedCall(options.lookupActiveSession,{
        userId:claims.sub,sessionId:claims.session_id,
      });
      if (!live || live.source!=='private_active_session_registry' ||
          live.userId!==claims.sub || live.sessionId!==claims.session_id ||
          live.active!==true || live.revokedAt!==null ||
          !Number.isSafeInteger(live.checkedAt) ||
          live.checkedAt>now ||
          now-live.checkedAt>options.maxSessionCheckAgeSeconds ||
          (live.expiresAt!==null && (!Number.isSafeInteger(live.expiresAt) ||
                                      live.expiresAt<=now)))
        fail('SESSION_REVOKED_UNVERIFIED_OR_STALE');
      return Object.freeze({
        source:'trusted_supabase_server_adapter', verified:true, active:true,
        sub:claims.sub,sessionId:claims.session_id,iss:claims.iss,
        aud:claims.aud,exp:claims.exp,
      });
    },
    async resolveMembership({userId,tenantId,storeId}) {
      if (![userId,tenantId,storeId].every(nonempty))
        fail('MEMBERSHIP_INPUT');
      const now=seconds(options.clock);
      const row=await trustedCall(options.readCanonicalStoreMembership,{userId,tenantId,storeId});
      return Object.freeze(validateStoreMembership(row,userId,tenantId,storeId,now));
    },
  });
}
