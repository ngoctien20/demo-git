/** RPC17 pure, offline admission gate. NEVER authorizes upload or hosted access. */
import {createPublicKey, verify, timingSafeEqual} from 'node:crypto';
const RX=/^[A-Za-z0-9_-]{16,6000}$/;
const exact=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const deny=(reason)=>Object.freeze({accepted:false, can_upload:false, can_open_access:false, can_send:false, reason});
export function verifyInvite(envelope, context, pinnedKeys, now=Date.now()){
  try {
    if(!envelope||typeof envelope!=='object'||!RX.test(envelope.payload)||!RX.test(envelope.signature)||typeof envelope.kid!=='string')return deny('MALFORMED');
    if(!context||typeof context!=='object'||!pinnedKeys||!Object.hasOwn(pinnedKeys,envelope.kid))return deny('UNTRUSTED_KEY');
    const pem=pinnedKeys[envelope.kid];
    const key=createPublicKey(pem);
    if(key.asymmetricKeyType!=='ed25519')return deny('BAD_KEY_TYPE');
    const payloadBytes=Buffer.from(envelope.payload,'base64url');
    if(payloadBytes.length>4096 || payloadBytes.length===0 || payloadBytes.toString('base64url')!==envelope.payload)return deny('MALFORMED');
    const sig=Buffer.from(envelope.signature,'base64url');
    if(sig.length!==64 || sig.toString('base64url')!==envelope.signature || !verify(null,payloadBytes,key,sig))return deny('BAD_SIGNATURE');
    const p=JSON.parse(payloadBytes.toString('utf8'));
    const keys=Object.keys(p).sort().join(',');
    if(keys!=='aud,exp,iat,invitation_id,issuer,nonce,operator_sub,scope,store_id,tenant_id')return deny('CLAIMS');
    if(!['tenant_id','store_id','invitation_id','nonce','operator_sub','issuer','aud','scope'].every(k=>typeof p[k]==='string'&&p[k].length>=3&&p[k].length<=128))return deny('CLAIMS');
    if(!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.exp<=p.iat||p.exp-p.iat>300||Math.abs(now/1000-p.iat)>300||now/1000>=p.exp)return deny('TIME');
    if(!exact(p.aud,'tien404-rpc17-offline-qa')||!exact(p.scope,'merchant.evidence.preflight')||!exact(p.issuer,context.issuer)||!exact(p.tenant_id,context.tenant_id)||!exact(p.store_id,context.store_id)||!exact(p.operator_sub,context.operator_sub))return deny('AUTHORITY');
    return Object.freeze({accepted:true,can_upload:false,can_open_access:false,can_send:false,reason:'OFFLINE_PREFLIGHT_ONLY',nonce:p.nonce,invitation_id:p.invitation_id});
  }catch{return deny('MALFORMED');}
}
export function checkFileEnvelope(file){
  if(!file||typeof file!=='object'||typeof file.name!=='string'||typeof file.mime!=='string'||!Number.isSafeInteger(file.size)||file.size<1||file.size>5*1024*1024)return deny('FILE_METADATA');
  if(file.name.length>120||/[\\/\x00-\x1f\x7f]/.test(file.name)||file.name.includes('..'))return deny('FILE_NAME');
  // Header-only sniffing is not malware scanning, full parsing or CDR.
  const bytes=Buffer.isBuffer(file.head)?file.head:Buffer.from(file.head||[]);
  const pdf= file.mime==='application/pdf'&&/\.pdf$/i.test(file.name)&&bytes.subarray(0,5).equals(Buffer.from('%PDF-'));
  const png= file.mime==='image/png'&&/\.png$/i.test(file.name)&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg= file.mime==='image/jpeg'&&/\.jpe?g$/i.test(file.name)&&bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!(pdf||png||jpg))return deny('FILE_SIGNATURE');
  return Object.freeze({accepted:true,can_upload:false,can_open_access:false,can_send:false,reason:'METADATA_ONLY_SCANNER_REQUIRED'});
}
export function createMockAdmissionLimiter({limit=3,windowMs=60000}={}){
  const hits=new Map(),used=new Set();
  return {check({key,nonce,now}){
    if(typeof key!=='string'||!key||typeof nonce!=='string'||!nonce||!Number.isFinite(now))return deny('INPUT');
    if(used.has(nonce))return deny('REPLAY');
    const prev=(hits.get(key)||[]).filter(t=>t>now-windowMs&&t<=now);
    if(prev.length>=limit)return deny('RATE_LIMIT');
    prev.push(now);hits.set(key,prev);used.add(nonce);
    return Object.freeze({accepted:true,can_upload:false,can_open_access:false,can_send:false,reason:'MOCK_ONLY'});
  }};
}
export function hostedDecision(){return deny('HOSTED_SECURITY_GATES_UNMET');}
