'use strict';
// V17.2C.34 — PROTECTED ORDER WRITER *PREFLIGHT*, SOURCE-ONLY.
// No network/DB/order mutations. Returns NO_WRITE even when all gates pass.
// The legacy AI SALES DEMO Google Sheets lane is deliberately never promoted.
const DENY=Object.freeze({status:'DENY',reason:'ORDER_WRITER_NOT_ADMITTED'});
const ALLOWED_ACTIONS=new Set(['create_order','change_lines','preview_order_status']);
const ALLOWED_CHANNELS=new Set(['messenger','zalo']);
const CANDIDATE_WORKFLOW='commerce_v2_candidate_no_send';
const LEGACY_WORKFLOW_IDS=new Set([
  'Z7FdV7uDvApfbURQ','KrSn4DNR9ALX5ng4',
  'fDB9dvs1qPPVt9Sp','BkAi6TVUKAjCnI7v','4DFFCk60exrzaIl6'
]);
const validRef=x=>typeof x==='string'&&x.length>=3&&x.length<=200;
const money=x=>Number.isSafeInteger(x)&&x>=0;
function createProtectedOrderWriterPreflight({
 readReleaseGate,loadPrivateIntent,verifyActorSession,resolveInstallation,
 verifyStoreAuthority,loadOrder,loadVerifiedQuote,verifyConfirmation,
 checkIdempotency,verifyCrossChannelProof,now=Date.now
}={}){
 const deps=[readReleaseGate,loadPrivateIntent,verifyActorSession,
   resolveInstallation,verifyStoreAuthority,loadOrder,loadVerifiedQuote,
   verifyConfirmation,checkIdempotency,verifyCrossChannelProof,now];
 if(deps.some(f=>typeof f!=='function'))throw Error('PROTECTED_SERVER_ADAPTERS_REQUIRED');
 return async function preflight(request){
  // This public-looking wrapper accepts ONLY an opaque internal intentRef.
  // Source and authority are reloaded from a protected server registry.
  if(!request||typeof request!=='object'||Array.isArray(request)||
     Object.keys(request).length!==1||!validRef(request.intentRef))return DENY;
  try{
   const gate=await readReleaseGate();
   if(!gate||gate.syntheticOnly!==true||gate.noSend!==true||
      gate.noOrderWrites!==true||gate.allowHostedUat!==false||
      gate.legacyDemoSeparated!==true)return DENY;
   const intent=await loadPrivateIntent(request.intentRef);
   if(!intent||intent.intentRef!==request.intentRef||
      intent.sourceLane!=='commerce_v2_candidate'||
      intent.originWorkflowId!==CANDIDATE_WORKFLOW||
      LEGACY_WORKFLOW_IDS.has(intent.originWorkflowId)||
      !ALLOWED_ACTIONS.has(intent.action)||
      !validRef(intent.tenantRef)||!validRef(intent.storeRef)||
      !validRef(intent.installationRef)||!validRef(intent.actorSessionRef)||
      !validRef(intent.providerEventRef)||
      !validRef(intent.orderRef||'') && intent.action!=='create_order')return DENY;
   const actor=await verifyActorSession(intent.actorSessionRef);
   if(!actor||actor.verified!==true||actor.active!==true||
      actor.sessionCurrent!==true||actor.providerAuthenticated!==true||
      !Number.isFinite(actor.expiresAtMs)||actor.expiresAtMs<=now()||
      !validRef(actor.actorSubjectRef)||!validRef(actor.providerActorRef)||
      !validRef(actor.channel)||!validRef(actor.externalAccountRef)||
      actor.channel!==intent.channel||!ALLOWED_CHANNELS.has(actor.channel))return DENY;
   const installation=await resolveInstallation(intent.installationRef);
   if(!installation||installation.verified!==true||installation.active!==true||
      installation.installationRef!==intent.installationRef||
      installation.tenantRef!==intent.tenantRef||
      installation.storeRef!==intent.storeRef||
      installation.channel!==actor.channel||
      installation.externalAccountRef!==actor.externalAccountRef)return DENY;
   const authority=await verifyStoreAuthority({
      tenantRef:intent.tenantRef,storeRef:intent.storeRef,
      installationRef:intent.installationRef,actorSubjectRef:actor.actorSubjectRef
   });
   if(!authority||authority.verified!==true||authority.active!==true||
      authority.tenantRef!==intent.tenantRef||
      authority.storeRef!==intent.storeRef||
      authority.installationRef!==intent.installationRef||
      authority.actorSubjectRef!==actor.actorSubjectRef)return DENY;
   if(intent.action==='preview_order_status'){
      const order=await loadOrder(intent.orderRef);
      if(!order||order.tenantRef!==intent.tenantRef||order.storeRef!==intent.storeRef||
        order.orderRef!==intent.orderRef||order.ownershipAttested!==true||
        !validRef(order.originProviderActorRef)||!validRef(order.originChannel))return DENY;
      const sameChannel=order.originChannel===actor.channel&&
        order.originProviderActorRef===actor.providerActorRef;
      if(!sameChannel){
        if(!validRef(intent.crossChannelProofRef))return DENY;
        const proof=await verifyCrossChannelProof({
          proofRef:intent.crossChannelProofRef,orderRef:order.orderRef,
          tenantRef:order.tenantRef,storeRef:order.storeRef,
          originChannel:order.originChannel,
          originActorRef:order.originProviderActorRef,
          targetChannel:actor.channel,targetActorRef:actor.providerActorRef
        });
        if(!proof||proof.verified!==true||
          proof.scope!=='read_order_status_only'||
          proof.canWrite!==false||proof.canSend!==false)return DENY;
      }
      return {status:'SECURITY_PREFLIGHT_ONLY_NO_ORDER_WRITE',
        action:'preview_order_status',canReadOrderData:false,
        canWriteOrder:false,canSend:false};
   }
   // Cross-channel mutations are intentionally BLOCKED even if a read-only
   // link proof exists. Customer must use originally verified channel;
   // merchant-admin write requires a future distinct authorization contract.
   if(intent.action==='change_lines'){
      const order=await loadOrder(intent.orderRef);
      if(!order||order.orderRef!==intent.orderRef||
         order.tenantRef!==intent.tenantRef||order.storeRef!==intent.storeRef||
         order.ownershipAttested!==true||order.status!=='pending'||
         order.originChannel!==actor.channel||
         order.originProviderActorRef!==actor.providerActorRef)return DENY;
   }
   if(!validRef(intent.sku)||!Number.isSafeInteger(intent.quantity)||
      intent.quantity<1||intent.quantity>999||
      !money(intent.expectedTotalVnd))return DENY;
   const quote=await loadVerifiedQuote({
      tenantRef:intent.tenantRef,storeRef:intent.storeRef,sku:intent.sku
   });
   if(!quote||quote.tenantRef!==intent.tenantRef||
      quote.storeRef!==intent.storeRef||quote.sku!==intent.sku||
      quote.priceVerified!==true||quote.stockVerified!==true||
      quote.active!==true||!money(quote.unitPriceVnd)||
      !Number.isSafeInteger(quote.stockOnHand)||
      quote.stockOnHand<intent.quantity||
      !Number.isSafeInteger(quote.unitPriceVnd*intent.quantity)||
      quote.unitPriceVnd*intent.quantity!==intent.expectedTotalVnd)return DENY;
   // Confirmation belongs to the exact Store, actor, order, price and intent.
   const confirmation=await verifyConfirmation({
       intentRef:intent.intentRef,tenantRef:intent.tenantRef,
       storeRef:intent.storeRef,actorSubjectRef:actor.actorSubjectRef,
       action:intent.action,orderRef:intent.orderRef||null,
       expectedTotalVnd:intent.expectedTotalVnd
   });
   if(!confirmation||confirmation.verified!==true||
      confirmation.singleUseConsumed!==true||
      confirmation.sessionBound!==true||
      !Number.isFinite(confirmation.expiresAtMs)||
      confirmation.expiresAtMs<=now()||
      confirmation.intentRef!==intent.intentRef||
      confirmation.tenantRef!==intent.tenantRef||
      confirmation.storeRef!==intent.storeRef||
      confirmation.actorSubjectRef!==actor.actorSubjectRef||
      confirmation.action!==intent.action||
      confirmation.orderRef!==(intent.orderRef||null)||
      confirmation.expectedTotalVnd!==intent.expectedTotalVnd)return DENY;
   const idem=await checkIdempotency({
      intentRef:intent.intentRef,providerEventRef:intent.providerEventRef,
      tenantRef:intent.tenantRef,storeRef:intent.storeRef
   });
   if(!idem||idem.checked!==true||idem.unseen!==true)return DENY;
   // Checking for an existing event is NOT an atomic DB write guarantee.
   // Real commits must recheck all conditions inside a private DB transaction,
   // with unique (tenant,store,event), atomic stock decrement + rollback.
   return {status:'SECURITY_PREFLIGHT_ONLY_NO_ORDER_WRITE',
       action:intent.action,canWriteOrder:false,canSend:false,
       requiresAtomicCommit:true,requiresIndependentSecurityApproval:true};
  }catch{return DENY;}
 };
}
module.exports={createProtectedOrderWriterPreflight,LEGACY_WORKFLOW_IDS};
