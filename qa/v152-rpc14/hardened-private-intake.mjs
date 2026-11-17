// RPC14: isolated OFFLINE intake implementation, NOT a deployed Worker.
// Production dependencies (signed Access policy, Auth verifier, durable ledger,
// rate limit, scanner, private store) must be independently approved and bound.
import {requireDualIdentity} from '../v152-rpc13/dual-verified-identity.mjs';

export const MAX_FILE_BYTES=8*1024*1024;
export const MAX_REQUEST_BYTES=MAX_FILE_BYTES+64*1024;
const TYPES=new Set(['MERCHANT_ORIGINAL_ONBOARDING','MERCHANT_ORIGINAL_CATALOG','SIGNED_EXTERNAL_ORDER_SOURCE','VERIFIED_MERCHANT_EXPORT']);
const SLOTS=new Set(['P1','P2','O1','O2']);
const encoder=new TextEncoder();
const response=(status,code,receiptId)=>new Response(JSON.stringify({status:code,...(receiptId?{receiptId}:{})}),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'",'referrer-policy':'no-referrer'}});
function fail(code){throw new Error(code);}
function mime(content){
 const s=content.headers.get('content-type')??'';
 return /^multipart\/form-data\s*;\s*boundary=[\w'()+_,.\/:=?-]{1,70}(?:\s*)$/i.test(s);
}
function validateLength(header){
 if(header===null)return true;
 if(!/^\d{1,12}$/.test(header))return false;
 return Number(header)<=MAX_REQUEST_BYTES;
}
async function readBoundedBody(request){
 const reader=request.body?.getReader(); if(!reader)fail('EMPTY_BODY');
 let total=0;const chunks=[];
 try{
  while(true){const {done,value}=await reader.read();if(done)break;
   if(!(value instanceof Uint8Array))fail('BODY_STREAM_INVALID');
   total+=value.byteLength;if(total>MAX_REQUEST_BYTES)fail('BODY_TOO_LARGE');
   chunks.push(value);
  }
 }catch(err){try{await reader.cancel();}catch{}throw err;}
 if(total<16)fail('BODY_TOO_SMALL');
 const out=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.byteLength;}
 return out;
}
function fileType(bytes){
 const n=bytes.length;
 if(n<16)return null;
 const start=new TextDecoder('utf-8',{fatal:false}).decode(bytes.slice(0,8));
 if(/^%PDF-1\.[0-9]/.test(start)){
  const tail=new TextDecoder().decode(bytes.slice(-Math.min(2048,n)));
  if(/%%EOF\s*$/.test(tail))return 'application/pdf';
 }
 if(n>=24 && [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b) &&
    bytes[n-8]===73&&bytes[n-7]===69&&bytes[n-6]===78&&bytes[n-5]===68)
   return 'image/png';
 if(n>=16&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes[n-2]===255&&bytes[n-1]===217)
  return 'image/jpeg';
 return null;
}
function dependenciesReady(cfg){
 const a=cfg?.admission;
 if(!a||a.enabled!==true||a.accessAppIndependent!==true||a.storagePrivate!==true||
    a.durableReplayReady!==true||a.rateLimitReady!==true||a.scannerReady!==true||
    a.retentionApproved!==true||a.operatorApproved!==true||
    a.independentReviewerReady!==true)return false;
 return typeof cfg.identityConfig==='object'&&typeof cfg.authority?.getInvitation==='function'&&
  typeof cfg.authority?.reserveOnce==='function'&&typeof cfg.authority?.finalize==='function'&&
  typeof cfg.authority?.markFailed==='function'&&typeof cfg.quarantine?.put==='function'&&
  typeof cfg.rateLimit?.admit==='function';
}
export function createHardenedPrivateIntake(cfg={}){
 return async request=>{
  if(request.method!=='POST'||new URL(request.url).pathname!=='/v2/private/evidence')return response(404,'NOT_FOUND');
  if(!dependenciesReady(cfg))return response(503,'PRIVATE_CHANNEL_NOT_AUTHORIZED');
  if(!mime(request))return response(415,'MULTIPART_REQUIRED');
  if(!validateLength(request.headers.get('content-length')))return response(413,'BODY_TOO_LARGE');
  if(!request.headers.has('cf-access-jwt-assertion')||!request.headers.has('authorization'))return response(403,'TWO_IDENTITIES_REQUIRED');
  let rate;
  try{rate=await cfg.rateLimit.admit(Object.freeze({scope:'preauth-merchant-upload',route:'/v2/private/evidence',method:'POST'}));}catch{return response(503,'RATE_GUARD_UNAVAILABLE');}
  if(rate!==true)return response(429,'RATE_GUARD_DENIED');
  let actor;
  try{actor=await requireDualIdentity(request,{...cfg.identityConfig,fetcher:cfg.fetcher??fetch});}
  catch{return response(403,'TWO_IDENTITIES_REQUIRED');}
  let form;
  try{
   const raw=await readBoundedBody(request);
   const parsed=new Request(request.url,{method:'POST',headers:{'content-type':request.headers.get('content-type')},body:raw});
   form=await parsed.formData();
  }catch(e){return response(e.message==='BODY_TOO_LARGE'?413:400,'BODY_REJECTED');}
  const fields=[...form.keys()];
  if(fields.length!==3||fields.some(x=>!['slot','source_type','source'].includes(x))||
     form.getAll('slot').length!==1||form.getAll('source_type').length!==1||form.getAll('source').length!==1)
   return response(400,'FIELDS_REJECTED');
  const slot=form.get('slot'),sourceType=form.get('source_type'),file=form.get('source');
  if(!SLOTS.has(slot)||!TYPES.has(sourceType)||!file||typeof file.arrayBuffer!=='function'||
     typeof file.size!=='number'||file.size<16||file.size>MAX_FILE_BYTES)
   return response(400,'SOURCE_REJECTED');
  let invitation;
  try{invitation=await cfg.authority.getInvitation(actor.authUserId,slot);}
  catch{return response(503,'INVITATION_SERVICE_UNAVAILABLE');}
  if(!invitation||invitation.status!=='ISSUED'||invitation.expiresAt<=Date.now()||
     !invitation.operatorSourceVerified||invitation.authUserId!==actor.authUserId||
     invitation.accessSubject!==actor.accessSubject||invitation.slot!==slot||
     invitation.sourceType!==sourceType||typeof invitation.id!=='string')
   return response(403,'PRIVATE_INVITATION_DENIED');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(fileType(bytes)!==file.type)return response(415,'UNSUPPORTED_CONTENT');
  const receiptId=crypto.randomUUID();
  let reserved=false;
  try{reserved=await cfg.authority.reserveOnce({inviteId:invitation.id,authUserId:actor.authUserId,accessSubject:actor.accessSubject,slot,sourceType,receiptId});}
  catch{return response(503,'INVITATION_REPLAY_GUARD_UNAVAILABLE');}
  if(reserved!==true)return response(409,'INVITATION_ALREADY_CONSUMED');
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  const key='quarantine/'+receiptId;
  try{
   await cfg.quarantine.put(key,bytes,{httpMetadata:{contentType:'application/octet-stream'},customMetadata:{state:'PENDING_MALWARE_SCAN',sha256}});
   if((await cfg.authority.finalize({receiptId,key,sha256,bytes:bytes.byteLength,state:'PENDING_MALWARE_SCAN'}))!==true)
    fail('FINALIZE_NOT_COMMITTED');
  }catch{
   try{await cfg.authority.markFailed({receiptId,state:'QUARANTINED_OR_FAILED'});}catch{}
   return response(503,'QUARANTINED_OR_FAILED');
  }
  return response(202,'QUARANTINED_PENDING_SCAN',receiptId);
 };
}
// No endpoint, static site, or upload adapter is provisioned by this file.
export const DEPLOYMENT_STATUS='SOURCE_ONLY_NOT_DEPLOYED';