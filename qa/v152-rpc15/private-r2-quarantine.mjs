/**
 * TIEN404 RPC15 — SOURCE ONLY. Private R2 binding adapter.
 * Never exported as a public handler. Never accepts R2/S3 API tokens.
 * Expects a dedicated Worker binding: env.R2_QUARANTINE.
 * The caller is RPC14 after *server-verified* independent admission.
 * This adapter cannot verify identity, grant Owner status, scan malware,
 * approve Merchant evidence, retrieve evidence or release any object.
 */
export const EXPECTED_BUCKET='tien404-merchant-evidence-quarantine-staging';
export const BINDING='R2_QUARANTINE';
export const MAX_FILE_BYTES=8*1024*1024;
export const SOURCE_ONLY=true;
const HEX=/^[a-f0-9]{64}$/;
const KEY=/^quarantine\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const allowedKeys=new Set(['httpMetadata','customMetadata']);
const metadataKeys=new Set(['state','sha256']);
function deny(message){throw new Error('RPC15_'+message);}
function hexDigest(buffer){return [...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function createPrivateR2Quarantine(env){
 const bucket=env?.[BINDING];
 if(!bucket||typeof bucket.put!=='function')deny('PRIVATE_R2_BINDING_MISSING');
 // No .get/.list/.delete, endpoint, signed URL or public link is offered.
 return Object.freeze({
  async put(key,bytes,opts){
   if(typeof key!=='string'||!KEY.test(key))deny('INVALID_PRIVATE_OBJECT_KEY');
   if(!(bytes instanceof Uint8Array)||bytes.byteLength<16||bytes.byteLength>MAX_FILE_BYTES)
    deny('INVALID_QUARANTINE_BYTES');
   if(!opts||typeof opts!=='object'||Object.keys(opts).some(k=>!allowedKeys.has(k)))
    deny('UNTRUSTED_OPTIONS');
   const meta=opts.customMetadata;
   if(!meta||typeof meta!=='object'||Array.isArray(meta)||
      Object.keys(meta).length!==2||Object.keys(meta).some(k=>!metadataKeys.has(k))||
      meta.state!=='PENDING_MALWARE_SCAN'||typeof meta.sha256!=='string'||!HEX.test(meta.sha256))
    deny('UNTRUSTED_QUARANTINE_METADATA');
   // Prevent trusting the uploaded SHA claimed by an untrusted parser / adapter.
   const actual=hexDigest(await crypto.subtle.digest('SHA-256',bytes));
   if(actual!==meta.sha256)deny('CONTENT_DIGEST_MISMATCH');
   const expected=opts.httpMetadata;
   if(!expected||typeof expected!=='object'||
      Object.keys(expected).length!==1||expected.contentType!=='application/octet-stream')
    deny('UNSAFE_CONTENT_HEADERS');
   // R2 Workers API: R2PutOptions.onlyIf accepts Headers. If-None-Match:* is
   // an atomic create-only condition; null means precondition failed.
   const result=await bucket.put(key,bytes,{
    onlyIf:new Headers({'If-None-Match':'*'}),
    sha256:actual,
    httpMetadata:{
      contentType:'application/octet-stream',
      cacheControl:'private, no-store',
      contentDisposition:'attachment; filename="quarantined.bin"',
    },
    customMetadata:{state:'PENDING_MALWARE_SCAN',sha256:actual}
   });
   if(result===null)deny('OBJECT_KEY_ALREADY_EXISTS');
   if(!result||typeof result!=='object')deny('UNCONFIRMED_R2_WRITE');
   if(result.key!==undefined&&result.key!==key)deny('R2_KEY_MISMATCH');
   if(result.size!==undefined&&result.size!==bytes.byteLength)deny('R2_SIZE_MISMATCH');
   return Object.freeze({stored:true,quarantine:true,size:bytes.byteLength});
  }
 });
}