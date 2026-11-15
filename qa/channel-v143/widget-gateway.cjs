'use strict';
/* TIEN404 V14.3 — website AI chat widget: private registry & session contract.
 * SOURCE ONLY; server-side use; no HTTP, DB or AI call. ORIGIN is a heuristic
 * and must never authenticate a human or grant private Orders access.
 */
const {createHmac,timingSafeEqual,randomBytes}=require('node:crypto');
const {checkedUrl}=require('./channel-core.cjs');
const id=/^[a-z0-9_-]{2,90}$/i;
const fail=code=>{const e=new Error(code);e.code=code;throw e};
function origin(raw){
 let x;try{x=new URL(raw)}catch{fail('WIDGET_ORIGIN_INVALID')}
 if(x.protocol!=='https:'||x.username||x.password||x.pathname!=='/'||
  x.search||x.hash||x.port&&x.port!=='443')fail('WIDGET_ORIGIN_INVALID');
 return x.origin;
}
function locate(registry,widgetId,claimedOrigin){
 if(!id.test(widgetId||'')||!registry||registry.source!=='VERIFIED_PRIVATE_WIDGET_REGISTRY'||
    registry.verified!==true||!Array.isArray(registry.installations)||registry.installations.length>100)
   fail('WIDGET_REGISTRY_UNVERIFIED');
 const candidates=registry.installations.filter(i=>i?.widgetId===widgetId);
 if(candidates.length!==1)fail('WIDGET_NOT_FOUND_OR_AMBIGUOUS');
 const i=candidates[0];
 if(i.serverVerified!==true||i.status!=='RELEASED'||i.revoked===true||
   !id.test(i.tenantId||'')||!id.test(i.storeId||'')||
   i.subscriptionActive!==true||i.shopActive!==true||
   !Number.isSafeInteger(i.version)||i.version<1||
   !Array.isArray(i.allowedOrigins)||!i.allowedOrigins.length||
   i.allowedOrigins.length>10)fail('WIDGET_INSTALL_NOT_AUTHORIZED');
 const allowed=i.allowedOrigins.map(origin);
 const actual=origin(claimedOrigin);
 if(!allowed.includes(actual))fail('WIDGET_ORIGIN_NOT_ALLOWED');
 return Object.freeze({widgetId:i.widgetId,tenantId:i.tenantId,storeId:i.storeId,
   origin:actual,version:i.version,scopedByServer:true,anonymousOnly:true,
   personalOrderReadAllowed:false,previewOnly:true,providerSends:0,orderWrites:0});
}
function secret(s){
 if(typeof s!=='string'||Buffer.byteLength(s,'utf8')<32)
  fail('WIDGET_SERVER_KEY_REQUIRED');return s;
}
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function mac(s,payload){return createHmac('sha256',secret(s)).update('TIEN404/widget/session/v1|'+payload).digest('hex')}
function mint({install,serverSecret,now=Date.now(),nonce}={}){
 if(!install||install.scopedByServer!==true||install.previewOnly!==true||
   install.personalOrderReadAllowed!==false)fail('WIDGET_SCOPE_INVALID');
 const jti=nonce??randomBytes(18).toString('hex');
 if(!/^[a-f0-9]{36}$/.test(jti))fail('WIDGET_NONCE_INVALID');
 const body=b64({v:1,w:install.widgetId,t:install.tenantId,s:install.storeId,
   o:install.origin,c:install.version,j:jti,e:now+15*60*1000});
 return 'T404W1.'+body+'.'+mac(serverSecret,body);
}
function verify({install,session,serverSecret,now=Date.now()}={}){
 if(!install||install.scopedByServer!==true||typeof session!=='string'||
   session.length>2048)fail('WIDGET_SESSION_UNVERIFIED');
 const p=session.split('.');
 if(p.length!==3||p[0]!=='T404W1'||!/^[A-Za-z0-9_-]{30,1500}$/.test(p[1])||
    !/^[a-f0-9]{64}$/.test(p[2]))fail('WIDGET_SESSION_INVALID');
 const expect=mac(serverSecret,p[1]);
 if(!timingSafeEqual(Buffer.from(expect,'hex'),Buffer.from(p[2],'hex')))
   fail('WIDGET_SESSION_MAC_INVALID');
 let v;try{v=JSON.parse(Buffer.from(p[1],'base64url').toString('utf8'))}
 catch{fail('WIDGET_SESSION_INVALID')}
 if(v.v!==1||v.w!==install.widgetId||v.t!==install.tenantId||
   v.s!==install.storeId||v.o!==install.origin||v.c!==install.version||
   !/^[a-f0-9]{36}$/.test(v.j||'')||
   !Number.isSafeInteger(v.e)||v.e<=now||v.e>now+15*60*1000)
    fail('WIDGET_SESSION_EXPIRED_OR_FOREIGN');
 return Object.freeze({verified:true,tenantId:install.tenantId,storeId:install.storeId,
   widgetId:install.widgetId,origin:install.origin,anonymousOnly:true,
   // Persistent event uniqueness, quota, IP/anonymous abuse guard REQUIRED in hosted gateway.
   requiresDurableReplayGuard:true,requiresRateLimit:true,
   personalOrderReadAllowed:false,allowedOrderWrites:false,allowedProviderSends:false});
}
function theme(config,{allowedImageOrigins=[]}={}){
 if(!config||config.state!=='APPROVED'||config.source!=='STAFF_REVIEWED_WIDGET_CONFIG'||
  config.shopApproved!==true)fail('WIDGET_CONFIG_NOT_APPROVED');
 const color=x=>typeof x==='string'&&/^#[0-9a-fA-F]{6}$/.test(x);
 const str=(s,max)=>typeof s==='string'&&s.trim()&&s.length<=max&&
  !/[\u0000-\u001f\u007f<>]/.test(s);
 if(!color(config.primary)||!color(config.secondary)||
   !str(config.assistantName,60)||!str(config.welcomeMessage,400)||
   !['left','right'].includes(config.position)||
   !['compact','standard'].includes(config.layout)||
   !Array.isArray(config.suggestedActions)||config.suggestedActions.length>4||
   config.suggestedActions.some(x=>!str(x,40)))
    fail('WIDGET_THEME_INVALID');
 return Object.freeze({primary:config.primary,secondary:config.secondary,
   assistantName:config.assistantName.trim(),welcomeMessage:config.welcomeMessage.trim(),
   position:config.position,layout:config.layout,
   avatarUrl:checkedUrl(config.avatarUrl??null,allowedImageOrigins),
   suggestedActions:[...config.suggestedActions],
   previewOnly:true});
}
module.exports={origin,locate,mint,verify,theme};
