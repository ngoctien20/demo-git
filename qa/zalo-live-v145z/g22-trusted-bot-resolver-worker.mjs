/** TIEN404 AI V14.5Z-G2.2 — standalone STAGING / NO SEND resolver. */
import {resolveG22} from './g22-trusted-bot-resolver-core.mjs';
const ATTESTOR_PUBLIC_SPKI="MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE+U0a21Hh6CVxDLPonVXXvhScp9xxCn3c0X3/p1moK4H0iPgeQAWnRHOOXWH+aXHkZiSfy8ntSWq/zjdfJ1jAww==";
const PINNED_QA_SHOP_B_TENANT_SHA256="81902d42f087c86b28f5d986cce0f2101f79d6c55f7c9a3c3885d317c41fc994";
const META=Object.freeze({version:'V14.5Z-G2.2',environment:'ISOLATED_QA_STAGING',status:'OWNER_CERTIFICATION_PENDING',can_send:false,provider_sends:0,orders_written:0,customer_data_touched:false,owner_verified:false,real_commerce_ready:false});
function respond(status,body){
 return new Response(JSON.stringify(body),{status,headers:{
   'content-type':'application/json; charset=utf-8','cache-control':'no-store, private',
   'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
   'cross-origin-resource-policy':'same-origin','x-frame-options':'DENY'
 }});
}
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(path==='/health'&&request.method==='GET')return respond(200,{ok:true,...META,registry_write_routes:0,credential_bindings:0});
 if(path==='/v1/send'||path.startsWith('/webhook')||path.startsWith('/api/order')||path.startsWith('/v1/provider'))
  return respond(423,{ok:false,error:'G22_NO_SEND_LOCKED',...META});
 if(path!=='/v1/resolve-bot'||request.method!=='POST')
  return respond(404,{ok:false,error:'ROUTE_UNAVAILABLE',...META});
 if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')
  return respond(415,{ok:false,error:'JSON_ONLY',...META});
 if(Number(request.headers.get('content-length')||0)>3500)
  return respond(413,{ok:false,error:'REQUEST_TOO_LARGE',...META});
 let raw;try{raw=await request.text()}catch{return respond(400,{ok:false,error:'INVALID_BODY',...META})}
 if(!raw||raw.length>3500)return respond(413,{ok:false,error:'REQUEST_TOO_LARGE',...META});
 let body;try{body=JSON.parse(raw)}catch{return respond(400,{ok:false,error:'INVALID_JSON',...META})}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||!Object.hasOwn(body,'proof'))
  return respond(422,{ok:false,error:'PROOF_ONLY',...META});
 const evaluated=await resolveG22(body.proof,env?.G22_QA_DB,Date.now(),ATTESTOR_PUBLIC_SPKI,PINNED_QA_SHOP_B_TENANT_SHA256);
 return respond(evaluated.http_status,evaluated.body);
}};