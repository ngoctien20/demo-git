import {createHash,timingSafeEqual} from 'node:crypto';
import {verifyMetaSyntheticFixture} from '../v1723n/deployed-route-ingress.mjs';

/**
 * Provider-specific synthetic verifier fixtures only.
 *
 * Meta: X-Hub-Signature-256 = sha256=<HMAC_SHA256(rawBody, appSecret)>.
 * Zalo OA: documented digest = SHA256(appId + exactData + timeStamp + OAsecretKey).
 * Zalo Bot API: X-Bot-Api-Secret-Token is a shared-secret header, NOT an
 * OAuth/Meta signature and NOT the same as Zalo OA digest.
 *
 * Only an operator-owned private runtime may check real headers/events;
 * public CI never has real secrets or actual provider traffic.
 */
function safeBytes(x){return Buffer.isBuffer(x)&&x.length>0&&x.length<=65536}
function safeSecret(x){return typeof x==='string'&&x.length>=16&&x.length<=256}
function compareHex(expected,provided){
 if(typeof provided!=='string'||!/^[a-f0-9]{64}$/.test(provided))return false;
 const b=Buffer.from(provided,'hex');
 return expected.length===b.length&&timingSafeEqual(expected,b);
}
export {verifyMetaSyntheticFixture};

export function verifyZaloOaSyntheticDigest({appId,exactDataBytes,timeStamp,oaSecret,digestHex}={}){
 if(typeof appId!=='string'||!/^[A-Za-z0-9_-]{3,128}$/.test(appId))return false;
 if(!safeBytes(exactDataBytes))return false;
 // Exact string timestamp and event data from documented provider mapping.
 // No JSON.parse / JSON.stringify reserialization is permitted.
 if(typeof timeStamp!=='string'||!/^\d{10,17}$/.test(timeStamp))return false;
 if(!safeSecret(oaSecret))return false;
 const calculated=createHash('sha256')
  .update(Buffer.from(appId,'utf8')).update(exactDataBytes)
  .update(Buffer.from(timeStamp,'utf8')).update(Buffer.from(oaSecret,'utf8'))
  .digest();
 return compareHex(calculated,digestHex);
}
export function verifyZaloBotSyntheticSecret({receivedHeader,configuredSecret}={}){
 // Bot header authentication is a distinct mechanism from Zalo OA MAC.
 if(typeof configuredSecret!=='string'||configuredSecret.length<8||configuredSecret.length>256)return false;
 if(typeof receivedHeader!=='string'||receivedHeader.length<8||receivedHeader.length>256)return false;
 const a=Buffer.from(receivedHeader,'utf8'),b=Buffer.from(configuredSecret,'utf8');
 return a.length===b.length&&timingSafeEqual(a,b);
}
export const PRIVATE_CANARY_GATES=Object.freeze([
 'merchant_owner_out_of_band_consent_verified',
 'dedicated_provider_qa_installation_authority_verified',
 'provider_specific_documented_protocol_selected',
 'original_unmodified_event_bytes_or_bot_header_verified',
 'independent_private_operator_signature_attested',
 'nonce_replay_and_time_window_negative_tests_verified',
 'server_side_canonical_store_installation_binding_verified',
 'no_provider_send_and_no_real_order_write_network_guard_verified',
 'test_environment_isolated_from_live_webhook',
 'private_evidence_receipt_signed_by_independent_reviewer'
]);
const dedup=arr=>Object.freeze([...new Set(arr)]);
export function inspectPrivateCanary(packet={}){
 const blockers=[];
 if(!packet||typeof packet!=='object'||Array.isArray(packet))blockers.push('INVALID_PACKET');
 if(!['meta-messenger','zalo-oa','zalo-bot'].includes(packet?.provider))blockers.push('UNSUPPORTED_PROVIDER');
 if(packet?.mode!=='NO_SEND_NO_WRITE')blockers.push('MODE_NOT_NO_SEND_NO_WRITE');
 for(const k of PRIVATE_CANARY_GATES)if(packet?.claims?.[k]!==true)blockers.push('MISSING_'+k.toUpperCase());
 const privateKeys=['rawBody','signature','appSecret','oaSecret','botSecret','jwt','bearer','accessToken','refreshToken','userId','merchantId','storeId','orderId','senderId','customerPhone','providerHeader','originalEvent','secret','privateOwnerEvidence'];
 if(privateKeys.some(k=>packet&&typeof packet==='object'&&Object.hasOwn(packet,k)))blockers.push('RAW_OR_SENSITIVE_DATA_FORBIDDEN');
 if(packet?.claims && typeof packet.claims==='object'&&privateKeys.some(k=>Object.hasOwn(packet.claims,k)))blockers.push('UNTRUSTED_CLIENT_IDENTITY_OR_SECRET');
 blockers.push('PRIVATE_SIGNED_PROVIDER_EVENT_NOT_INDEPENDENTLY_VERIFIED');
 return Object.freeze({
  status:'PRIVATE_CANARY_NO_GO',
  blockers:dedup(blockers),
  actualNativeEventReceived:false,
  realProviderSignatureAccepted:false,
  independentlyVerifiedOperator:false,
  storeBoundProviderInstallationVerified:false,
  realJwtAdmitted:false,
  canOpenCanary:false,
  canReadOrders:false,
  canSend:false,
  canWrite:false,
  canDeploy:false
 });
}
