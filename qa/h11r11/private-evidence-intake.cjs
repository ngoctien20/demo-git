'use strict';
/* TIEN404 H11R.11 — PRIVATE EVIDENCE INTAKE, SYNTHETIC CI ONLY.
 * Verifies signed metadata under independently enrolled trust keys. NEVER
 * represents actual merchant consent, source-log observation or approval.
 * Never read secrets, network or perform a hosted operation.
 */
const crypto=require('node:crypto');
const PROJECT='ifxlvrhyjhbzbrkdsida';
const PARENT_SHA='a2cbed8baf8c46a31ef85ffa03e9a10f95f85e57';
const KINDS=Object.freeze({
 CALLER:['CONTROLLER','SECURITY_REVIEWER','CHANNEL_OPERATOR'],
 STORE_OWNER:['MERCHANT_OWNER','SECURITY_REVIEWER','CHANNEL_OPERATOR'],
 RECOVERY:['CONTROLLER','SECURITY_REVIEWER','BACKUP_OPERATOR']
});
const DOMAINS=Object.freeze({
 CALLER:[
  'N8N_DRAFT_PUBLISHED_CALL_GRAPH',
  'CLOUDFLARE_WORKERS_ROUTES_AND_PAGES',
  'SUPABASE_EDGE_FUNCTION_DEPENDENCIES',
  'POSTGREST_REAL_REQUEST_OBSERVATION',
  'EXTERNAL_OPERATOR_MANUAL_SCRIPTS',
  'THIRD_PARTY_API_CLIENTS'
 ],
 RECOVERY:[
  'AUTH_AND_MEMBERSHIP_CONSISTENCY',
  'ROLES_AND_ACL',
  'STORAGE_AND_EXTERNAL_CONFIG',
  'OFFSITE_ENCRYPTION_AND_KEY_CUSTODY',
  'ISOLATED_RESTORE_AND_INTEGRITY',
  'RETENTION_AND_ERASURE_AUTHORIZATION'
 ]
});
const sha=x=>typeof x==='string' && /^[a-f0-9]{64}$/.test(x);
const no=x=>{const e=new Error(x);e.code=x;throw e;};
const pure=(o,keys)=>o!==null && typeof o==='object'&&!Array.isArray(o) &&
 Object.getPrototypeOf(o)===Object.prototype &&
 Object.keys(o).length===keys.length && keys.every(k=>Object.hasOwn(o,k));
