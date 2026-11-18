'use strict';
/**
 * TIEN404 V18.5.1 Protected Website Widget HTTP ingress (OFFLINE CONTRACT).
 *
 * NOT HOSTED. NOT PRODUCTION. No listener, Worker deploy, real Access verifier,
 * database, Durable Object, secret provider, n8n call or customer traffic.
 * Reuses V18.5 -> V14.4 -> V14.3 existing Gateway/Renderer contracts.
 * Future hosted implementation must independently provide a cryptographically
 * verified Access principal, persistent atomic quota + replay, reviewed
 * installation registry and approved public-only catalog port.
 *
 * This module intentionally ONLY admits OFFLINE_SYNTHETIC_QA with mocked ports.
 * An HTTP Origin, browser-supplied widgetId, sessionStorage token, Referer or
 * raw Cf-Access-Jwt-Assertion are NEVER proofs of a person or Store authority.
 */
const {createOfflineSharedCoreWidget,MODES}=require('../channel-v185/shared-core-bridge.cjs');

const ROUTES=Object.freeze({
  session:'/widget/v18.5/session',
  message:'/widget/v18.5/message'
});
const BODY_LIMIT=4096;
const MESSAGE_LIMIT=800;
const MAX_WAIT_MS=8000;
const ALLOWED_SESSION=new Set(['widgetId','origin']);
const ALLOWED_MESSAGE=new Set(['widgetId','origin','session','eventId','message']);
const RECEIPT_SOURCE='MOCK_TRUSTED_CRYPTOGRAPHICALLY_VERIFIED_QA_ACCESS';
const SCOPE='V1851_PRIVATE_STAGING';
function rejected(code,status=403){
  const e=new Error('REQUEST_REJECTED');e.code=code;e.httpStatus=status;throw e;
}
function validOrigin(input) {
  if(typeof input!=='string'||input.length>240)rejected('ORIGIN_INVALID');
  let u;try{u=new URL(input)}catch{rejected('ORIGIN_INVALID')}
  if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||
    u.search||u.hash||(u.port&&u.port!=='443'))rejected('ORIGIN_INVALID');
  return u.origin;
}
function jsonResponse(status,data,origin=null) {
  const headers={
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store, max-age=0',
    'Pragma':'no-cache',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",
    'Vary':'Origin'
  };
  if(origin){
    headers['Access-Control-Allow-Origin']=origin;
    headers['Access-Control-Allow-Methods']='POST, OPTIONS';
    headers['Access-Control-Allow-Headers']='Content-Type';
    headers['Access-Control-Max-Age']='60';
  }
  return new Response(data===null?null:JSON.stringify(data),{status,headers});
}
async function boundedText(request,maxBytes){
  const rawLength=request.headers.get('content-length');
  if(rawLength!==null){
    if(!/^\d{1,9}$/.test(rawLength)||Number(rawLength)>maxBytes)
      rejected('BODY_TOO_LARGE',413);
  }
  const enc=request.headers.get('content-encoding');
  if(enc&&enc.toLowerCase()!=='identity')rejected('ENCODING_NOT_ALLOWED',415);
  if(!request.body)rejected('JSON_REQUIRED',400);
  const reader=request.body.getReader();
  const chunks=[];let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))rejected('BODY_INVALID',400);
      size+=value.byteLength;
      if(size>maxBytes)rejected('BODY_TOO_LARGE',413);
      chunks.push(value);
    }
  }finally{
    try{reader.releaseLock()}catch{}
  }
  const buffer=new Uint8Array(size);
  let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length}
  let str;
  try{str=new TextDecoder('utf-8',{fatal:true}).decode(buffer)}
  catch{rejected('BODY_NOT_UTF8',400)}
  return str;
}
function parseStrict(raw,route,origin){
  let data;try{data=JSON.parse(raw)}catch{rejected('JSON_INVALID',400)}
  if(!data||typeof data!=='object'||Array.isArray(data))
    rejected('JSON_OBJECT_REQUIRED',400);
  const allowed=route==='session'?ALLOWED_SESSION:ALLOWED_MESSAGE;
  if(Object.keys(data).some(k=>!allowed.has(k)) ||
     Object.getOwnPropertySymbols(data).length)
    rejected('CLIENT_SCOPE_OR_EXTRA_FIELD_DENIED',403);
  if(typeof data.widgetId!=='string'||!/^[A-Za-z0-9_-]{2,90}$/.test(data.widgetId))
    rejected('WIDGET_ID_INVALID',400);
  if(typeof data.origin!=='string'||validOrigin(data.origin)!==origin)
    rejected('ORIGIN_BODY_MISMATCH',403);
  if(route==='message'){
    if(typeof data.session!=='string'||data.session.length>2048||
       typeof data.eventId!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(data.eventId)||
       typeof data.message!=='string'||!data.message.trim()||
       data.message.length>MESSAGE_LIMIT||/[\u0000-\u001f\u007f]/.test(data.message))
      rejected('WIDGET_MESSAGE_OR_SESSION_INVALID',400);
  }
  return data;
}
function stripPublicPreview(result,mode){
  if(!result||result.status!=='PREVIEW_ONLY'||result.mode!==mode||
     result.privateOrderAccess!==false||result.providerSends!==0||
     result.orderWrites!==0||result.canRelease!==false)
    rejected('PRIVATE_RESULT_REJECTED',503);
  const data=result.publicPreview;
  if(!data||typeof data.text!=='string'||data.text.length>1400||
     typeof data.type!=='string'||!Array.isArray(data.products)||
     !Array.isArray(data.actions)||data.products.length>10||data.actions.length>8)
    rejected('PRESENTATION_INVALID',503);
  const products=data.products.map(p=>{
    if(!p||typeof p.sku!=='string'||p.sku.length>80||
      typeof p.name!=='string'||p.name.length>100||
      !Number.isSafeInteger(p.priceVnd)||p.priceVnd<0||
      !Number.isSafeInteger(p.stock)||p.stock<0 ||
      !(p.imageUrl===null||p.imageUrl===undefined||typeof p.imageUrl==='string'))
      rejected('PRODUCT_INVALID',503);
    return {
      sku:p.sku,name:p.name,priceVnd:p.priceVnd,stock:p.stock,
      imageUrl:p.imageUrl??null
    };
  });
  const actions=data.actions.map(a=>{
    if(!a||typeof a.id!=='string'||typeof a.label!=='string'||a.label.length>40)
      rejected('ACTION_INVALID',503);
    return {id:a.id,label:a.label,requiresConfirmation:a.requiresConfirmation===true};
  });
  // NO internalScope, tenantId, storeId, arbitrary model JSON or security token.
  return {
    mode,status:'PREVIEW_ONLY',channel:'WEB_WIDGET',
    publicPreview:{type:data.type,text:data.text,products,actions},
    privateOrderAccess:false,providerSends:0,orderWrites:0,canRelease:false
  };
}
async function withDeadline(task,ms){
  let clock;
  try{
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise((_,reject)=>{
        clock=setTimeout(()=>{
          const e=new Error('GATEWAY_TIMEOUT');e.code='GATEWAY_TIMEOUT';
          e.httpStatus=503;reject(e);
        },ms);
      })
    ]);
  }finally{if(clock!==undefined)clearTimeout(clock)}
}
function createProtectedOfflineGateway({
  qaMode='DISABLED',mode='PLATFORM_CONSULTANT',
  gatewayOrigin,allowedBrowserOrigins,verifyQaOperator,
  ports,serverSecret,now=Date.now,timeoutMs=3500
}={}){
  if(qaMode!=='OFFLINE_SYNTHETIC_QA'||!MODES.includes(mode)||
    !Array.isArray(allowedBrowserOrigins)||allowedBrowserOrigins.length<1||
    allowedBrowserOrigins.length>12||
    typeof verifyQaOperator!=='function'||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>MAX_WAIT_MS)
      rejected('SOURCE_ONLY_GATE_NOT_AUTHORIZED');
  const bound=validOrigin(gatewayOrigin);
  const allowed=new Set(allowedBrowserOrigins.map(validOrigin));
  if(allowed.size!==allowedBrowserOrigins.length)
    rejected('ORIGIN_LIST_DUPLICATE_OR_INVALID');
  const core=createOfflineSharedCoreWidget({
    qaMode:'OFFLINE_SYNTHETIC_QA',mode,ports,serverSecret,now
  });
  async function handle(request){
    let origin=null;
    try{
      if(!(request instanceof Request))rejected('INVALID_REQUEST',400);
      let url;
      try{url=new URL(request.url)}catch{rejected('BAD_ROUTE',404)}
      if(url.origin!==bound||url.search||url.hash)
        rejected('UNKNOWN_GATEWAY_OR_ROUTE',404);
      if(url.pathname!==ROUTES.session&&url.pathname!==ROUTES.message)
        rejected('UNKNOWN_GATEWAY_OR_ROUTE',404);
      // CORS only assists browser behavior. It is not admission identity.
      const claimedOrigin=request.headers.get('origin');
      if(!claimedOrigin)rejected('ORIGIN_REQUIRED',403);
      origin=validOrigin(claimedOrigin);
      if(!allowed.has(origin))rejected('ORIGIN_NOT_ALLOWED',403);
      if(request.method==='OPTIONS'){
        return jsonResponse(204,null,origin);
      }
      if(request.method!=='POST')rejected('METHOD_DENIED',405);
      if(request.headers.get('authorization'))
        rejected('UNEXPECTED_CLIENT_AUTH_HEADER',403);
      if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(
        request.headers.get('content-type')||''
      ))rejected('CONTENT_TYPE_DENIED',415);
      // Only a backend port with independently verified JWT signature, issuer,
      // audience, expiry, policy and revocation may produce this attestation.
      // The MOCK trust marker is FOR TESTS ONLY, NEVER a real verification.
      const access=await withDeadline(()=>verifyQaOperator(request),timeoutMs);
      if(!access||access.source!==RECEIPT_SOURCE||access.verified!==true||
        access.issuerVerified!==true||access.audienceVerified!==true||
        access.sessionUnexpired!==true||access.permitted!==true||
        access.scope!==SCOPE)
        rejected('ACCESS_DENIED',403);
      const raw=await withDeadline(()=>boundedText(request,BODY_LIMIT),timeoutMs);
      const kind=url.pathname===ROUTES.session?'session':'message';
      const body=parseStrict(raw,kind,origin);
      if(kind==='session'){
        const response=await withDeadline(
          ()=>core.issueSession({widgetId:body.widgetId,origin}),timeoutMs);
        if(!response||response.mode!==mode||response.privateOrderAccess!==false||
          response.providerSends!==0||response.orderWrites!==0||
          response.previewOnly!==true)
          rejected('SESSION_NOT_ALLOWED',503);
        return jsonResponse(200,{
          session:response.session,expiresInSeconds:response.expiresInSeconds,
          anonymous:true,previewOnly:true,mode,
          privateOrderAccess:false,providerSends:0,orderWrites:0
        },origin);
      }
      const result=await withDeadline(()=>core.previewMessage({
        widgetId:body.widgetId,origin,session:body.session,
        eventId:body.eventId,message:body.message
      }),timeoutMs);
      return jsonResponse(200,stripPublicPreview(result,mode),origin);
    }catch(error){
      // Never reflect untrusted input, secrets or internal tool error messages.
      const status=Number.isInteger(error?.httpStatus)?error.httpStatus:
        error?.code==='WIDGET_EVENT_REPLAY_OR_LEDGER_UNAVAILABLE'?409:
        error?.code==='WIDGET_QUOTA_DENIED_OR_UNVERIFIED'?429:403;
      const code=status===404?'NOT_FOUND':
        status===409?'REPLAY_DENIED':status===429?'RATE_LIMITED':
        status===413?'PAYLOAD_TOO_LARGE':
        status===503?'SERVICE_UNAVAILABLE':
        status===400?'BAD_REQUEST':status===405?'METHOD_NOT_ALLOWED':
        status===415?'UNSUPPORTED_MEDIA_TYPE':'NOT_AUTHORIZED';
      return jsonResponse(status,{error:code},origin&&allowed.has(origin)?origin:null);
    }
  }
  return Object.freeze({
    handle,releaseState:Object.freeze({
      mode:'OFFLINE_SYNTHETIC_QA',coreWorkflowId:core.coreWorkflowId,
      cloudflareWorkerDeployed:false,liveAccessJwksVerified:false,
      hostedD1Ledger:false,realRateLimit:false,realOwnerConsents:false,
      realCommerceCoreInvoked:false,customerRecordsRead:false,
      orderWrites:0,providerSends:0,productionReady:false
    })
  });
}
module.exports={createProtectedOfflineGateway,ROUTES,BODY_LIMIT,MESSAGE_LIMIT};
