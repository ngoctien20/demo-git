/**
 * V18.3.6G — OFFLINE, dependency-free signed authority contract.
 *
 * This is NOT a Supabase Auth verifier, token issuer service or production adapter.
 * An issuer is constructed ONLY inside a trusted server runtime with:
 *   - an Ed25519 private KeyObject held outside source control,
 *   - a server-side Supabase session verifier callback,
 *   - a canonical DB membership resolver.
 * Redemption requires a trusted pinned public-key registry, fresh callbacks,
 * and an ATOMIC shared nonce-consumption store. A local Map is NOT sufficient
 * for production nonce replay protection.
 *
 * The test suite provides synthetic callbacks and ephemeral keys only.
 */
import {
  createHash, createHmac, randomUUID, sign as cryptoSign, verify as cryptoVerify
} from 'node:crypto';

export const CONTRACT = Object.freeze({
  version: 'V18.3.6G-1',
  typ: 'tien404-private-authority+jwt',
  alg: 'EdDSA',
  issuer: 'tien404-private-authority-staging',
  audience: 'tien404-private-commerce-readonly',
  supabaseIssuer: 'https://synthetic-auth.example.invalid/auth/v1',
  supabaseAudience: 'authenticated',
  maxTtlSeconds: 120,
  allowedCapabilities: ['CATALOG_READ','ORDER_READ'],
});