const sigBytes=(role,payload)=>Buffer.from('T404:H11R11:PRIVATE-EVIDENCE:'+role+':'+JSON.stringify(payload),'utf8');
function createIntake({trustAnchors,claimNonce,now=()=>Date.now()}={}){
 if(!Array.isArray(trustAnchors)||trustAnchors.length!==5||
    typeof claimNonce!=='function'||typeof now!=='function')
    no('INDEPENDENT_ANCHORS_AND_NONCE_LEDGER_REQUIRED');
 const anchors=new Map(),actors=new Set(),roles=new Set(),publicKeys=new Set();
 for(const a of trustAnchors){
  if(!pure(a,['keyId','role','actorDigest','publicKey']) ||
    typeof a.keyId!=='string'||!/^[A-Z0-9_-]{8,60}$/.test(a.keyId)||
    !Object.values(KINDS).flat().includes(a.role)||
    !sha(a.actorDigest)||!a.publicKey||
    a.publicKey.type!=='public'||a.publicKey.asymmetricKeyType!=='ed25519'||
    actors.has(a.actorDigest)||roles.has(a.role)||anchors.has(a.keyId))
    no('INDEPENDENT_TRUST_ANCHOR_INVALID');
  const publicFingerprint=crypto.createHash('sha256').update(a.publicKey.export({format:'der',type:'spki'})).digest('hex');
  if(publicKeys.has(publicFingerprint))no('INDEPENDENT_TRUST_ANCHOR_INVALID');
  publicKeys.add(publicFingerprint);
  anchors.set(a.keyId,a);actors.add(a.actorDigest);roles.add(a.role);
 }
 const required=new Set(Object.values(KINDS).flat());
 if([...required].some(x=>!roles.has(x)))no('ALL_INDEPENDENT_ROLES_REQUIRED');

 async function intake(packet){
  if(!pure(packet,['payload','signatures']))no('EVIDENCE_PACKET_SHAPE');
  const p=packet.payload;
  if(!pure(p,['contract','kind','projectRef','parentSha','scope','issuedAtMs',
       'expiresAtMs','nonceHex','records','decision'])||
     p.contract!=='T404_H11R11_V1'||!Object.hasOwn(KINDS,p.kind)||
     p.projectRef!==PROJECT||p.parentSha!==PARENT_SHA||
     p.scope!=='SYNTHETIC_EVIDENCE_REVIEW_ONLY'||
     p.decision!=='NO_HOSTED_ACTION'||
     typeof p.nonceHex!=='string'||!/^[a-f0-9]{64}$/.test(p.nonceHex))
     no('INVALID_PROJECT_VERSION_OR_SCOPE');
  const ts=now();
  if(!Number.isSafeInteger(ts)||!Number.isSafeInteger(p.issuedAtMs)||
    !Number.isSafeInteger(p.expiresAtMs)||
    p.issuedAtMs>ts+5000||p.expiresAtMs<=ts||
    p.expiresAtMs-p.issuedAtMs>600000||
    p.issuedAtMs>=p.expiresAtMs)no('EVIDENCE_EXPIRED_OR_INVALID_TTL');
  const blockers=[];
  if(!Array.isArray(p.records))no('RECORDS_REQUIRED');
  if(p.kind==='STORE_OWNER'){
   const seen=new Set(),stats={PRODUCT:0,ORDER:0};
   if(p.records.length!==4)no('FOUR_LEGACY_ROW_PROOFS_REQUIRED');
   for(const r of p.records){
    if(!pure(r,['entity','rowDigest','tenantDigest','storeDigest',
       'ownerProofDigest','channelProofDigest','independentlyInspected'])||
       !Object.hasOwn(stats,r.entity)||
       ![r.rowDigest,r.tenantDigest,r.storeDigest,
         r.ownerProofDigest,r.channelProofDigest].every(sha)||
       typeof r.independentlyInspected!=='boolean'||
       seen.has(r.rowDigest))no('LEGACY_ROW_PROOF_INVALID_OR_CONFLICTING');
    seen.add(r.rowDigest);stats[r.entity]++;
    if(!r.independentlyInspected)blockers.push('OWNERSHIP_SOURCE_NOT_INSPECTED');
   }
   if(stats.PRODUCT!==2||stats.ORDER!==2)no('LEGACY_ROW_TYPE_COUNTS_NOT_MATCHED');
  }else{
   const requiredDomains=DOMAINS[p.kind];
   const seen=new Set();
   if(p.records.length!==requiredDomains.length)no('INCOMPLETE_EVIDENCE_DOMAINS');
   for(const r of p.records){
    if(!pure(r,['domain','evidenceSha256','independentlyInspected','coverageCertified'])||
       !requiredDomains.includes(r.domain)||!sha(r.evidenceSha256)||
       typeof r.independentlyInspected!=='boolean'||
       typeof r.coverageCertified!=='boolean'||seen.has(r.domain))
       no('EVIDENCE_DOMAIN_INVALID');
    seen.add(r.domain);
    if(!r.independentlyInspected||!r.coverageCertified)
      blockers.push('RAW_EVIDENCE_NOT_INDEPENDENTLY_ATTESTED');
   }
  }
  const req=KINDS[p.kind],seenSigners=new Set(),seenActors=new Set();
  if(!Array.isArray(packet.signatures)||packet.signatures.length!==req.length)
    no('THREE_DISTINCT_ROLE_SIGNATURES_REQUIRED');
  for(const s of packet.signatures){
   if(!pure(s,['role','keyId','actorDigest','signature'])||
      !req.includes(s.role)||seenSigners.has(s.role)||seenActors.has(s.actorDigest)||
      typeof s.signature!=='string'|| !/^[A-Za-z0-9_-]{80,100}$/.test(s.signature))
     no('DUPLICATE_OR_INVALID_SIGNER');
   const a=anchors.get(s.keyId);
   if(!a||a.role!==s.role||a.actorDigest!==s.actorDigest)
      no('SIGNER_NOT_INDEPENDENTLY_ENROLLED');
   const value=Buffer.from(s.signature,'base64url');
   if(value.length!==64||value.toString('base64url')!==s.signature||
       !crypto.verify(null,sigBytes(s.role,p),a.publicKey,value))
      no('INVALID_DETACHED_SIGNATURE');
   seenSigners.add(s.role);seenActors.add(s.actorDigest);
  }
  if(req.some(x=>!seenSigners.has(x)))no('SIGNER_ROLE_MISSING');
  const nonceHash=crypto.createHash('sha256').update('T404H11R11|'+p.nonceHex).digest('hex');
  if(await claimNonce(nonceHash,p.expiresAtMs)!==true)no('REPLAY_OR_LEDGER_UNAVAILABLE');
  return Object.freeze({
   contract:p.contract,kind:p.kind,
   status:blockers.length?'SIGNED_METADATA_GAPS':'SIGNED_METADATA_PENDING_EXTERNAL_VALIDATION',
   cryptographicMetadataChecked:true,
   metadataIssues:[...new Set(blockers)],
   realSignersIndependentlyAuthenticatedByThisCode:false,
   independentRawEvidenceActuallyInspectedByThisCode:false,
   legalOrMerchantAuthorityCertified:false,
   externalCallerInventoryCertified:false,
   authenticHostedBackupCertified:false,
   canRevokeRpc:false,canExportAuth:false,canApproveStore:false,
   canApplyMigration:false,canSendProvider:false,canMerge:false,
   productionReleaseAuthorized:false
  });
 }
 return Object.freeze({intake});
}
module.exports=Object.freeze({PROJECT,PARENT_SHA,KINDS,DOMAINS,createIntake,sigBytes});
