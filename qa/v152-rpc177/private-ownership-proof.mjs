/** RPC17.7 — verify strictly bound PRIVATE test approvals, never grant staging writes.
 * All keys in QA are ephemeral synthetic Ed25519; production approval must be independent,
 * separately authenticated, non-chat, fresh and bound to actual owner/merchant evidence.
 */
import {createPublicKey,verify,timingSafeEqual} from 'node:crypto';
const ID=/^[A-Za-z0-9_-]{4,128}$/;
const fixed=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const deny=(reason,missing=[])=>Object.freeze({accepted:false,can_migrate:false,can_issue_tokens:false,can_read_merchant_files:false,can_upload:false,can_send:false,can_change_access:false,reason,missing:Object.freeze(missing)});
const sorted=(p)=>Object.keys(p).sort().join(',');
function signedProof(packet,pins,now){
 try{
  if(!packet||!pins||typeof packet.kid!=='string'||!Object.hasOwn(pins,packet.kid)||typeof packet.payload!=='string'||typeof packet.signature!=='string')return null;
  const pub=createPublicKey(pins[packet.kid]);
  if(pub.asymmetricKeyType!=='ed25519')return null;
  const raw=Buffer.from(packet.payload,'base64url'),sig=Buffer.from(packet.signature,'base64url');
  if(raw.length<10||raw.length>2048||raw.toString('base64url')!==packet.payload||sig.length!==64||sig.toString('base64url')!==packet.signature)return null;
  if(!verify(null,raw,pub,sig))return null;
  const p=JSON.parse(raw.toString('utf8'));
  if(!p||Array.isArray(p)||typeof p!=='object')return null;
  if(sorted(p)!=='approval_id,aud,exp,iat,merchant_ref,nonce,operator_sub,role,scope,store_a,store_b,tenant_id')return null;
  if(!Number.isSafeInteger(now)||!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.iat>now||p.exp<=now||p.exp-p.iat>180||now-p.iat>180)return null;
  if(!['approval_id','merchant_ref','nonce','operator_sub','tenant_id','store_a','store_b'].every(k=>typeof p[k]==='string'&&ID.test(p[k])))return null;
  return p;
 }catch{return null;}
}
export function assessPrivateOwnershipBundle({owner,security,finance,ownerPins,securityPins,financePins,context,now}={}){
 try{
  if(!context||!['tenant_id','store_a','store_b','merchant_ref','operator_sub'].every(k=>typeof context[k]==='string'&&ID.test(context[k]))||context.store_a===context.store_b)return deny('CONTEXT_NOT_CANONICAL');
  const proofs=[
   signedProof(owner,ownerPins,now),
   signedProof(security,securityPins,now),
   signedProof(finance,financePins,now)
  ];
  if(proofs.some(p=>!p))return deny('UNVERIFIED_PROOF');
  const expectedRoles=['merchant_owner','security_reviewer','finance_delegate'];
  if(proofs.some((p,i)=>p.role!==expectedRoles[i]||p.aud!=='tien404-rpc177-private-qa'||p.scope!=='review.disposable.no_send'))return deny('ROLE_OR_SCOPE');
  if(proofs.some(p=>!['tenant_id','store_a','store_b','merchant_ref','operator_sub'].every(k=>fixed(p[k],context[k]))))return deny('CROSS_STORE_OR_MERCHANT');
  if(new Set(proofs.map(p=>p.approval_id)).size!==3||new Set(proofs.map(p=>p.nonce)).size!==3)return deny('DUPLICATE_APPROVAL');
  if(new Set([ownerPins[owner.kid],securityPins[security.kid],financePins[finance.kid]]).size!==3)return deny('AUTHORITIES_NOT_INDEPENDENT');
  return Object.freeze({accepted:true,can_migrate:false,can_issue_tokens:false,can_read_merchant_files:false,can_upload:false,can_send:false,can_change_access:false,reason:'SYNTHETIC_SIGNATURE_PREFLIGHT_ONLY',missing:Object.freeze(['INDEPENDENT_REAL_IDENTITY_VERIFICATION','REAL_STORE_OWNER_RECORD','HUMAN_AUTHORIZED_MIGRATION'])});
 }catch{return deny('FAIL_CLOSED');}
}
export const realHostedDecision=()=>deny('REAL_AUTH_AND_HUMAN_APPROVAL_NOT_ADMITTED');
