// TIEN404 V21.6 — server-side, signed Meta Page installation authority.
// Verification gate, NOT Meta OAuth and NOT permission to send a reaction.
// Issuer must independently check REAL Meta OAuth, app/page token binding,
// Page MESSAGING task and Page subscription before creating any signed receipt.
// Never put an access token or credential inside this payload.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const META_INSTALL_CONTRACT = 't404.meta-page-installation.v1';
const PREFIX = 'TIEN404_META_PAGE_INSTALL_V1:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX = /^[0-9a-f]{64}$/;
const DIGITS = /^[1-9][0-9]{4,24}$/;
const BLOCK = reason => Object.freeze({ status:'blocked',reason });
const mustStr = (value,max=255) => typeof value==='string' && value.length>0 && value.length<=max;
const checks = ['callbackStateVerified','tokenAppBindingVerified','pageTokenValidated','pageMessagingTaskVerified','pageSubscriptionVerified'];
const permissions = ['pages_manage_metadata','pages_messaging','pages_show_list'];
const onlyFields = [
  'schemaVersion','audience','issuer','appId','installationId','connectionId',
  'tenantId','storeId','ownerUserId','metaPageId','metaActorIdSha256',
  'oauthNonceSha256','permissions',...checks,'verifiedAtMs','expiresAtMs'
];

/**
 * Verify an HMAC-sealed receipt. Untrusted fields called "verified" are never
 * sufficient: a real server-only 256-bit HMAC key must authenticate the payload.
 * expected must come from the trusted store resolver, not customer input.
 */
export function verifyMetaPageInstallationReceipt(envelope,key,expected,nowMs=Date.now()){
  if (!(key instanceof Uint8Array) || key.byteLength<32)
    return BLOCK('missing_server_signing_key');
  if (!expected || !UUID.test(expected.connectionId||'') ||
      !UUID.test(expected.tenantId||'') || !UUID.test(expected.storeId||'') ||
      !UUID.test(expected.ownerUserId||'') ||
      !mustStr(expected.appId) || !DIGITS.test(expected.metaPageId||''))
    return BLOCK('untrusted_installation_context');
  if (!envelope || envelope.version!==1 || !mustStr(envelope.payload,4096) ||
      !/^[A-Za-z0-9_-]+$/.test(envelope.payload) ||
      !HEX.test(envelope.signature||''))
    return BLOCK('invalid_receipt_format');

  // Verify the HMAC BEFORE parsing any untrusted JSON.
  const digest=createHmac('sha256',key).update(PREFIX+envelope.payload,'utf8').digest();
  const actual=Buffer.from(envelope.signature,'hex');
  if (actual.length!==digest.length || !timingSafeEqual(actual,digest))
    return BLOCK('invalid_receipt_signature');

  let p;
  try {
    const bytes=Buffer.from(envelope.payload,'base64url');
    if (bytes.length>3000 || bytes.toString('base64url')!==envelope.payload)
      return BLOCK('invalid_receipt_encoding');
    p=JSON.parse(bytes.toString('utf8'));
  } catch { return BLOCK('invalid_receipt_json'); }
  if (!p || typeof p!=='object' || Array.isArray(p) ||
      Object.keys(p).length!==onlyFields.length ||
      Object.keys(p).some(k=>!onlyFields.includes(k)) ||
      p.schemaVersion!==1 || p.audience!==META_INSTALL_CONTRACT ||
      p.issuer!=='t404_meta_oauth_gateway' ||
      !mustStr(p.appId) || !UUID.test(p.installationId||'') ||
      !UUID.test(p.connectionId||'') || !UUID.test(p.tenantId||'') ||
      !UUID.test(p.storeId||'') || !UUID.test(p.ownerUserId||'') ||
      !DIGITS.test(p.metaPageId||'') || !HEX.test(p.metaActorIdSha256||'') ||
      !HEX.test(p.oauthNonceSha256||''))
    return BLOCK('invalid_receipt_claims');
  if (p.appId!==expected.appId || p.connectionId!==expected.connectionId ||
      p.tenantId!==expected.tenantId || p.storeId!==expected.storeId ||
      p.ownerUserId!==expected.ownerUserId || p.metaPageId!==expected.metaPageId)
    return BLOCK('installation_scope_mismatch');
  if (!Array.isArray(p.permissions) || p.permissions.length!==permissions.length ||
      !permissions.every(s=>p.permissions.includes(s)) ||
      p.permissions.some(s=>typeof s!=='string'))
    return BLOCK('meta_permissions_missing');
  if (!checks.every(k=>p[k]===true)) return BLOCK('meta_authority_not_confirmed');
  if (!Number.isSafeInteger(nowMs) || !Number.isSafeInteger(p.verifiedAtMs) ||
      !Number.isSafeInteger(p.expiresAtMs) ||
      p.verifiedAtMs>nowMs+5000 || p.verifiedAtMs<nowMs-15*60*1000 ||
      p.expiresAtMs<=nowMs || p.expiresAtMs>p.verifiedAtMs+24*60*60*1000)
    return BLOCK('stale_meta_authority');
  return Object.freeze({
    status:'verified',connectionId:p.connectionId,tenantId:p.tenantId,
    storeId:p.storeId,ownerUserId:p.ownerUserId,metaPageId:p.metaPageId,
    appId:p.appId,installationId:p.installationId,verifiedAtMs:p.verifiedAtMs,
    expiresAtMs:p.expiresAtMs,attestationVersion:1,
    sendAllowed:false,requiresIndependentOwnerConsent:true
  });
}
