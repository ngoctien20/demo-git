'use strict';
// V17.2C.33 SOURCE-ONLY security contract. Never deployed or connected to
// production Messenger/Zalo/Commerce. This does not authenticate real webhooks.
// Every authority adapter is privileged and server-injected; no user JSON
// may choose tenant/store or elevate from READ_ONLY to ORDER_WRITE.
const crypto = require('node:crypto');
const CHANNELS = new Set(['messenger','zalo']);
const DENY = Object.freeze({status:'DENY',code:'CHANNEL_STORE_NOT_ADMITTED'});
function createTrustedChannelStoreBinding({
  verifyIngress, findInstallation, verifyStoreAuthority,
  consumeIngressOnce, readReleaseGate, hmacSecret, now = Date.now
}={}){
  if([verifyIngress,findInstallation,verifyStoreAuthority,consumeIngressOnce,readReleaseGate,now].some(f=>typeof f!=='function') ||
    typeof hmacSecret!=='string'||Buffer.byteLength(hmacSecret,'utf8')<32)
    throw Error('SERVER_SIDE_ADAPTERS_REQUIRED');
  return async function bind(request){
    // This is a private interface only, never exposed through a public route.
    if(!request||typeof request!=='object'||Array.isArray(request)||
      !Object.hasOwn(request,'rawIngress')||!Object.hasOwn(request,'proofHeaders')||
      // Never accept client-supplied privileged context or a requested write.
      ['tenantId','tenant_id','storeId','store_id','tenantRef','storeRef',
       'authorityVerified','isOwner','writeApproved','workflowId','role']
        .some(k=>Object.hasOwn(request,k)))return DENY;
    try{
      const release=await readReleaseGate();
      if(!release||release.syntheticOnly!==true||release.noSend!==true||
        release.noCommerceWrites!==true||release.hostedUatApproved!==false)return DENY;
      // Must perform provider-specific signature/HMAC validation against the
      // original raw bytes in the *trusted* ingress adapter, not JSON booleans.
      const verified=await verifyIngress({
        rawIngress:request.rawIngress,
        proofHeaders:request.proofHeaders
      });
      if(!verified||verified.signatureVerified!==true||verified.providerAttested!==true||
        !CHANNELS.has(verified.channel)||
        typeof verified.externalAccountRef!=='string'||
        !verified.externalAccountRef.length||verified.externalAccountRef.length>200||
        typeof verified.providerEventRef!=='string'||
        !verified.providerEventRef.length||verified.providerEventRef.length>200||
        !Number.isFinite(verified.timestampMs) ||
        Math.abs(now()-verified.timestampMs)>5*60*1000)return DENY;
      // Protected channel installation registry is not caller-supplied.
      const installation=await findInstallation({
        channel:verified.channel,externalAccountRef:verified.externalAccountRef
      });
      if(!installation||installation.active!==true||
        installation.channel!==verified.channel ||
        installation.externalAccountRef!==verified.externalAccountRef||
        typeof installation.tenantRef!=='string'||!installation.tenantRef||
        typeof installation.storeRef!=='string'||!installation.storeRef||
        typeof installation.installationRef!=='string'||!installation.installationRef||
        installation.provenanceVerified!==true)return DENY;
      const authority=await verifyStoreAuthority({
        tenantRef:installation.tenantRef,
        storeRef:installation.storeRef,
        installationRef:installation.installationRef
      });
      if(!authority||authority.verified!==true||authority.active!==true||
        authority.tenantRef!==installation.tenantRef||
        authority.storeRef!==installation.storeRef||
        authority.installationRef!==installation.installationRef)return DENY;
      // Atomic, single-use consumption is mandatory for provider event replay.
      // The adapter must use trusted storage and reject all duplicates.
      const once=await consumeIngressOnce({
        channel:verified.channel,
        externalAccountRef:verified.externalAccountRef,
        providerEventRef:verified.providerEventRef,
        installationRef:installation.installationRef
      });
      if(!once||once.insertedNew!==true||once.atomicVerified!==true)return DENY;
      const receipt=crypto.createHmac('sha256',hmacSecret)
        .update(JSON.stringify([
          installation.installationRef,installation.tenantRef,
          installation.storeRef,verified.channel,
          verified.externalAccountRef,verified.providerEventRef
        ])).digest('hex');
      // This reference is internal and scoped to READ-ONLY QA. It MUST NOT
      // authorize order writes or serve as a substitute for real actor Auth.
      return {status:'INTERNAL_READONLY_BINDING_NO_ORDER_AUTH',
        receiptRef:receipt,canSend:false,canWriteOrder:false,
        scope:'synthetic_catalog_readonly_no_send_no_write'};
    }catch{return DENY;}
  };
}
module.exports={createTrustedChannelStoreBinding};
