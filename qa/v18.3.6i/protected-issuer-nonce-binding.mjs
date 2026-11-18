/**
 * TIEN404 V18.3.6I — OFFLINE protected Ed25519 issuer-to-nonce binding contract.
 *
 * Strictly designed to be constructed by private server code ONLY.
 * Nothing here connects to Supabase, PostgreSQL, Meta, Zalo, or production.
 * The G verifier performs signature + session + membership validation FIRST.
 * It then invokes our closure with a JTI and expiry. At that point, and only
 * at that point, this module derives a token-bound, Store-bound atomic DB
 * admission request from the signed claims (not from request-supplied fields).
 *
 * commitVerifiedNonce must be a narrow server-owned PostgreSQL operation
 * that LOCKS and RE-CHECKS session/membership state before atomic nonce INSERT,
 * all inside the same transaction. It must return ACCEPTED or a deny value.
 * A separate downstream read/write is NOT protected by that earlier lock.
 */
import {createHmac,createHash} from 'node:crypto';
import {createPrivateVerifier,AuthorityDenied,CONTRACT} from '../v18.3.6g/signed-authority.mjs';

const hex=/^[a-f0-9]{64}$/;
const str=v=>typeof v==='string' && v.length>0 && v.length<=512;
const deny=code=>{throw new AuthorityDenied(code);};
function digest(key,domain,scope) {
  return createHmac('sha256',key).update('TIEN404-I/'+domain+'\0'+scope,'utf8').digest('hex');
}
function tokenHash(token) {return createHash('sha256').update(token,'utf8').digest('hex');}
function payloadFromVerifiedInput(token) {
  // This helper is called ONLY within G's consumeNonce callback, after G
  // validates the Ed25519 signature, strict claims and active Store membership.
  const parts=token.split('.');
  if(parts.length!==3) deny('POST_VERIFICATION_FORMAT');
  try {return JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}
  catch {deny('POST_VERIFICATION_CLAIMS');}
}
export function createProtectedIssuerNonceBinding(o) {
  if(!o || typeof o!=='object' || !Buffer.isBuffer(o.scopeBindingSecret) ||
     o.scopeBindingSecret.length<32 || typeof o.commitVerifiedNonce!=='function' ||
     typeof o.verifySession!=='function' || typeof o.resolveMembership!=='function' ||
     typeof o.clock!=='function' || typeof o.consumeNonce==='function' ||
     !(o.trustedKeys instanceof Map)) deny('PRIVATE_CONFIGURATION');
  // Trusted keys, callbacks and DB admission client must be private immutable
  // dependencies, never request bodies. G freezes its pinned key registry.
  const {scopeBindingSecret,commitVerifiedNonce,...verifierConfig}=o;
  return Object.freeze({
    async redeemReadOnly({token,sessionHandle,tenantId,storeId,capability}) {
      if(!str(token) || token.length>4096 ||
         !str(sessionHandle) || !str(tenantId) || !str(storeId) ||
         !CONTRACT.allowedCapabilities.includes(capability)) deny('REQUEST_REJECTED');
      const jwtHash=tokenHash(token);
      const nonceCallback=async({jti,expiresAt})=>{
        const claims=payloadFromVerifiedInput(token);
        if(!str(claims.sub) || !str(claims.session_binding) ||
           !str(claims.membership_revision) ||
           claims.jti!==jti || claims.exp!==expiresAt ||
           claims.tenant_id!==tenantId || claims.store_id!==storeId ||
           claims.capability!==capability ||
           claims.iss!==CONTRACT.issuer || claims.aud!==CONTRACT.audience)
           deny('BOUND_CLAIM_INCONSISTENCY');
        const request=Object.freeze({
          issuer:claims.iss,audience:claims.aud,jti,
          capability,expiresAt,
          tenantHash:digest(scopeBindingSecret,'TENANT',claims.tenant_id),
          storeHash:digest(scopeBindingSecret,'STORE',claims.store_id),
          subjectHash:digest(scopeBindingSecret,'SUBJECT',claims.sub),
          sessionBindingHash:digest(scopeBindingSecret,'SESSION',claims.session_binding),
          membershipRevisionHash:digest(scopeBindingSecret,'MEMBERSHIP',claims.membership_revision),
          authorityDigest:jwtHash,
        });
        if(![request.tenantHash,request.storeHash,request.subjectHash,request.sessionBindingHash,
             request.membershipRevisionHash,request.authorityDigest].every(x=>hex.test(x)))
          deny('INVALID_SERVER_DIGEST');
        // This must be the SAME transaction as the actual protected operation
        // if the caller needs post-revocation ordering for data writes.
        let result;
        try { result=await commitVerifiedNonce(request); }
        catch {deny('ATOMIC_ADMISSION_UNAVAILABLE');}
        return result==='ACCEPTED'; // fail closed on any unexpected success shape
      };
      // A NEW per-redeem verifier is constructed so callback state cannot
      // bleed across requests; token signature checked before DB admission.
      const verifier=createPrivateVerifier({...verifierConfig,consumeNonce:nonceCallback});
      const verified=await verifier.redeem({token,sessionHandle,tenantId,storeId,capability});
      return Object.freeze({
        ...verified,proof:'signed_ed25519_plus_pg_atomic_admission_synthetic',
        operationExecuted:false,productionAdmitted:false,
      });
    },
  });
}
