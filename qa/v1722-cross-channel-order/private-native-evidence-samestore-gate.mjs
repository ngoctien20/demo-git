/**
 * TIEN404 V17.22G — PRIVATE EVIDENCE STRUCTURAL ADMISSION, OFFLINE ONLY.
 *
 * Four independent cryptographically signed *metadata* reviews:
 * Meta protocol reviewer, Zalo BOT protocol reviewer, Merchant Owner
 * and Independent Security Reviewer, bound to one exact disposable Store.
 *
 * Even 4 valid Ed25519 signatures NEVER certify original provider evidence,
 * legal merchant ownership, production Page/OA permissions, real JWT, hosted
 * RLS or any permission to deploy/call APIs/send/order-write.
 * Real evidence must be reviewed privately outside this source fixture.
 * Never include passwords, tokens, JWT, PSID, chat IDs or customer records.
 */
import {createHash, verify} from 'node:crypto';
export const G_CONTRACT='T404_V1722G_PRIVATE_SAME_STORE_NOSEND_EVIDENCE_V1';
export const NOTE_CONTRACT='T404_V1722G_PRIVATE_REVIEW_NOTE_V1';
const FIELDS=['contract','ticket','nonce','tenantAlias','storeAlias','metaPageAlias',
 'zaloBotAlias','consentAlias','startedAtMs','expiresAtMs','isolatedNoSend',
 'productionUnchanged','commerceWritesDisabled','modelCallsDisabled',
 'privateOperatorOnly','recoveryGate'];
const NOTE_FIELDS=['contract','ticket','nonce','manifestHash','tenantAlias','storeAlias',
 'reviewRole','channel','installationAlias','evidenceAlias','method','observedAtMs',
 'scope','sourceProofAccepted'];
const RECEIPT_FIELDS=['keyId','actorAlias','reviewRole','claim','signature'];
const ROLES=['META_PROTOCOL_REVIEWER','ZALO_BOT_PROTOCOL_REVIEWER',
 'MERCHANT_OWNER','INDEPENDENT_SECURITY_REVIEWER'];
const PROTOCOLS=Object.freeze({
 META_PROTOCOL_REVIEWER:['messenger','META_RAW_HMAC_REVIEW_METADATA_ONLY'],
 ZALO_BOT_PROTOCOL_REVIEWER:['zalo_bot','ZALO_BOT_SHARED_HEADER_REVIEW_METADATA_ONLY'],
 MERCHANT_OWNER:['both','OWNER_ORIGINALS_PENDING_INDEPENDENT_REVIEW'],
 INDEPENDENT_SECURITY_REVIEWER:['both','SECURITY_ORIGINALS_PENDING_INDEPENDENT_REVIEW']
});
const REF=/^[A-Za-z0-9_:-]{8,100}$/;
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.getPrototypeOf(o)===Object.prototype&&Object.keys(o).length===keys.length&&
 keys.every(k=>Object.hasOwn(o,k));
const alias=x=>typeof x==='string'&&REF.test(x);
const sha=x=>createHash('sha256').update(x).digest('hex');
const manifestBytes=m=>Buffer.from(JSON.stringify(FIELDS.map(k=>m[k])),'utf8');
const noteBytes=n=>Buffer.from(JSON.stringify(NOTE_FIELDS.map(k=>n[k])),'utf8');
const deny=reason=>Object.freeze({status:'BLOCKED',reason,
 structurallySameStore:false,independentSignatureMathVerified:false,
 privateOriginalsReviewed:false,nativeMetaProviderVerified:false,
 nativeZaloBotProviderVerified:false,merchantOwnerVerified:false,
 realJWTStoreVerified:false,mayRunHostedNoSendCanary:false,
 mayReadCustomerOrders:false,maySend:false,mayWrite:false,
 providerSends:0,commerceWrites:0,modelCalls:0,mode:'OFFLINE_NO_SEND'});
