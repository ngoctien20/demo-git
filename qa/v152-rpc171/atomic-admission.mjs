/** RPC17.1 — offline contract only. NO HOSTED LEDGER, NO SCANNER SERVICE, NO UPLOAD. */
import {createPublicKey,verify,timingSafeEqual,createHash} from 'node:crypto';
import {verifyInvite,checkFileEnvelope} from '../v152-rpc17/private-admission.mjs';
const DENY=(reason)=>Object.freeze({accepted:false,can_upload:false,can_send:false,can_open_access:false,reason});
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const ID=/^[a-zA-Z0-9_-]{2,128}$/;
export function scannerVerdict(envelope,expected,pins,now){
 try{
  if(!envelope||!ID.test(envelope.kid)||typeof envelope.payload!=='string'||typeof envelope.signature!=='string')return DENY('SCANNER_MALFORMED');
  if(!pins||!Object.hasOwn(pins,envelope.kid))return DENY('SCANNER_UNTRUSTED');
  const key=createPublicKey(pins[envelope.kid]);if(key.asymmetricKeyType!=='ed25519')return DENY('SCANNER_KEY_TYPE');
  const raw=Buffer.from(envelope.payload,'base64url');
  if(raw.length<2||raw.length>4096||raw.toString('base64url')!==envelope.payload)return DENY('SCANNER_MALFORMED');
  const sig=Buffer.from(envelope.signature,'base64url');
  if(sig.length!==64||sig.toString('base64url')!==envelope.signature||!verify(null,raw,key,sig))return DENY('SCANNER_SIGNATURE');
  const v=JSON.parse(raw.toString('utf8'));
  if(Object.keys(v).sort().join(',')!=='aud,digest,exp,iat,object_id,scanner_id,status,store_id,tenant_id')return DENY('SCANNER_CLAIMS');
  if(!Number.isSafeInteger(now)||!Number.isSafeInteger(v.iat)||!Number.isSafeInteger(v.exp)||v.iat>now||v.exp<=now||v.exp-v.iat>120)return DENY('SCANNER_EXPIRED');
  if(!equal(v.aud,'tien404-rpc171-offline-qa')||!equal(v.status,'CLEAN')||!equal(v.scanner_id,expected.scanner_id)||!equal(v.tenant_id,expected.tenant_id)||!equal(v.store_id,expected.store_id)||!equal(v.object_id,expected.object_id)||!equal(v.digest,expected.digest))return DENY('SCANNER_MISMATCH');
  return Object.freeze({accepted:true,can_upload:false,can_send:false,can_open_access:false,reason:'SCANNER_VERDICT_PREFLIGHT_ONLY'});
 }catch{return DENY('SCANNER_MALFORMED');}
}
/** Mock atomic implementation; NO durability across restarts/regions. */
export function createVolatileLedger({limit=3,windowMs=60000}={}){
 const claimed=new Set(),windows=new Map();
 return {isDurable:false,async claimAtomic({nonce,tenant_id,store_id,operator_sub,now}){
  if(![nonce,tenant_id,store_id,operator_sub].every(v=>typeof v==='string'&&ID.test(v))||!Number.isSafeInteger(now))return {ok:false,reason:'INVALID'};
  const key=JSON.stringify([tenant_id,store_id,operator_sub]),window=windows.get(key)||[];
  // Synchronous mutation occurs before first await. This guarantees mock serialization only.
  if(claimed.has(nonce))return {ok:false,reason:'REPLAY'};
  const live=window.filter(ts=>ts>now-windowMs&&ts<=now);
  if(live.length>=limit)return {ok:false,reason:'RATE_LIMIT'};
  claimed.add(nonce);live.push(now);windows.set(key,live);
  return {ok:true,reason:'MOCK_ATOMIC'};
 }};
}
/** Production must inject a separately operated, verified durable atomic store. */
export async function offlineAdmission({invitation,identity,invitePins,file,scanner,scanPins,object_id,ledger,now}={}){
 try{
  const invite=verifyInvite(invitation,identity,invitePins,now*1000);
  if(!invite.accepted)return DENY('INVITE_'+invite.reason);
  const f=checkFileEnvelope(file);
  if(!f.accepted)return DENY('FILE_'+f.reason);
  if(!Buffer.isBuffer(file.content)||file.content.length!==file.size)return DENY('FILE_BYTES_UNAVAILABLE');
  if(!ID.test(object_id))return DENY('OBJECT_ID');
  const digest=createHash('sha256').update(file.content).digest('hex');
  const expected={tenant_id:identity.tenant_id,store_id:identity.store_id,object_id,digest,scanner_id:'scanner-qa'};
  const scan=scannerVerdict(scanner,expected,scanPins,now);
  if(!scan.accepted)return DENY(scan.reason);
  if(!ledger||typeof ledger.claimAtomic!=='function')return DENY('LEDGER_UNAVAILABLE');
  const result=await ledger.claimAtomic({nonce:invite.nonce,tenant_id:identity.tenant_id,store_id:identity.store_id,operator_sub:identity.operator_sub,now:now*1000});
  if(!result||result.ok!==true)return DENY('LEDGER_'+(result?.reason||'FAIL_CLOSED'));
  // Even a production-grade ledger and scanner receipt are NOT authorization to expose upload.
  return Object.freeze({accepted:true,can_upload:false,can_send:false,can_open_access:false,reason:'OFFLINE_REHEARSAL_ONLY'});
 }catch{return DENY('SECURITY_DEPENDENCY_FAILURE');}
}
export function hostedAdmission(){return DENY('HOSTED_NO_GO_UNTIL_SEPARATE_APPROVAL');}
