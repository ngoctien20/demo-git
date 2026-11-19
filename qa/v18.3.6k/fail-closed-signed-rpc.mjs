/**
 * V18.3.6K: offline protected signed RPC caller and fail-closed external Auth gate.
 *
 * The Ed25519 authority token is verified first by the G/I implementation.
 * Only then does this module request a FRESH authoritative remote Auth verdict,
 * bind that verdict to the verified token's nonce/scope and HMAC-sign one
 * specific READ_ONLY RPC operation. No real Auth API or PostgreSQL connection.
 *
 * A caller supplying callbacks, an RPC key, an Auth verdict or the private
 * signing secret directly from an HTTP request defeats this boundary.
 *
 * A fresh upstream check is not atomic with a remote logout occurring AFTER
 * that check. No "zero revocation delay" claim is made.
 */
import {createHmac} from 'node:crypto';
import {createProtectedIssuerNonceBinding} from '../v18.3.6i/protected-issuer-nonce-binding.mjs';

const hex=/^[0-9a-f]{64}$/;
const str=(x)=>typeof x==='string'&&x.length>0&&x.length<=512;
const asInt=(x)=>Number.isSafeInteger(x)&&x>0;
function invariant(ok,reason){if(!ok)throw Error('K_FAIL_CLOSED_'+reason);}
const FIELDS=['issuer','audience','jti','tenantHash','storeHash','subjectHash',
  'sessionBindingHash','membershipRevisionHash','authorityDigest','capability'];
export function canonicalRpcProof(data){
  invariant(data&&typeof data==='object','INPUT');
  for(const x of FIELDS)invariant(str(data[x]),'CLAIM_'+x);
  for(const x of FIELDS.slice(3,9))invariant(hex.test(data[x]),'DIGEST_'+x);
  invariant(hex.test(data.authorityDigest),'TOKEN_DIGEST');
  invariant(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(data.jti),'JTI');
  invariant(['CATALOG_READ'].includes(data.capability),'READ_ONLY');
  invariant(str(data.kid)&&/^[a-z0-9-]{3,64}$/.test(data.kid),'KID');
  invariant(typeof data.resourceId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(data.resourceId),'RESOURCE');
  for(const p of ['expiresAt','authCheckedAt','authValidUntil'])invariant(asInt(data[p]),p);
  return [
    'K1',data.kid,data.issuer,data.audience,data.jti,data.tenantHash,
    data.storeHash,data.subjectHash,data.sessionBindingHash,
    data.membershipRevisionHash,data.authorityDigest,data.capability,
    String(data.expiresAt),data.resourceId,String(data.authCheckedAt),
    String(data.authValidUntil),'ACTIVE',
  ].join('|');
}
export function signRpcProof(data,privateHmacKey){
  invariant(Buffer.isBuffer(privateHmacKey)&&privateHmacKey.length>=32,'SECRET');
  return createHmac('sha256',privateHmacKey)
    .update(canonicalRpcProof(data),'utf8').digest('hex');
}
export function createFailClosedReadOnlyCaller(options){
  invariant(options&&typeof options==='object','CONFIG');
  const {checkExternalSession,privateHmacKey,readOnlyRpc,
    rpcKid,clock,...upstream}=options;
  invariant(typeof checkExternalSession==='function' &&
    typeof readOnlyRpc==='function'&&typeof clock==='function' &&
    Buffer.isBuffer(privateHmacKey)&&privateHmacKey.length>=32 &&
    /^[a-z0-9-]{3,64}$/.test(rpcKid||''),'CONFIG');
  invariant(!('commitVerifiedNonce' in upstream),'FORGED_NONCE_CALLBACK');
  return Object.freeze({
    async readCatalog({token,sessionHandle,tenantId,storeId,resourceId}){
      invariant(str(resourceId),'RESOURCE');
      let returned;
      // This callback is invoked ONLY after G verified Ed25519 and trusted
      // session+membership via I. It is invoked for ONE signed JTI.
      const commitVerifiedNonce=async request=>{
        const now=Math.floor(clock()/1000);
        invariant(asInt(now),'CLOCK');
        let check;
        try{
          check=await checkExternalSession(Object.freeze({
            sessionHandle,
            jti:request.jti,
            subjectHash:request.subjectHash,
            sessionBindingHash:request.sessionBindingHash,
            tenantHash:request.tenantHash,
            storeHash:request.storeHash,
          }));
        }catch{throw Error('K_AUTH_UNAVAILABLE');}
        invariant(check&&check.source==='trusted_live_supabase_auth_session_check' &&
          check.authoritative===true &&
          check.active===true &&
          check.revokedAt===null &&
          check.jti===request.jti &&
          check.subjectHash===request.subjectHash &&
          check.sessionBindingHash===request.sessionBindingHash &&
          check.tenantHash===request.tenantHash &&
          check.storeHash===request.storeHash,'AUTH_NOT_CURRENT_OR_SCOPE');
        invariant(asInt(check.checkedAt)&&asInt(check.validUntil) &&
          check.checkedAt<=now && check.checkedAt>=now-2 &&
          check.validUntil>=now && check.validUntil<=now+3,
          'AUTH_STALE_OR_UNBOUNDED');
        // The verifier receipt is read-only; never turn it into an order
        // write/send-capable RPC. Only one specific synthetic catalog resource.
        const signed=Object.freeze({
          ...request,kid:rpcKid,resourceId,
          authCheckedAt:check.checkedAt,authValidUntil:check.validUntil
        });
        const mac=signRpcProof(signed,privateHmacKey);
        try{
          returned=await readOnlyRpc(Object.freeze({...signed,mac}));
        }catch{throw Error('K_RPC_UNAVAILABLE');}
        invariant(returned&&returned.decision==='ALLOW_CATALOG' &&
          str(returned.itemCode)&&Number.isSafeInteger(returned.priceVnd)&&
          returned.priceVnd>=0,'RPC_DENIED');
        return 'ACCEPTED';
      };
      const verifier=createProtectedIssuerNonceBinding({...upstream,clock,commitVerifiedNonce});
      const receipt=await verifier.redeemReadOnly({token,sessionHandle,tenantId,storeId,capability:'CATALOG_READ'});
      invariant(receipt.allowed===true && receipt.productionAdmitted===false,'VERIFIER');
      return Object.freeze({
        status:'SYNTHETIC_READ_ONLY',itemCode:returned.itemCode,
        priceVnd:returned.priceVnd,productionAdmitted:false,
        realSupabaseAuthValidated:false,providerSend:false,
      });
    }
  });
}