export class AuthorityDenied extends Error {
  constructor(code) {
    super('AUTHORITY_DENY_' + code);
    this.name = 'AuthorityDenied';
    this.code = code;
  }
}
function deny(code) { throw new AuthorityDenied(code); }
function present(x) { return typeof x === 'string' && x.length > 0 && x.length <= 512; }
function hashString(s) { return createHash('sha256').update(s).digest('hex'); }
function requireConfig(options, fields) {
  if (!options || typeof options !== 'object') deny('CONFIGURATION');
  for (const field of fields) {
    if (options[field] === undefined || options[field] === null) deny('CONFIGURATION');
  }
}
function asPublicKey(key) {
  if (!key || key.asymmetricKeyType !== 'ed25519' || key.type !== 'public') deny('TRUSTED_KEY');
  return key;
}
function nowSeconds(clock) {
  const n = Math.floor(clock() / 1000);
  if (!Number.isSafeInteger(n) || n < 1_500_000_000) deny('CLOCK');
  return n;
}
function canonicalEncode(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
function strictDecode(encoded, maxBytes) {
  if (typeof encoded !== 'string' || encoded.length < 2 ||
      encoded.length > Math.ceil(maxBytes * 1.35) ||
      !/^[A-Za-z0-9_-]+$/.test(encoded)) deny('TOKEN_ENCODING');
  const buf = Buffer.from(encoded, 'base64url');
  if (buf.length > maxBytes || buf.toString('base64url') !== encoded) deny('TOKEN_ENCODING');
  const json = buf.toString('utf8');
  let parsed;
  try { parsed = JSON.parse(json); } catch { deny('TOKEN_JSON'); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object' ||
      JSON.stringify(parsed) !== json) deny('TOKEN_NONCANONICAL');
  return parsed;
}
function exactKeys(value, required) {
  const actual = Object.keys(value).sort();
  const wanted = [...required].sort();
  return actual.length === wanted.length && actual.every((key, i) => key === wanted[i]);
}
function fingerprint(sessionId, bindingKey) {
  if (!present(sessionId)) deny('SESSION_BINDING');
  return createHmac('sha256', bindingKey).update('tien404-g-session-binding\0').update(sessionId).digest('base64url');
}
function assertTrustedPrincipal(principal, now) {
  if (!principal || principal.source !== 'trusted_supabase_server_adapter' ||
      principal.verified !== true || principal.active !== true ||
      !present(principal.sub) || !present(principal.sessionId) ||
      principal.iss !== CONTRACT.supabaseIssuer ||
      principal.aud !== CONTRACT.supabaseAudience ||
      !Number.isSafeInteger(principal.exp) || principal.exp <= now) deny('SESSION_NOT_VERIFIED');
}
function assertMembership(member, userId, tenantId, storeId, capability, now) {
  if (!member || member.tenantId !== tenantId || member.storeId !== storeId ||
      member.userId !== userId || member.status !== 'active' ||
      member.storeStatus !== 'active' || member.tenantMembershipActive !== true ||
      member.revokedAt !== null ||
      (member.expiresAt !== null && (!Number.isSafeInteger(member.expiresAt) || member.expiresAt <= now)) ||
      !present(member.revision) || !Array.isArray(member.capabilities) ||
      !member.capabilities.includes(capability)) deny('MEMBERSHIP_NOT_ACTIVE_OR_SCOPED');
}
function assertOptions(o, mustHavePrivateKey) {
  requireConfig(o, ['verifySession','resolveMembership','bindingKey','clock']);
  if (mustHavePrivateKey) requireConfig(o, ['privateKey','kid']);
  if (typeof o.verifySession !== 'function' || typeof o.resolveMembership !== 'function' ||
      typeof o.clock !== 'function' || !Buffer.isBuffer(o.bindingKey) || o.bindingKey.length < 32)
    deny('CONFIGURATION');
  if (mustHavePrivateKey && (!o.privateKey || o.privateKey.asymmetricKeyType !== 'ed25519' ||
      o.privateKey.type !== 'private' || !/^[a-z0-9-]{3,64}$/.test(o.kid))) deny('SIGNING_KEY');
}
async function trustedState(o, handle, tenantId, storeId, capability, now) {
  let principal, member;
  try {
    principal = await o.verifySession(handle);
    assertTrustedPrincipal(principal, now);
    member = await o.resolveMembership({userId:principal.sub, tenantId, storeId});
    assertMembership(member,principal.sub,tenantId,storeId,capability,now);
  } catch(e) {
    if (e instanceof AuthorityDenied) throw e;
    deny('SERVER_ATTESTATION_UNAVAILABLE');
  }
  return {principal, member};
}
export function createPrivateIssuer(o) {
  assertOptions(o, true);
  return Object.freeze({
    async issue({sessionHandle, tenantId, storeId, capability}) {
      const now = nowSeconds(o.clock);
      if (!present(tenantId) || !present(storeId) || !CONTRACT.allowedCapabilities.includes(capability))
        deny('REQUEST_SCOPE');
      const {principal,member} = await trustedState(o,sessionHandle,tenantId,storeId,capability,now);
      const exp = Math.min(now + CONTRACT.maxTtlSeconds, principal.exp);
      if (exp <= now) deny('SESSION_EXPIRED');
      const header = {alg:CONTRACT.alg,typ:CONTRACT.typ,kid:o.kid};
      const claims = {
        v:CONTRACT.version,iss:CONTRACT.issuer,aud:CONTRACT.audience,
        sub:principal.sub,actor_type:'human',tenant_id:tenantId,store_id:storeId,
        session_binding:fingerprint(principal.sessionId,o.bindingKey),
        membership_revision:member.revision,capability,
        jti:randomUUID(),iat:now,nbf:now,exp,
      };
      const signingInput = canonicalEncode(header) + '.' + canonicalEncode(claims);
      const signature = cryptoSign(null,Buffer.from(signingInput,'ascii'),o.privateKey);
      return signingInput + '.' + signature.toString('base64url');
    },
  });
}

const HEADER_KEYS = ['alg','typ','kid'];
const CLAIM_KEYS = ['v','iss','aud','sub','actor_type','tenant_id','store_id','session_binding',
 'membership_revision','capability','jti','iat','nbf','exp'];

export function createPrivateVerifier(o) {
  assertOptions(o, false);
  requireConfig(o,['trustedKeys','consumeNonce']);
  if (typeof o.consumeNonce !== 'function' || !(o.trustedKeys instanceof Map)) deny('CONFIGURATION');
  // Public keys are PINNED server-side. No jku/jwk/x5u/URL from the JWT is honored.
  const trusted = new Map();
  for (const [kid,key] of o.trustedKeys) {
    if (!/^[a-z0-9-]{3,64}$/.test(kid)) deny('TRUSTED_KEY');
    trusted.set(kid,asPublicKey(key));
  }
  return Object.freeze({
    async redeem({token,sessionHandle,tenantId,storeId,capability}) {
      if (typeof token !== 'string' || token.length > 4096 || token.length < 50)
        deny('TOKEN_SIZE');
      const parts = token.split('.');
      if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[2])) deny('TOKEN_FORMAT');
      const header = strictDecode(parts[0],256);
      if (!exactKeys(header,HEADER_KEYS) || header.typ!==CONTRACT.typ || header.alg!==CONTRACT.alg ||
          !present(header.kid)) deny('HEADER_REJECTED');
      const key = trusted.get(header.kid);
      if (!key) deny('UNTRUSTED_KID');
      const signingInput = parts[0]+'.'+parts[1];
      const signature = Buffer.from(parts[2],'base64url');
      if (signature.length!==64 || signature.toString('base64url')!==parts[2] ||
          !cryptoVerify(null,Buffer.from(signingInput,'ascii'),key,signature))
        deny('BAD_SIGNATURE');
      const claims = strictDecode(parts[1],1536);
      if (!exactKeys(claims,CLAIM_KEYS)) deny('CLAIMS_REJECTED');
      const now=nowSeconds(o.clock);
      if (claims.v!==CONTRACT.version || claims.iss!==CONTRACT.issuer ||
          claims.aud!==CONTRACT.audience || claims.actor_type!=='human' ||
          !present(claims.sub) || !present(claims.tenant_id) || !present(claims.store_id) ||
          !present(claims.session_binding) || !present(claims.membership_revision) ||
          !CONTRACT.allowedCapabilities.includes(claims.capability) ||
          typeof claims.jti !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(claims.jti) ||
          !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.nbf) ||
          !Number.isSafeInteger(claims.exp) || claims.exp<=now ||
          claims.nbf>now || claims.iat>now ||
          claims.exp-claims.iat > CONTRACT.maxTtlSeconds ||
          claims.iat-claims.nbf>0 || claims.exp<=claims.iat)
        deny('CLAIMS_INVALID_OR_EXPIRED');
      if (claims.tenant_id!==tenantId || claims.store_id!==storeId ||
          claims.capability!==capability) deny('REQUEST_MISMATCH');
      const {principal,member}=await trustedState(o,sessionHandle,claims.tenant_id,claims.store_id,
        claims.capability,now);
      if (principal.sub!==claims.sub ||
          fingerprint(principal.sessionId,o.bindingKey)!==claims.session_binding ||
          member.revision!==claims.membership_revision || principal.exp < claims.exp)
        deny('SUBJECT_SESSION_OR_REVISION_CHANGED');
      // The nonce store MUST be durable and atomic and independently managed.
      let consumed;
      try { consumed=await o.consumeNonce({jti:claims.jti,expiresAt:claims.exp}); }
      catch { deny('NONCE_STORE_UNAVAILABLE'); }
      if (consumed!==true) deny('REPLAY');
      // No DB operation, no send, no provider call and no raw session ID returned here.
      return Object.freeze({
        allowed:true,capability:claims.capability,
        tenantId:claims.tenant_id,storeId:claims.store_id,
        subject:claims.sub,proof:'synthetic_signed_authority',
      });
    },
  });
}

export const __internalsForTests = Object.freeze({
  canonicalEncode,strictDecode,hashString,
});
