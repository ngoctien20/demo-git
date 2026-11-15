'use strict';
/**
 * TIEN404 V14.5-LIVE03B: Trusted Messenger signed-fixture dispatch gateway.
 *
 * SAFE QA MODE ONLY. There is NO Meta HTTP transport, Google Sheets, order
 * connector, Supabase client, n8n subworkflow executor, or credential access.
 * Any proposed dangerous tool call is DENIED BEFORE CALL, not just discouraged
 * by an LLM prompt. Even the "confirm" action ONLY writes a temporary JS Map.
 *
 * IMPORTANT: This module is NOT attached to the Published Messenger bot.
 * Replay and simulated orders are process-local; NOT durable/atomic across
 * workers. Its trust boundary is fixture-only. No actual shop data or PII.
 */
const {createTrustedQaGate}=require('../messenger-live-gate-v145/trusted-webhook-qa.cjs');

const ALLOWED=new Set([
  'catalog.read','quote.read',
  'qa.order.prepare','qa.order.confirm','qa.order.cancel'
]);
const BLOCKED=new Set([
  'create_order','manage_order','update_order_address','update_order',
  'delete_order','confirm_order','reserve_stock','decrement_stock',
  'create_support_ticket','get_order_status','send_messenger_reply',
  'send_notification','execute_workflow','workflow.execute','http.request',
  'database.write','sheets.append','commerce.order.create','order.create'
]);
const SKU_RE=/^[A-Z][A-Z0-9]{1,19}$/;
const QA_CONFIRM=/^XAC NHAN (QA-[A-F0-9]{12})$/u;
const REQUEST_RE=/(?:\bdat\b|\bmua\b|\border\b|đặt|mua|đơn)/iu;
const DATA_NOTE='SYNTHETIC_QA_ONLY_NOT_A_REAL_ORDER';
const DENIAL_NOTE='NO_EXTERNAL_TOOL_CALL_PERFORMED';
function deny(code){
 return Object.freeze({allowed:false,status:'DENIED',reason:code,note:DENIAL_NOTE,
  externalToolCalls:0,googleSheetsWrites:0,hostedWrites:0,
  actualOrderWrites:0,stockWrites:0,providerSends:0,isRealOrder:false});
}
function assert(condition,code){
 if(!condition){const e=new Error(code);e.code=code;throw e;}
}
function plain(o){
 return o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;
}
function exact(o,keys){
 return plain(o)&&Object.keys(o).length===keys.length&&
  keys.every(k=>Object.hasOwn(o,k));
}
function output(state,record={}){
 return Object.freeze({allowed:true,status:state,dataSource:DATA_NOTE,
  externalToolCalls:0,googleSheetsWrites:0,hostedWrites:0,
  actualOrderWrites:0,stockWrites:0,providerSends:0,isRealOrder:false,
  ...record});
}
function createNoWriteQaDispatch({mode,appSecret,pageRegistry,catalog,now=Date.now}={}){
 assert(mode==='OFFLINE_NO_WRITE_QA'&&Array.isArray(pageRegistry)&&
   Array.isArray(catalog)&&catalog.length>0&&catalog.length<=20&&
   typeof now==='function','NO_WRITE_QA_CONFIG_INVALID');
 // Cryptographic trust is delegated to the existing independently tested
 // raw-byte HMAC, Page→Tenant→Store and replay boundary.
 const gate=createTrustedQaGate({
  mode:'OFFLINE_SIGNED_FIXTURE_ONLY',appSecret,pageRegistry,now
 });
 const stores=new Map();
 const pageBindings=new Map(pageRegistry.map(p=>[p.pageId,p]));
 for(const x of catalog){
  assert(plain(x)&&Object.keys(x).sort().join(',')==='name,pageId,priceVnd,sku,stock'&&
    typeof x.pageId==='string'&&pageBindings.has(x.pageId)&&
    SKU_RE.test(x.sku)&&typeof x.name==='string'&&
    x.name.length>=3&&x.name.length<=120&&
    Number.isSafeInteger(x.priceVnd)&&x.priceVnd>0&&x.priceVnd<=100000000&&
    Number.isSafeInteger(x.stock)&&x.stock>=0&&x.stock<=100000,
    'NO_WRITE_QA_CATALOG_INVALID');
  if(!stores.has(x.pageId))stores.set(x.pageId,new Map());
  assert(!stores.get(x.pageId).has(x.sku),'NO_WRITE_QA_DUPLICATE_SKU');
  stores.get(x.pageId).set(x.sku,Object.freeze({
   sku:x.sku,name:x.name,priceVnd:x.priceVnd,stock:x.stock
  }));
 }
 const sessions=new WeakMap();
 const pending=new Map(),simulated=new Map();
 const counts={accepted:0,denied:0,confirmedMocks:0};

 /**
  * Caller MUST supply raw exact bytes and x-hub-signature-256 from
  * a synthetic signed Meta fixture. Never take a caller-supplied "verified".
  * A session handle is local-only, unforgeable by normal structured JSON.
  */
 function ingress({rawBody,signature}={}){
  const result=gate.ingress({rawBody,signature});
  // Strict single event to avoid any cross-event action dispatch confusion.
  assert(result.acceptedEvents===1&&result.events.length===1&&
   result.duplicateEvents===0,'NO_WRITE_QA_ONE_FRESH_EVENT_REQUIRED');
  const parsed=JSON.parse(rawBody.toString('utf8'));
  assert(parsed.entry.length===1&&parsed.entry[0].messaging.length===1,
   'NO_WRITE_QA_ONE_EVENT_PER_BATCH');
  const event=parsed.entry[0].messaging[0];
  const trusted=result.events[0];
  assert(trusted.pageRef===parsed.entry[0].id&&
    typeof event.message.text==='string',
    'NO_WRITE_QA_EVENT_UNTRUSTED');
  const handle=Object.freeze({kind:'INTERNAL_OFFLINE_QA_HANDLE'});
  // Only internal state is authoritative; the LLM cannot make its own handle.
  sessions.set(handle,Object.freeze({
   ...trusted,verifiedText:event.message.text,
   contextKey:trusted.tenantId+'|'+trusted.storeId+'|'+trusted.senderScopeHash
  }));
  counts.accepted++;
  return handle;
 }
 function dispatch(handle,proposal){
  const scope=handle&&typeof handle==='object'?sessions.get(handle):null;
  if(!scope){counts.denied++;return deny('UNTRUSTED_SESSION_HANDLE');}
  if(!exact(proposal,['tool','arguments'])||typeof proposal.tool!=='string'||
    proposal.tool.length>70||!plain(proposal.arguments)){
   counts.denied++;return deny('MALFORMED_TOOL_PROPOSAL');
  }
  const toolName=proposal.tool;
  if(BLOCKED.has(toolName)||!ALLOWED.has(toolName)){
   counts.denied++;
   return deny(BLOCKED.has(toolName)?'WRITE_OR_EXTERNAL_TOOL_BLOCKED':'TOOL_NOT_ALLOWLISTED');
  }
  // Reject client/tool-supplied tenant/page/store/role/authorization data.
  const args=proposal.arguments;
  for(const k of Object.keys(args)){
   if(/^(page|pageId|tenant|tenantId|store|storeId|psid|sender|senderId|isAdmin|role|token|authorized|verified|force|dryRun|override)$/i.test(k)){
    counts.denied++;return deny('UNTRUSTED_SCOPE_OR_AUTHORIZATION_FIELD');
   }
  }
  const items=stores.get(scope.pageRef);
  if(!items){counts.denied++;return deny('QA_CATALOG_SCOPE_NOT_FOUND');}
  if(toolName==='catalog.read'){
   if(!exact(args,['sku'])||!SKU_RE.test(args.sku))return deny('INVALID_READ_ARGS');
   const row=items.get(args.sku);
   if(!row)return deny('SKU_NOT_IN_TRUSTED_STORE');
   return output('SYNTHETIC_CATALOG_RESULT',{product:row});
  }
  if(toolName==='quote.read'){
   if(!exact(args,['sku','quantity']))return deny('INVALID_QUOTE_ARGS');
   const row=items.get(args.sku),qty=args.quantity;
   if(!row)return deny('SKU_NOT_IN_TRUSTED_STORE');
   if(!Number.isSafeInteger(qty)||qty<1||qty>1000)return deny('INVALID_QTY');
   const amount=row.priceVnd*qty;
   if(!Number.isSafeInteger(amount))return deny('UNSAFE_TOTAL_VND');
   return output('SYNTHETIC_QUOTE',{sku:row.sku,unitPriceVnd:row.priceVnd,
    quantity:qty,totalVnd:amount,stockSnapshot:row.stock});
  }
  if(toolName==='qa.order.prepare'){
   if(!exact(args,['sku','quantity','expectedTotalVnd']))return deny('INVALID_PREPARE_ARGS');
   const row=items.get(args.sku),qty=args.quantity;
   if(!row)return deny('SKU_NOT_IN_TRUSTED_STORE');
   if(!Number.isSafeInteger(qty)||qty<1||qty>1000)return deny('INVALID_QTY');
   const amount=qty*row.priceVnd;
   if(!Number.isSafeInteger(args.expectedTotalVnd)||
      !Number.isSafeInteger(amount)||args.expectedTotalVnd!==amount)
    return deny('EXPECTED_TOTAL_MISMATCH');
   if(qty>row.stock)return deny('QA_STOCK_INSUFFICIENT');
   if(!REQUEST_RE.test(scope.verifiedText))
    return deny('NO_SIGNED_USER_ORDER_INTENT');
   if(pending.size>=1000&&!pending.has(scope.contextKey))
    return deny('PENDING_CAPACITY_FAIL_CLOSED');
   if(pending.has(scope.contextKey)&&
     pending.get(scope.contextKey).eventHash===scope.eventIdHash){
    const existing=pending.get(scope.contextKey);
    return output('AWAITING_EXPLICIT_QA_CONFIRMATION',
      {confirmationCode:existing.code,totalVnd:existing.total,
        quantity:existing.quantity,alreadyPrepared:true});
   }
   const code='QA-'+scope.eventIdHash.slice(0,12).toUpperCase();
   pending.set(scope.contextKey,Object.freeze({
    code,sku:row.sku,quantity:qty,total:amount,
    eventHash:scope.eventIdHash,storeId:scope.storeId,tenantId:scope.tenantId
   }));
   return output('AWAITING_EXPLICIT_QA_CONFIRMATION',
    {confirmationCode:code,totalVnd:amount,quantity:qty,alreadyPrepared:false});
  }
  if(toolName==='qa.order.confirm'){
   if(!exact(args,['confirmationCode'])||typeof args.confirmationCode!=='string'||
     !/^QA-[A-F0-9]{12}$/.test(args.confirmationCode))return deny('INVALID_CONFIRM_ARGS');
   const p=pending.get(scope.contextKey);
   if(!p)return deny('NO_PENDING_QA_REQUEST');
   if(p.code!==args.confirmationCode)return deny('CONFIRM_CODE_MISMATCH');
   const message=QA_CONFIRM.exec(scope.verifiedText);
   if(!message||message[1]!==p.code)
    return deny('EXPLICIT_SIGNED_CONFIRMATION_REQUIRED');
   const row=items.get(p.sku);
   if(!row||row.stock<p.quantity||row.priceVnd*p.quantity!==p.total)
    return deny('STALE_PRICE_OR_STOCK');
   const key=scope.contextKey+'|'+p.code;
   if(!simulated.has(key)){
    if(simulated.size>=1000)return deny('MOCK_CAPACITY_FAIL_CLOSED');
    simulated.set(key,Object.freeze({code:p.code,sku:p.sku,
       quantity:p.quantity,totalVnd:p.total,state:'SIMULATED_NOT_SAVED'}));
    counts.confirmedMocks++;
    return output('SIMULATED_QA_REQUEST_NOT_SAVED',{
      qaRequestCode:p.code,quantity:p.quantity,totalVnd:p.total,
      replay:false,physicalStockUnchanged:true});
   }
   return output('SIMULATED_QA_REQUEST_NOT_SAVED',{
      qaRequestCode:p.code,quantity:p.quantity,totalVnd:p.total,
      replay:true,physicalStockUnchanged:true});
  }
  if(toolName==='qa.order.cancel'){
   if(!exact(args,['confirmationCode'])||typeof args.confirmationCode!=='string')
     return deny('INVALID_CANCEL_ARGS');
   const p=pending.get(scope.contextKey);
   if(!p||p.code!==args.confirmationCode)return deny('NO_PENDING_QA_REQUEST');
   if(!/^HUY QA-[A-F0-9]{12}$/.test(scope.verifiedText)||scope.verifiedText!=='HUY '+p.code)
     return deny('EXPLICIT_SIGNED_CANCEL_REQUIRED');
   pending.delete(scope.contextKey);
   return output('QA_REQUEST_CANCELLED_NOT_SAVED',{physicalStockUnchanged:true});
  }
  counts.denied++;
  return deny('DEFAULT_DENY');
 }
 function inspect(){
  return Object.freeze({
    mode:'OFFLINE_NO_WRITE_QA',trustedSignedFixtureOnly:true,
    noRealMetaPageOrPageToken:true,activeExternalTransport:false,
    attachedToPublishedMessenger:false,credentialsUsed:0,
    boundSyntheticPages:pageBindings.size,
    pendingQaRequestsInMemory:pending.size,
    confirmedQaRequestsInMemory:simulated.size,
    acceptedSignedFixtureEvents:counts.accepted,
    deniedExternalToolCalls:counts.denied,
    actualOrderWrites:0,stockWrites:0,providerSends:0,
    durableReplayAcrossProcesses:false,realMessengerOrderPilotAuthorized:false
  });
 }
 return Object.freeze({ingress,dispatch,inspect});
}
module.exports={createNoWriteQaDispatch,ALLOWED_TOOLS:Object.freeze([...ALLOWED])};
