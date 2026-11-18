'use strict';
// V17.2C.24 — PRIVATE HTTPS ROUTE CANDIDATE ONLY; NOT DEPLOYED.
// Native Request/Response adapter. Backend and gates MUST come from trusted
// server construction, never user JSON. No public webhooks or sends.
const {URL}=require('node:url');
const MAX_BODY=1024;
const scope='synthetic_catalog_readonly_no_send_no_write';
const json=(status,body)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store, max-age=0','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer','x-frame-options':'DENY'}
});
const deny=(status=403)=>json(status,{status:'DENY'});
function createProtectedConsentHttpRoute({backend,allowedOrigin,verifyDeploymentGate,checkRateLimit}={}){
 if(!backend||typeof backend.intake!=='function'||typeof backend.reviewPair!=='function'||
  typeof allowedOrigin!=='string'||!/^https:\/\/[^/]+$/.test(allowedOrigin)||
  typeof verifyDeploymentGate!=='function'||typeof checkRateLimit!=='function')
  throw Error('PROTECTED_ROUTE_SERVER_CONFIG_MISSING');
 return async function handle(request){
  if(!request||typeof request.method!=='string')return deny();
  try{
   const target=new URL(request.url);
   if(target.origin!==allowedOrigin||request.headers.get('origin')!==allowedOrigin)
    return deny();
   if(request.method!=='POST')return deny(405);
   if(target.search||target.hash)return deny();
   const kind=target.pathname==='/private/qa-consent/intake'?'intake':
    target.pathname==='/private/qa-consent/review-pair'?'review':null;
   if(!kind)return deny(404);
   const gate=await verifyDeploymentGate();
   if(!gate||gate.approved!==true||gate.isolatedDisposable!==true||
      gate.noSend!==true||gate.recoveryApproved!==true||
      gate.independentReviewerApproved!==true)return deny();
   const rate=await checkRateLimit({kind,request});
   if(rate!==true)return deny(429);
   if((request.headers.get('content-type')||'').toLowerCase()!=='application/json')
    return deny(415);
   const len=request.headers.get('content-length');
   if(len!==null && (!/^\d+$/.test(len)||Number(len)>MAX_BODY))return deny(413);
   const auth=request.headers.get('authorization');
   if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(auth)||
      auth.length>8192)return deny(401);
   const raw=await request.text();
   if(Buffer.byteLength(raw,'utf8')>MAX_BODY)return deny(413);
   let body;try{body=JSON.parse(raw)}catch{return deny(400)}
   if(!body||typeof body!=='object'||Array.isArray(body))return deny(400);
   if(kind==='intake'){
    if(Object.keys(body).sort().join(',')!=='challenge,consentAction,requestedScope')
     return deny(400);
    if(body.consentAction!=='accept'||body.requestedScope!==scope||
       typeof body.challenge!=='string'||body.challenge.length<16||body.challenge.length>256)
      return deny(400);
    const out=await backend.intake({bearer:auth,requestedScope:body.requestedScope,
      consentAction:body.consentAction,challenge:body.challenge});
    if(out?.status!=='PRIVATE_CONSENT_RECORDED_NOT_UAT_GO')return deny();
    return json(202,{status:'PRIVATE_CONSENT_RECORDED_NOT_UAT_GO'});
   }
   if(Object.keys(body).length!==0)return deny(400);
   const out=await backend.reviewPair({reviewerBearer:auth});
   // Even passed private review must never implicitly admit real JWT UAT.
   if(out?.status!=='REVIEW_REQUIRED_NOT_JWT_GO')return deny();
   return json(202,{status:'REVIEW_REQUIRED_NOT_JWT_GO'});
  }catch{return deny();}
 };
}
module.exports={createProtectedConsentHttpRoute};
