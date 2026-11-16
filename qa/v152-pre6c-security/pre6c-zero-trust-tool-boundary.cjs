'use strict';
/*
 * TIEN404 Security P0/P1 pre-ADV.6C — SOURCE-ONLY, fail-closed tool boundary.
 * Integrates with the existing ADV.6 server-verified identity contract through
 * injected server callbacks. NOT connected to published n8n, Supabase, or AI.
 *
 * This code never executes orders, runs SQL, sends messages, exposes secrets or
 * invokes a model. Model instructions and arbitrary client flags NEVER grant
 * ownership, confirmation or a store scope.
 */
const VERSION='T404_PRE6C_ZERO_TRUST_TOOL_BOUNDARY_V1';
const ALLOWED=new Set(['CATALOG','QUOTE','POLICY','ORDER_STATUS','ORDER_REQUEST']);
const PRIVATE=new Set(['ORDER_STATUS','ORDER_REQUEST']);
const SAFE_REF=/^[a-zA-Z0-9:_./-]{1,128}$/;
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const exact=(o,keys)=>isObj(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const id=x=>typeof x==='string'&&SAFE_REF.test(x);
const safeTime=x=>Number.isSafeInteger(x)&&x>=0;
function createSafeToolBoundary({mode,identity,loadStoreState,quota,verifyCustomerOrderLink,
    verifyServerConfirmation,receiptNonce,clock=()=>Date.now()}={}){
  if(mode!=='SYNTHETIC_NO_SEND'||!identity||
     typeof identity.resolveVerifiedContext!=='function'||
     typeof identity.authorize!=='function'||
     typeof loadStoreState!=='function'||
     !quota||typeof quota.reserve!=='function'||
     typeof verifyCustomerOrderLink!=='function'||
     typeof verifyServerConfirmation!=='function'||
     !receiptNonce||typeof receiptNonce.claimOnce!=='function'||
     typeof clock!=='function')fail('SECURE_SERVER_DEPENDENCIES_REQUIRED');
  async function evaluate({identityRequest,target,action,resourceRef=null,
       confirmationProof=null,requestId,untrustedText=''}={}){
    // No SQL, admin, model-generated IDs/roles, arbitrary helper paths, or
    // client-asserted auth flags accepted in this envelope.
    if(!ALLOWED.has(action)||!isObj(target)||
       !exact(target,['tenant_id','store_id','channel'])||
       !id(target.tenant_id)||!id(target.store_id)||
       !['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET'].includes(target.channel)||
       !id(requestId)||requestId.length>120||
       (resourceRef!==null&&!id(resourceRef))||
       typeof untrustedText!=='string'||untrustedText.length>3500)
       fail('ACTION_OR_ENVELOPE_DENIED');
    const principal=await identity.resolveVerifiedContext(identityRequest);
    if(!isObj(principal)||
       principal.auth_source!=='SERVER_VERIFIED_JWT_OR_CHANNEL_BINDING'||
       principal.tenant_id!==target.tenant_id||
       principal.store_id!==target.store_id||
       principal.channel!==target.channel||
       !id(principal.subject_id)||!id(principal.recipient_binding))
       fail('SERVER_VERIFIED_STORE_SCOPE_REQUIRED');
    // For private actions we must check the customer/order link. A public order
    // id or phone alone NEVER authorizes status lookup or order creation.
    const authAction=action==='ORDER_STATUS'?'CATALOG':action;
    if(await identity.authorize({phase:'ISSUE',principal,action:authAction,
       resource_ref:resourceRef})!==true)fail('ACTION_NOT_AUTHORIZED');
    const current=clock();
    if(!safeTime(current))fail('SERVER_CLOCK_UNTRUSTED');
    const shop=await loadStoreState({
       tenant_id:principal.tenant_id,store_id:principal.store_id,
       channel:principal.channel
    });
    if(!isObj(shop)||shop.tenant_id!==principal.tenant_id||
       shop.store_id!==principal.store_id||shop.active!==true||
       shop.subscription_active!==true||shop.channel_allowed!==true)
       fail('SHOP_SUBSCRIPTION_OR_CHANNEL_BLOCKED');
    // Server-side quota port MUST be durable/atomic in production, and
    // MUST fail closed if unavailable. This is a synthetically injected port.
    const quotaKey={tenant_id:principal.tenant_id,store_id:principal.store_id,
      channel:principal.channel,subject_id:principal.subject_id,action,request_id:requestId};
    const allowed=await quota.reserve(quotaKey);
    if(!isObj(allowed)||allowed.allowed!==true||
       !Number.isSafeInteger(allowed.remaining)||allowed.remaining<0)
       fail('STORE_QUOTA_EXCEEDED_OR_UNVERIFIED');
    if(PRIVATE.has(action)){
      if(!id(resourceRef))fail('PRIVATE_RESOURCE_REFERENCE_REQUIRED');
      const owns=await verifyCustomerOrderLink({principal,action,order_ref:resourceRef});
      if(owns!==true)fail('CUSTOMER_ORDER_OWNERSHIP_UNVERIFIED');
    }
    if(action==='ORDER_REQUEST'){
      if(!id(confirmationProof))fail('SERVER_CONFIRMATION_PROOF_REQUIRED');
      const confirmed=await verifyServerConfirmation({
         principal,action,order_ref:resourceRef,
         confirmation_proof:confirmationProof,request_id:requestId
      });
      if(confirmed!==true)fail('SERVER_CONFIRMATION_NOT_VERIFIED');
      // Receipt-only claim: NOT the order writer transaction. The pending
      // Commerce writer requires a separate durable, DB-atomic idempotency gate.
      const claim=await receiptNonce.claimOnce({
        tenant_id:principal.tenant_id,store_id:principal.store_id,
        action,request_id:requestId
      });
      if(claim!==true)fail('ACTION_RECEIPT_REPLAY_OR_NONCE_UNAVAILABLE');
    }
    return Object.freeze({
      contract:VERSION,mode:'SYNTHETIC_NO_SEND',action,
      tenant_id:principal.tenant_id,store_id:principal.store_id,
      channel:principal.channel,
      status:action==='ORDER_REQUEST'?'ORDER_CONFIRMATION_VERIFIED_NO_WRITE':
        action==='ORDER_STATUS'?'PRIVATE_LOOKUP_AUTHORIZED_NO_READ':
        'ACTION_PREVIEW_ONLY',
      resultData:null,orderCreated:false,orderModified:false,stockModified:false,
      sqlExecuted:false,modelCalled:false,providerSent:false,hostedWrites:0,
      executionAuthorized:false
    });
  }
  const disabled=code=>()=>fail(code);
  return Object.freeze({VERSION,evaluate,
    execute:disabled('ORDER_TOOL_EXECUTION_DISABLED'),
    sql:disabled('ARBITRARY_SQL_DISABLED'),
    providerSend:disabled('PROVIDER_SEND_DISABLED'),
    publish:disabled('PUBLISH_GATE_CLOSED')});
}
module.exports=Object.freeze({VERSION,createSafeToolBoundary});