// RPC13 private Merchant evidence intake core. Not deployed. Quarantine-only.
import {requireDualIdentity} from './dual-verified-identity.mjs';
const TYPES=new Set(['MERCHANT_ORIGINAL_ONBOARDING','MERCHANT_ORIGINAL_CATALOG','SIGNED_EXTERNAL_ORDER_SOURCE','VERIFIED_MERCHANT_EXPORT']);
const SLOTS=new Set(['P1','P2','O1','O2']);
const MAX=8*1024*1024;
function response(status,body){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'"}});}
const magic=(b)=>b[0]===0x25&&b[1]===0x50&&b[2]===0x44&&b[3]===0x46?'application/pdf':b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47?'image/png':b[0]===0xff&&b[1]===0xd8&&b[2]===0xff?'image/jpeg':null;
export function createPrivateIntake({identityConfig,authority,quarantine,fetcher=fetch}){
 // NO default authority; no implicit acceptance of any Access or Supabase account.
 return async function handle(request){
  if(request.method!=='POST'||new URL(request.url).pathname!=='/v1/private/evidence')return response(404,{status:'NOT_FOUND'});
  if(!authority||!quarantine||!identityConfig)return response(503,{status:'PRIVATE_INTAKE_NOT_CONFIGURED'});
  let actor;try{actor=await requireDualIdentity(request,{...identityConfig,fetcher});}catch{return response(403,{status:'TWO_VERIFIED_IDENTITIES_REQUIRED'});}
  // The sole authoritative invitation is fetched by verified user ID from a private server-side registry.
  let form;try{form=await request.formData();}catch{return response(400,{status:'MALFORMED_INPUT'});}
  const slot=form.get('slot'),sourceType=form.get('source_type'),file=form.get('source');
  if(!SLOTS.has(slot)||!TYPES.has(sourceType)||!file||typeof file.arrayBuffer!=='function'||typeof file.size!=='number'||file.size<16||file.size>MAX)return response(400,{status:'SOURCE_REJECTED'});
  const invitation=await authority.getInvitation(actor.authUserId,slot);
  if(!invitation||invitation.status!=='ISSUED'||invitation.expiresAt<=Date.now()||!invitation.operatorSourceVerified||invitation.authUserId!==actor.authUserId||invitation.slot!==slot||invitation.accessSubject!==actor.accessSubject)return response(403,{status:'PRIVATE_INVITATION_REQUIRED'});
  const bytes=new Uint8Array(await file.arrayBuffer());const type=magic(bytes);
  if(!type||type!==file.type)return response(415,{status:'UNSUPPORTED_CONTENT'});
  const receiptId=crypto.randomUUID();
  // Atomic, one-use reservation must be implemented with durable server-side transactions.
  const reserved=await authority.reserve({receiptId,invitationId:invitation.id,authUserId:actor.authUserId,slot,sourceType});
  if(!reserved)return response(409,{status:'INVITATION_CONSUMED'});
  const checksum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  const key='quarantine/'+receiptId;
  try{
    await quarantine.put(key,bytes,{httpMetadata:{contentType:'application/octet-stream'},customMetadata:{status:'PENDING_MALWARE_SCAN',sha256:checksum}});
    await authority.finalize({receiptId,key,checksum,size:bytes.byteLength,status:'PENDING_MALWARE_SCAN'});
  }catch{
    // Failed finalization never makes evidence reviewed, approved or public.
    await authority.markFailed?.({receiptId});
    return response(503,{status:'UPLOAD_QUARANTINED_OR_FAILED'});
  }
  return response(202,{status:'QUARANTINED_PENDING_SCAN_AND_REVIEW',receiptId});
 };
}
export const INTAKE_NOT_DEPLOYED=true;