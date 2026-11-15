'use strict';
// TIEN404 SALES LITE V1.1 — isolated, deterministic, NO SEND / NO ORDER WRITE.
// This is a candidate for a trusted backend, NOT a Zalo provider callback contract.
// Channel controls MUST be bound to verified provider infrastructure separately.
const crypto=require('node:crypto');
const registry=require('./menu-registry.json');
const ROLES=new Set(['CUSTOMER','OWNER','MANAGER','TIEN404_SUPPORT','TIEN404_ADMIN','SYSTEM']);
const STATES=new Set(['MOCK_TESTED','TEXT_NUMBERED','TEXT_COMMAND']);
const ID=/^[A-Z][A-Z0-9_]{2,63}$/;
const fail=(x)=>{const e=new Error(x);e.code=x;throw e;};
const plain=(x)=>typeof x==='string'&&x.length>0&&x.length<2048;
const freeze=o=>Object.freeze(o);
function safeMoney(v) {
 if(!Number.isSafeInteger(v)||v<0)fail('UNTRUSTED_AMOUNT');
 return v.toLocaleString('vi-VN')+'đ';
}
function createMenuRegistry(source=registry) {
 if(!source||source.menu_version!=='1.1.0'||source.send_enabled!==false||
   source.order_write_enabled!==false||source.subscription_write_enabled!==false||
   !Array.isArray(source.menus)||source.menus.length<2)fail('MENU_REGISTRY_INVALID');
 const ids=new Set(),menus=new Map(),byId=new Map();
 const required=['action_id','menu_version','label','description','actor_role','action_type',
  'required_permissions','requires_confirmation','idempotency_policy','fallback_command',
  'next_state','enabled','channel_support'];
 for(const menu of source.menus){
  if(!plain(menu.menu_id)||!ROLES.has(menu.actor_role)||menus.has(menu.menu_id)||
     !Array.isArray(menu.actions)||menu.actions.length===0)fail('MENU_DEFINITION_INVALID');
  const numberCommands=new Set();
  for(const a of menu.actions){
   if(required.some(k=>!Object.hasOwn(a,k))||!ID.test(a.action_id||'')||ids.has(a.action_id)||
      a.menu_version!==source.menu_version||a.actor_role!==menu.actor_role||
      !plain(a.label)||a.label.length>72||!plain(a.description)||
      !Array.isArray(a.required_permissions)||a.required_permissions.some(p=>!plain(p))||
      typeof a.requires_confirmation!=='boolean'||typeof a.enabled!=='boolean'||
      !/^[1-9][0-9]?$/.test(a.fallback_command||'')||
      !Array.isArray(a.channel_support)||!a.channel_support.includes('ZALO_BOT_TEXT')||
      !a.channel_support.includes('MOCK_WEB')||
      !plain(a.next_state)||numberCommands.has(a.fallback_command)||
      (a.action_type==='WRITE_PROPOSAL'&&(!a.requires_confirmation||a.idempotency_policy!=='RECEIPT_REQUIRED')))
     fail('MENU_ACTION_CONTRACT_INVALID');
   numberCommands.add(a.fallback_command);
   ids.add(a.action_id);byId.set(a.action_id,freeze({...a,required_permissions:freeze([...a.required_permissions]),
    channel_support:freeze([...a.channel_support])}));
  }
  menus.set(menu.actor_role,freeze({menu_id:menu.menu_id,title:menu.title,actor_role:menu.actor_role,
    actions:freeze(menu.actions.map(a=>byId.get(a.action_id)))}));
 }
 return freeze({version:source.menu_version,menus,byId});
}
function createMenuRenderer(compiled=createMenuRegistry()) {
 function get(role){const m=compiled.menus.get(role);if(!m)fail('MENU_ROLE_NOT_SUPPORTED');return m;}
 function text(role,filter=()=>true) {
  const m=get(role),actions=m.actions.filter(x=>x.enabled&&filter(x));
  const result=[m.title,...actions.map(a=>a.fallback_command+' — '+a.label),'Nhắn số tương ứng hoặc mô tả nhu cầu bằng tiếng Việt.'].join('\n');
  if(result.length>2000)fail('ZALO_TEXT_LIMIT');
  return freeze({mode:'TEXT_NUMBERED',text:result,providerPayload:null,sendEnabled:false});
 }
 function mock(role,filter=()=>true) {
  const m=get(role);
  return freeze({mode:'MOCK_TESTED',menuVersion:compiled.version,title:m.title,
    actions:m.actions.filter(a=>a.enabled&&filter(a)).map(a=>freeze({action_id:a.action_id,
      label:a.label,command:a.fallback_command,disabled:false})),providerPayload:null,sendEnabled:false});
 }
 function render({role,mode='TEXT_NUMBERED',filter}) {
  if(!STATES.has(mode))fail('PROVIDER_MENU_CAPABILITY_UNVERIFIED');
  return mode==='MOCK_TESTED'?mock(role,filter):text(role,filter);
 }
 return freeze({render});
}
// These receipts are deliberately process-local. NEVER use as proof of persistence / exactly-once.
function createMenuSessionManager({clock=Date.now,ttlMs=30*60000,maxEvents=2500}={}) {
 const sessions=new Map(),events=new Map();
 function keepFresh(){
  const now=clock();
  for(const [k,x] of sessions)if(x.expiresAt<=now)sessions.delete(k);
  for(const [k,t] of events)if(t<=now)events.delete(k);
 }
 function get(scope) {
  if(!plain(scope))fail('SESSION_SCOPE_REQUIRED');keepFresh();
  return sessions.get(scope)||{phase:'IDLE',expiresAt:clock()+ttlMs};
 }
 function claim(scope,eventRef) {
  if(!plain(scope)||!plain(eventRef)||eventRef.length>128)fail('EVENT_RECEIPT_INVALID');
  keepFresh();const key=crypto.createHash('sha256').update(scope+'\0'+eventRef).digest('hex');
  if(events.has(key))return false;
  if(events.size>=maxEvents)fail('EVENT_RECEIPTS_FULL');
  events.set(key,clock()+ttlMs);return true;
 }
 function next(scope,phase) {
  const previous=get(scope);
  sessions.set(scope,{...previous,phase,expiresAt:clock()+ttlMs});
 }
 return freeze({mode:'SINGLE_PROCESS_QA_ONLY',get,claim,next,counts:()=>freeze({sessions:sessions.size,receipts:events.size})});
}
function createMenuAnalytics() {
 const counters=new Map();
 return freeze({record:(actionId,result)=>{
  if(!ID.test(actionId)||!plain(result)||result.length>70)fail('METRIC_INVALID');
  const k=actionId+':'+result;counters.set(k,(counters.get(k)||0)+1);
 },summary:()=>freeze(Object.fromEntries(counters)),mode:'NO_PII_QA_ONLY'});
}
function createMenuPermissionGuard({resolveContext}) {
 if(typeof resolveContext!=='function')fail('TRUSTED_RESOLVER_REQUIRED');
 const resolve=async(event)=>{
  const ctx=await resolveContext(event);
  // The resolver must live on a trusted server; THIS OBJECT IS NOT A CRYPTOGRAPHIC PROOF.
  if(!ctx||ctx.source!=='BACKEND_AUTHENTICATED_CONTEXT'||!ctx.isVerified||
    !ROLES.has(ctx.actorRole)||!plain(ctx.tenantId)||!plain(ctx.storeId)||
    !plain(ctx.botId)||!plain(ctx.scopeKey)||!Array.isArray(ctx.permissions)||
    !['ACTIVE','EXPIRED','SUSPENDED'].includes(ctx.subscriptionStatus)||
    !['OPEN','PAUSED'].includes(ctx.shopStatus))fail('BACKEND_ACTOR_UNVERIFIED');
  return ctx;
 };
 function allow(action,ctx) {
  if(!action.enabled)return 'MENU_ACTION_DISABLED';
  if(action.actor_role!==ctx.actorRole)return 'ROLE_DENIED';
  if(action.required_permissions.some(p=>!ctx.permissions.includes(p)))return 'PERMISSION_DENIED';
  if(action.action_type!=='HANDOFF'&&ctx.subscriptionStatus!=='ACTIVE'&&
     ctx.actorRole!=='TIEN404_SUPPORT')return 'SUBSCRIPTION_INACTIVE';
  if(ctx.actorRole==='CUSTOMER'&&ctx.shopStatus==='PAUSED'&&
     ['CUS_ORDER_DRAFT','CUS_EDIT_REQUEST'].includes(action.action_id))return 'SHOP_PAUSED';
  return null;
 }
 return freeze({resolve,allow});
}
function normalizeInput(event,ctx,compiled,verifyCallback) {
 if(!event||typeof event!=='object'||!plain(event.eventRef)||event.eventRef.length>128)
   fail('EVENT_INVALID');
 const m=compiled.menus.get(ctx.actorRole);
 if(!m)fail('MENU_ROLE_NOT_SUPPORTED');
 if(event.kind==='CALLBACK') {
  // No Zalo Bot callback schema has been verified. This path is ONLY for mocked
  // signed callbacks; must be OFF for live Zalo until official support proven.
  if(event.channel!=='MOCK_WEB'||typeof verifyCallback!=='function'||
     verifyCallback(event,ctx)!==true)fail('CALLBACK_PROVIDER_UNVERIFIED');
  if(event.menuVersion!==compiled.version)fail('STALE_MENU_VERSION');
  const action=compiled.byId.get(event.actionId);
  return action&&m.actions.some(x=>x.action_id===event.actionId)?action:null;
 }
 if(event.kind!=='TEXT'||typeof event.text!=='string'||event.text.length>512)
  fail('EVENT_UNSUPPORTED');
 if(event.menuVersion&&event.menuVersion!==compiled.version)fail('STALE_MENU_VERSION');
 const cmd=event.text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d')
  .trim().toLowerCase().replace(/\s+/g,' ');
 if(/^[0-9]+$/.test(cmd))return m.actions.find(a=>a.fallback_command===String(Number(cmd)))||null;
 const exact=m.actions.find(a=>a.action_id.toLowerCase()===cmd);
 if(exact)return exact;
 // Stable text aliases, scoped to the VERIFIED role.
 const aliases={
  'xem san pham':'CUS_CATALOG','hoi gia':'CUS_PRICE','dat hang':'CUS_ORDER_DRAFT',
  'don cua toi':'CUS_MY_ORDERS','sua yeu cau':'CUS_EDIT_REQUEST','ho tro':'CUS_SUPPORT',
  'don moi':'OWN_NEW_ORDERS','xac nhan don':'OWN_APPROVE_ORDER','tu choi don':'OWN_REJECT_ORDER',
  'tam nghi':'OWN_PAUSE_SHOP','mo ban':'OWN_OPEN_SHOP','bao cao':'OWN_REPORT',
  'ho tro tien404':'OWN_SUPPORT'
 };
 const id=aliases[cmd];
 return id?m.actions.find(a=>a.action_id===id)||null:null;
}
function createChannelMenuAdapter({capabilities={zalo_bot:['TEXT_NUMBERED','TEXT_COMMAND'],mock_web:['TEXT_NUMBERED','TEXT_COMMAND','MOCK_TESTED']}}={}) {
 return freeze({
  format({channel,mode='TEXT_NUMBERED',view}) {
   const supported=capabilities[channel]||[];
   if(!supported.includes(mode)||!view||view.mode!==mode)fail('CHANNEL_RENDER_MODE_UNVERIFIED');
   return freeze({channel,mode,view,externalSends:0,outboundEnabled:false,
    orderWrites:0,providerPayload:null,providerTested:false});
  },
  send:async()=>fail('ZALO_OUTBOUND_DISABLED'),
  status:'NO_SEND_QA_ONLY'
 });
}
function createMenuEngine({menuSource=registry,resolveContext,verifyCallback=null,sessionManager=createMenuSessionManager(),
  analytics=createMenuAnalytics(),clock=Date.now,readPorts={}}) {
 const compiled=createMenuRegistry(menuSource),render=createMenuRenderer(compiled),
  guard=createMenuPermissionGuard({resolveContext});
 const denied=(status,ctx=null,action=null,extras={})=>freeze({
  status,action_id:action?.action_id||null,actor_role:ctx?.actorRole||null,
  tenant_id:null,store_id:null, // never expose client-specified tenant scope
  ...extras,externalSends:0,ordersWritten:0,outboxWrites:0,subscriptionWrites:0,
  productionReady:false
 });
 async function handle(event) {
  const ctx=await guard.resolve(event);
  const action=normalizeInput(event,ctx,compiled,verifyCallback);
  if(!action)return denied('UNKNOWN_ACTION',ctx);
  const blocked=guard.allow(action,ctx);
  if(blocked){analytics.record(action.action_id,blocked);return denied(blocked,ctx,action);}
  if(!action.channel_support.includes(event.channel==='MOCK_WEB'?'MOCK_WEB':'ZALO_BOT_TEXT'))
   return denied('CHANNEL_UNSUPPORTED',ctx,action);
  const scope=ctx.scopeKey+':'+ctx.actorRole; // always backend-derived, never from user text
  if(!sessionManager.claim(scope,event.eventRef))return denied('DUPLICATE_EVENT',ctx,action);
  analytics.record(action.action_id,'ACCEPTED');
  sessionManager.next(scope,action.next_state);
  if(action.requires_confirmation)
    return denied('CONFIRMATION_REQUIRED',ctx,action,{next_state:action.next_state,
      writeProposed:true,confirmed:false,actionExecuted:false});
  if(action.action_type==='HANDOFF')
    return denied('HANDOFF_NOT_CONNECTED',ctx,action,{next_state:action.next_state,
      handoffConfirmed:false});
  if(action.action_type==='DRAFT')
    return denied('DRAFT_ONLY',ctx,action,{next_state:action.next_state,
      note:'Chưa ghi đơn hoặc tạo ticket. Chờ dịch vụ backend đã xác thực.'});
  if(action.action_type==='READ'){
   const port=readPorts[action.action_id];
   if(typeof port!=='function')return denied('READ_BACKEND_NOT_CONNECTED',ctx,action);
   const result=await port({tenantId:ctx.tenantId,storeId:ctx.storeId,botId:ctx.botId,
    actorRole:ctx.actorRole,actorKey:ctx.scopeKey,clock:clock()});
   if(!result||result.tenantId!==ctx.tenantId||result.storeId!==ctx.storeId||
      result.botId!==ctx.botId||result.verified!==true)
    return denied('READBACK_SCOPE_UNVERIFIED',ctx,action);
   if(action.action_id==='CUS_PRICE'||action.action_id==='CUS_CATALOG'){
    if(!Number.isSafeInteger(result.priceVnd)||result.priceVnd<1||
       !Number.isSafeInteger(result.stock)||result.stock<0||
       !Number.isFinite(Date.parse(result.observedAt))||
       clock()-Date.parse(result.observedAt)>60000||
       result.sku!=='F01')return denied('CATALOG_NOT_FRESH',ctx,action);
    return denied('READ_ONLY_PREVIEW',ctx,action,{next_state:action.next_state,
      replyCandidate:'[QA] F01 · '+safeMoney(result.priceVnd)+', tồn kho '+result.stock+'.',
      catalogMode:'BACKEND_VERIFIED_FIXTURE',observedAt:result.observedAt});
   }
   return denied('READ_ONLY_PREVIEW',ctx,action,{next_state:action.next_state,
    note:'Dữ liệu phạm vi shop đã xác minh tại backend. Không ghi hoặc gửi.'});
  }
  return denied('UNSUPPORTED_ACTION_TYPE',ctx,action);
 }
 return freeze({handle,render,sessionManager,analytics,compiled,
  runtimeStatus:'NOT_ATTACHED_TO_ZALO',sendEnabled:false,orderWriteEnabled:false});
}
module.exports={createMenuRegistry,createMenuRenderer,createMenuSessionManager,
 createMenuAnalytics,createMenuPermissionGuard,createChannelMenuAdapter,createMenuEngine};
