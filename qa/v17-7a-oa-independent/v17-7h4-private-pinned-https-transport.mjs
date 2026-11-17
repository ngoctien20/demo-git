/**
 * TIEN404 V17.7H.4 — PINNED PRIVATE HTTPS TRANSPORT, MANUAL OPT-IN ONLY.
 * This module is NEVER imported or executed in production/n8n/CI workflows.
 * Zalo Bot token is inserted in the official URL path, so absolutely NO logs,
 * redirects, retries, third-party SDK, proxies, error URLs or telemetry.
 * No setWebhook, sendMessage, deleteWebhook, getUpdates or outbound chat API.
 */
import https from 'node:https';

const HOST='bot-api.zaloplatforms.com';
const METHODS=new Set(['getMe','getWebhookInfo']);
const REDACT=()=>Error('PRIVATE_ZALO_READONLY_REQUEST_FAILED_REDACTED');
const safeToken=t=>typeof t==='string'&&t.length>=20&&t.length<=512&&
 /^[A-Za-z0-9._:-]+$/.test(t);

export function createPinnedZaloHttpsReadOnlyTransport({requestFn=https.request}={}){
 if(typeof requestFn!=='function')throw Error('INVALID_HTTPS_TRANSPORT');
 return Object.freeze({
  kind:'PINNED_ZALO_HTTPS_POST_READONLY',
  async postReadOnly(method,token){
   if(!METHODS.has(method)||!safeToken(token))
    throw Error('PRIVATE_READONLY_METHOD_OR_SECRET_DENIED');
   const target=new URL('https://'+HOST+'/bot'+token+'/'+method);
   // Fixed host, fixed method, never user controlled URL or redirect following.
   if(target.protocol!=='https:'||target.hostname!==HOST||
      target.username||target.password||target.port)
    throw Error('HOST_PIN_DENIED');

   return new Promise((resolve,reject)=>{
    let settled=false,req;
    const fail=()=>{if(!settled){settled=true;reject(REDACT());}};
    try{
     req=requestFn(target,{
      method:'POST',agent:false,rejectUnauthorized:true,minVersion:'TLSv1.2',
      headers:{
       'content-type':'application/json','accept':'application/json',
       'content-length':'2','cache-control':'no-store'
      }
     },res=>{
      // Node https.request does NOT follow HTTP redirects.
      if(res.statusCode!==200||
         !/^application\/json\b/i.test(res.headers['content-type']||'')){
       res.resume();fail();return;
      }
      const chunks=[];let size=0;
      res.on('data',chunk=>{
       if(settled)return;
       size+=chunk.length;
       if(size>8192){req.destroy();fail();return;}
       chunks.push(chunk);
      });
      res.on('error',fail);
      res.on('end',()=>{
       if(settled)return;
       let body;
       try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
       catch{fail();return;}
       settled=true;resolve(body);
      });
     });
     req.setTimeout(7000,()=>req.destroy());
     req.on('error',fail);
     req.end('{}');
    }catch{fail();}
   });
  }
 });
}
export const pinnedZaloApiHostname=HOST;