export function inspectPrivateSameStoreEvidence({
 manifest,receipts,trustRegistry,nowMs
}={}){
 if(!exact(manifest,FIELDS)||manifest.contract!==G_CONTRACT||
    !/^EV-[A-Z0-9]{16,48}$/.test(manifest.ticket||'')||
    ![manifest.nonce,manifest.tenantAlias,manifest.storeAlias,manifest.metaPageAlias,
      manifest.zaloBotAlias,manifest.consentAlias].every(alias)||
    manifest.metaPageAlias===manifest.zaloBotAlias||
    !Number.isSafeInteger(nowMs)||nowMs<1||
    !Number.isSafeInteger(manifest.startedAtMs)||
    !Number.isSafeInteger(manifest.expiresAtMs)||
    nowMs<manifest.startedAtMs||nowMs>=manifest.expiresAtMs||
    manifest.expiresAtMs-manifest.startedAtMs>300000||
    manifest.isolatedNoSend!==true||
    manifest.productionUnchanged!==true||
    manifest.commerceWritesDisabled!==true||
    manifest.modelCallsDisabled!==true||
    manifest.privateOperatorOnly!==true||
    manifest.recoveryGate!=='DEFERRED_NOT_WAIVED')
  return deny('EXACT_PRIVATE_NO_SEND_MANIFEST_REQUIRED');

 if(!trustRegistry||trustRegistry.source!=='OPERATOR_PINNED_OFFLINE_KEYS'||
    trustRegistry.hostedEnabled!==false||trustRegistry.readonly!==true||
    typeof trustRegistry.getPublicKey!=='function')
  return deny('OFFLINE_PINNED_PUBLIC_KEYS_REQUIRED');
 if(!Array.isArray(receipts)||receipts.length!==4||
    !receipts.every(r=>exact(r,RECEIPT_FIELDS))||
    new Set(receipts.map(x=>x.reviewRole)).size!==4||
    ROLES.some(role=>!receipts.some(x=>x.reviewRole===role))||
    new Set(receipts.map(x=>x.keyId)).size!==4||
    new Set(receipts.map(x=>x.actorAlias)).size!==4)
  return deny('FOUR_INDEPENDENT_SIGNED_REVIEWERS_REQUIRED');

 const hash=sha(manifestBytes(manifest));
 const usedEvidence=new Set();
 for(const r of receipts){
   if(!alias(r.keyId)||!alias(r.actorAlias)||!ROLES.includes(r.reviewRole)||
      typeof r.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(r.signature))
     return deny('SIGNER_METADATA_INVALID');
   const n=r.claim,protocol=PROTOCOLS[r.reviewRole];
   if(!exact(n,NOTE_FIELDS)||n.contract!==NOTE_CONTRACT||
      n.ticket!==manifest.ticket||n.nonce!==manifest.nonce||
      n.manifestHash!==hash||n.tenantAlias!==manifest.tenantAlias||
      n.storeAlias!==manifest.storeAlias||
      n.reviewRole!==r.reviewRole||n.channel!==protocol[0]||
      n.method!==protocol[1]||n.scope!=='PRIVATE_NO_SEND_ONLY'||
      n.sourceProofAccepted!==false||
      n.installationAlias!==(protocol[0]==='messenger'?
       manifest.metaPageAlias:protocol[0]==='zalo_bot'?
       manifest.zaloBotAlias:'BOTH_CHANNELS')||
      !alias(n.evidenceAlias)||usedEvidence.has(n.evidenceAlias)||
      !Number.isSafeInteger(n.observedAtMs)||n.observedAtMs>nowMs||
      n.observedAtMs<manifest.startedAtMs)
     return deny('PROVIDER_OR_STORE_REVIEW_SCOPE_MISMATCH');
   usedEvidence.add(n.evidenceAlias);
   let record;
   try{record=trustRegistry.getPublicKey(r.keyId);}
   catch{return deny('PINNED_KEY_LOOKUP_UNAVAILABLE');}
   if(!record||record.keyId!==r.keyId||record.role!==r.reviewRole||
      record.actorAlias!==r.actorAlias||record.revoked!==false||
      record.active!==true||record.tenantAlias!==manifest.tenantAlias||
      record.storeAlias!==manifest.storeAlias||
      !Number.isSafeInteger(record.validFromMs)||
      !Number.isSafeInteger(record.validUntilMs)||
      record.validFromMs>nowMs||record.validUntilMs<=nowMs||
      record.publicKey?.asymmetricKeyType!=='ed25519')
     return deny('REVIEWER_KEY_OR_ROLE_NOT_INDEPENDENTLY_PINNED');
   let verified=false;
   try{
     const signature=Buffer.from(r.signature,'base64url');
     verified=signature.length===64&&signature.toString('base64url')===r.signature&&
       verify(null,noteBytes(n),record.publicKey,signature);
   }catch{verified=false;}
   if(!verified)return deny('SIGNED_PRIVATE_REVIEW_METADATA_INVALID');
 }
 // This is a mathematically valid FOUR-person mock/private metadata candidate,
 // NOT independent professional adjudication of original evidence.
 return Object.freeze({status:'STRUCTURAL_FOUR_REVIEWER_CANDIDATE_ONLY',
   structurallySameStore:true,independentSignatureMathVerified:true,
   metadataNotesVerified:4,manifestDigest:hash,
   privateOriginalsReviewed:false,nativeMetaProviderVerified:false,
   nativeZaloBotProviderVerified:false,merchantOwnerVerified:false,
   realJWTStoreVerified:false,mayRunHostedNoSendCanary:false,
   mayReadCustomerOrders:false,maySend:false,mayWrite:false,
   providerSends:0,commerceWrites:0,modelCalls:0,mode:'OFFLINE_NO_SEND'});
}

export function inspectIsolatedCanaryAdmission({evidenceResult,hostedSnapshot}={}){
 if(evidenceResult?.status!=='STRUCTURAL_FOUR_REVIEWER_CANDIDATE_ONLY'||
   evidenceResult.independentSignatureMathVerified!==true)
   return deny('PRIVATE_REVIEW_GATE_NOT_READY');
 if(hostedSnapshot?.source!=='SUPABASE_READ_ONLY_AGGREGATE'||
   hostedSnapshot.productionUnchanged!==true||
   hostedSnapshot.providerCredentialsNotRead!==true)
   return deny('PRIVATE_HOSTED_METADATA_READINESS_NOT_VERIFIED');
 if(hostedSnapshot.storesExists!==true||
    hostedSnapshot.storeMembershipsExists!==true||
    hostedSnapshot.channelLinksExists!==true||
    hostedSnapshot.storeScopedCommerceColumns!==6||
    hostedSnapshot.realOwnerApprovalIndependentlyVerified!==true)
  return deny('P0_CANONICAL_STORE_AND_OWNER_AUTHORITY_MISSING');
 // Even when future hosted structural data is present, this source-only gate
 // cannot certify original private evidence, provider identity or permissions.
 return Object.freeze({...deny('PRIVATE_ORIGINAL_PROVIDER_AND_JWT_INDEPENDENT_UAT_PENDING'),
    status:'INDEPENDENT_PRIVATE_REVIEW_NEEDED_NO_SEND_NO_EXECUTION',
    structurallySameStore:true,
    independentSignatureMathVerified:true});
}
export const privateEvidenceManifestHash=manifest=>sha(manifestBytes(manifest));
export const privateEvidenceNoteBytes=noteBytes;
