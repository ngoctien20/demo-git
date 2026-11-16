'use strict';
/*
 * TIEN404 ADV.6C-RPC.3 — PRIVATE CALLER ATTESTATION / OFFLINE ONLY.
 *
 * A cryptographically valid packet is NOT independent evidence that a caller
 * inventory is complete. Do not confuse signatures over claims with actual
 * hosted observation. No raw logs, JWTs, phone numbers, sender IDs, API keys
 * or backup file bytes may be included in the packet.
 *
 * Trust anchors are provided independently, never from uploaded payload.
 * This library intentionally has NO live execution or approval method.
 */
const crypto=require('node:crypto');
const CONTRACT='T404_RPC3_CALLER_ATTESTATION_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const BASE='c4e042e56180c8aebb1e7ddc930bbc68b7a03507';
const REQUIRED=Object.freeze([
 'N8N_DRAFT_PUBLISHED_CALL_GRAPH',
 'CLOUDFLARE_WORKER_ACCOUNTS_AND_ROUTES',
 'SUPABASE_EDGE_FUNCTION_DEPENDENCIES',
 'POSTGREST_RPC_REQUEST_OBSERVATION',
 'EXTERNAL_OPERATOR_AND_MANUAL_SCRIPTS',
 'THIRD_PARTY_API_CLIENT_INVENTORY'
]);
const ROLES=Object.freeze(['CONTROLLER','SECURITY_REVIEWER','CHANNEL_OPERATOR']);
const b=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const id=x=>typeof x==='string'&&/^EV-[A-Z0-9]{12,40}$/.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const fail=x=>{const e=new Error(x);e.code=x;throw e};
const encode=(role,p)=>Buffer.from('T404:RPC3:CALLER-ATTESTATION:V1:'+role+':'+JSON.stringify(p),'utf8');
function createPrivateCallerIntake({mode,trustAnchors,nonceLedger,clock=()=>Date.now()}={}){
 if(mode!=='SYNTHETIC_NO_SEND'||!Array.isArray(trustAnchors)||
   trustAnchors.length!==ROLES.length||
   typeof nonceLedger?.claimOnce!=='function'||
   typeof clock!=='function')fail('RPC3_INDEPENDENT_TRUST_ENROLLMENT_MISSING');
 const keys=new Map(),actors=new Set(),roles=new Set();
 for(const a of trustAnchors){
   if(!exact(a,['keyId','actorDigest','role','publicKey'])||
     !id(a.keyId)||!b(a.actorDigest)||!ROLES.includes(a.role)||
     !(a.publicKey instanceof crypto.KeyObject)||
     a.publicKey.type!=='public'||a.publicKey.asymmetricKeyType!=='ed25519'||
     roles.has(a.role)||keys.has(a.keyId)||actors.has(a.actorDigest))
     fail('RPC3_SIGNER_ENROLLMENT_INVALID');
   roles.add(a.role);keys.set(a.keyId,a);actors.add(a.actorDigest);
 }
 if(roles.size!==ROLES.length)fail('RPC3_SIGNER_ENROLLMENT_INVALID');
 async function intake(packet){
   if(!exact(packet,['payload','signatures']))fail('RPC3_PACKET_SCHEMA_DENIED');
   const p=packet.payload;
   if(!exact(p,['contract','projectRef','parentSha','scope','issuedAtMs','expiresAtMs',
     'nonceHex','observationStart','observationEnd','records','decision'])||
     p.contract!==CONTRACT||p.projectRef!==PROJECT||p.parentSha!==BASE||
     p.scope!=='PRIVATE_CALLER_EVIDENCE_REVIEW_ONLY'||
     p.decision!=='REVIEW_ONLY_NO_EXECUTE'||
     !b(p.nonceHex))fail('RPC3_PACKET_SCOPE_DENIED');
   const now=clock();
   if(!Number.isSafeInteger(now)||!Number.isSafeInteger(p.issuedAtMs)||
      !Number.isSafeInteger(p.expiresAtMs)||p.issuedAtMs>now+10000||
      p.expiresAtMs<=now||p.expiresAtMs-p.issuedAtMs>600000||
      p.issuedAtMs>=p.expiresAtMs||
      typeof p.observationStart!=='string'||
      typeof p.observationEnd!=='string'||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(p.observationStart)||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(p.observationEnd)||
      !(Date.parse(p.observationStart)<Date.parse(p.observationEnd))||
      Date.parse(p.observationEnd)>now+10000)
      fail('RPC3_PACKET_WINDOW_OR_TTL_INVALID');
   if(!Array.isArray(p.records)||p.records.length!==REQUIRED.length)
     fail('RPC3_CALLER_DOMAINS_INCOMPLETE');
   const seenKinds=new Set(),seenRefs=new Set();
   for(const r of p.records){
     if(!exact(r,['domain','evidenceRef','sha256','observedAtMs',
       'independentlyInspected','coverageCertified'])||
       !REQUIRED.includes(r.domain)||!id(r.evidenceRef)||!b(r.sha256)||
       !Number.isSafeInteger(r.observedAtMs)||r.observedAtMs<=0||
       r.observedAtMs>now||typeof r.independentlyInspected!=='boolean'||
       typeof r.coverageCertified!=='boolean'||
       seenKinds.has(r.domain)||seenRefs.has(r.evidenceRef))
       fail('RPC3_CALLER_EVIDENCE_REFERENCE_INVALID');
     seenKinds.add(r.domain);seenRefs.add(r.evidenceRef);
   }
   if(REQUIRED.some(x=>!seenKinds.has(x)))fail('RPC3_CALLER_DOMAINS_INCOMPLETE');
   if(!Array.isArray(packet.signatures)||packet.signatures.length!==ROLES.length)
     fail('RPC3_THREE_INDEPENDENT_SIGNERS_REQUIRED');
   const signedRoles=new Set(),signedActors=new Set();
   for(const sig of packet.signatures){
     if(!exact(sig,['role','keyId','actorDigest','signatureBase64Url'])||
       !ROLES.includes(sig.role)||!id(sig.keyId)||!b(sig.actorDigest)||
       typeof sig.signatureBase64Url!=='string'||
       !/^[A-Za-z0-9_-]{80,100}$/.test(sig.signatureBase64Url)||
       signedRoles.has(sig.role)||signedActors.has(sig.actorDigest))
       fail('RPC3_DUPLICATE_OR_INVALID_SIGNER');
     const trusted=keys.get(sig.keyId);
     if(!trusted||trusted.role!==sig.role||
       trusted.actorDigest!==sig.actorDigest)
       fail('RPC3_SIGNER_NOT_ENROLLED');
     const signature=Buffer.from(sig.signatureBase64Url,'base64url');
     if(signature.length!==64||signature.toString('base64url')!==sig.signatureBase64Url||
       !crypto.verify(null,encode(sig.role,p),trusted.publicKey,signature))
       fail('RPC3_DETACHED_SIGNATURE_INVALID');
     signedRoles.add(sig.role);signedActors.add(sig.actorDigest);
   }
   if(ROLES.some(x=>!signedRoles.has(x)))fail('RPC3_THREE_INDEPENDENT_SIGNERS_REQUIRED');
   const nonceHash=crypto.createHash('sha256').update('RPC3|'+p.nonceHex).digest('hex');
   if(await nonceLedger.claimOnce(nonceHash,p.expiresAtMs)!==true)
     fail('RPC3_CALLER_PACKET_REPLAY_OR_LEDGER_UNAVAILABLE');
   const missing=p.records.filter(x=>!x.independentlyInspected||!x.coverageCertified).map(x=>x.domain);
   return Object.freeze({
     contract:CONTRACT,status:'SIGNED_METADATA_PENDING_PRIVATE_EVIDENCE_VALIDATION',
     signerRoles:ROLES.length,evidenceDomains:p.records.length,
     selfReportedCoverageGaps:Object.freeze(missing),
     independentRawLogsInspectedByThisCode:false,
     packetActualHostedCallerAttestation:false,
     providerWebhookSignatureCertified:false,
     completeExternalCallerInventoryCertified:false,
     rpcRevokeAuthorized:false,hostedWriteAuthorized:false,
     backupExportAuthorized:false,liveSendAuthorized:false,
     productionReleaseAuthorized:false
   });
 }
 return Object.freeze({intake,
   revoke(){fail('RPC3_RPC_REVOKE_DISABLED')},
   execute(){fail('RPC3_HOSTED_EXECUTION_DISABLED')},
   authorize(){fail('RPC3_APPROVAL_REQUIRES_EXTERNAL_AUTHORITY')}
 });
}
module.exports=Object.freeze({CONTRACT,PROJECT,BASE,REQUIRED,ROLES,createPrivateCallerIntake});