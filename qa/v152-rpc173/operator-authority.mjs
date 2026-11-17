/** RPC17.3 — offline trusted-operator protocol adapter. NO JWT or Merchant identity is independently verified.
 * Two distinct pinned Ed25519 authorities: operator broker and store ownership service.
 * All positive findings remain local PRE-ADMISSION ONLY; never open Access or upload.
 */
import {createPublicKey, verify, timingSafeEqual} from 'node:crypto';
const DENY=reason=>Object.freeze({accepted:false,can_upload:false,can_send:false,can_open_access:false,can_deploy:false,reason});
const fixed=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const ID=/^[A-Za-z0-9_-]{4,128}$/;
const check=(v,k)=>typeof v==='string'&&ID.test(v)&&v.length<=128;
const canonical=(v)=>Object.keys(v).sort().join(',');
const keyset=(keys,kid)=>!!keys&&Object.hasOwn(keys,kid)&&typeof keys[kid]==='string';
export function verifyPinnedPacket(packet,keys,now){
 try{
  if(!packet||typeof packet!=='object'||typeof packet.kid!=='string'||!keyset(keys,packet.kid)||typeof packet.payload!=='string'||typeof packet.signature!=='string')return null;
  const key=createPublicKey(keys[packet.kid]);if(key.asymmetricKeyType!=='ed25519')return null;
  const raw=Buffer.from(packet.payload,'base64url'),signature=Buffer.from(packet.signature,'base64url');
  if(raw.length<10||raw.length>4096||raw.toString('base64url')!==packet.payload||signature.length!==64||signature.toString('base64url')!==packet.signature)return null;
  if(!verify(null,raw,key,signature))return null;
  const parsed=JSON.parse(raw.toString('utf8'));
  if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')return null;
  if(!Number.isSafeInteger(now)||!Number.isSafeInteger(parsed.iat)||!Number.isSafeInteger(parsed.exp)||parsed.iat>now||parsed.exp<=now||parsed.exp-parsed.iat>120)return null;
  return parsed;
 }catch{return null;}
}
export function authorizeOperatorOffline(input={}){
 try{
  const {operatorPacket,storePacket,operatorPins,storePins,expected,now}=input||{};
  if(!expected||!Object.values(expected).every(x=>typeof x==='string'))return DENY('MISSING_CONTEXT');
  const op=verifyPinnedPacket(operatorPacket,operatorPins,now);
  const st=verifyPinnedPacket(storePacket,storePins,now);
  if(!op||!st)return DENY('UNTRUSTED_ASSERTION');
  if(canonical(op)!=='aud,auth_time,exp,iat,issuer,mfa,operator_sub,role,session_id,store_id,tenant_id')return DENY('OPERATOR_CLAIMS');
  if(canonical(st)!=='aud,exp,iat,issuer,operator_sub,owner_version,role,store_id,tenant_id')return DENY('STORE_CLAIMS');
  if(!['issuer','tenant_id','store_id','operator_sub','session_id','role'].every(k=>check(op[k],k)))return DENY('OPERATOR_CLAIMS');
  if(!['issuer','tenant_id','store_id','operator_sub','owner_version','role'].every(k=>check(st[k],k)))return DENY('STORE_CLAIMS');
  if(!Number.isSafeInteger(op.auth_time)||op.auth_time>now||now-op.auth_time>300||op.mfa!==true)return DENY('MFA_STALE');
  if(!fixed(op.aud,'tien404-rpc173-operator-offline')||!fixed(st.aud,'tien404-rpc173-store-offline')||!fixed(op.issuer,expected.operator_issuer)||!fixed(st.issuer,expected.store_issuer))return DENY('WRONG_ISSUER');
  if(!['tenant_id','store_id','operator_sub'].every(k=>fixed(op[k],expected[k])&&fixed(st[k],expected[k])))return DENY('CROSS_STORE');
  if(!fixed(op.role,'merchant-owner')||!fixed(st.role,'merchant-owner'))return DENY('ROLE');
  if(!fixed(st.owner_version,expected.owner_version))return DENY('STALE_OWNERSHIP');
  if(!fixed(op.session_id,expected.session_id))return DENY('SESSION');
  if(operatorPacket.kid===storePacket.kid&&operatorPins[operatorPacket.kid]===storePins[storePacket.kid])return DENY('AUTHORITY_NOT_INDEPENDENT');
  return Object.freeze({accepted:true,can_upload:false,can_send:false,can_open_access:false,can_deploy:false,reason:'OFFLINE_IDENTITY_CONTRACT_ONLY'});
 }catch{return DENY('UNTRUSTED_ASSERTION');}
}
export function hostedSecurityDecision(){
 return DENY('REAL_AUTH_OWNER_APPROVAL_SCANNER_AND_HOSTED_LEDGER_NOT_VERIFIED');
}
