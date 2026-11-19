/**
 * V18.3.6P — offline, cryptographically checked REVIEW REQUEST envelope.
 * A valid synthetic signature is NOT a real owner authorization.
 * This module NEVER reads function bodies, modifies ACLs or contacts Auth.
 */
import {verify, createPublicKey} from 'node:crypto';
import {reviewManifest} from '../v18.3.6o/secdef-manifest-review.mjs';

const HEX64=/^[0-9a-f]{64}$/;
const HTTPS=/^https:\/\//;
const result=(state,findings)=>Object.freeze({
  status:state,findings:Object.freeze([...new Set(findings)]),
  ownerIdentityExternallyVerified:false,
  reviewerIdentityExternallyVerified:false,
  functionBodyReadAuthorized:false,
  permissionWritesAllowed:false,
  realAuthAccessAllowed:false,
  productionAdmitted:false,
});
export const canonicalRequest=(r)=>JSON.stringify({
  protocol:'TIEN404_PRIVATE_SECDEF_REVIEW_REQUEST_P1',
  project:r.project,environment:r.environment,operation:r.operation,
  manifestCommit:r.manifestCommit,
  targetIdentityDigests:r.targetIdentityDigests,
  ownerActor:r.ownerActor,reviewerActor:r.reviewerActor,implementerActor:r.implementerActor,
  issuedAt:r.issuedAt,expiresAt:r.expiresAt,
  noFunctionBodyLogging:r.noFunctionBodyLogging,readOnly:r.readOnly,
  evidenceDestination:r.evidenceDestination,
  forbidsAuthSessions:r.forbidsAuthSessions,forbidsSecrets:r.forbidsSecrets,
  forbidsPrivilegeChanges:r.forbidsPrivilegeChanges,
});
export function assessPrivateReviewGate({manifest,request,ownerProof,reviewerProof,fixtureTrust},now){
 const fail=[];
 if(reviewManifest(manifest).status!=='READY_FOR_PRIVATE_REVIEW_SCOPE_REQUEST')fail.push('MANIFEST_METADATA_DRIFT');
 const r=request||{};
 if(r.protocol!=='TIEN404_PRIVATE_SECDEF_REVIEW_REQUEST_P1')fail.push('BAD_PROTOCOL');
 if(r.project!=='ifxlvrhyjhbzbrkdsida'||r.environment!=='STAGING')
   fail.push('TARGET_STAGING_ONLY');
 if(r.operation!=='READ_ONLY_PRIVATE_SOURCE_INSPECTION')fail.push('OPERATION_NOT_ALLOWED');
 if(!HEX64.test(r.manifestCommit||''))fail.push('COMMIT_SHA256_REQUIRED');
 const available=new Set((manifest?.functions||[]).map(f=>f.identity_sha256));
 if(!Array.isArray(r.targetIdentityDigests)||r.targetIdentityDigests.length<1||
   r.targetIdentityDigests.length>4||new Set(r.targetIdentityDigests).size!==r.targetIdentityDigests.length||
   r.targetIdentityDigests.some(x=>!HEX64.test(x)||!available.has(x)))
   fail.push('EXACT_MANIFEST_TARGETS_REQUIRED');
 if(typeof r.ownerActor!=='string'||r.ownerActor.length<3||
    typeof r.reviewerActor!=='string'||r.reviewerActor.length<3||
    typeof r.implementerActor!=='string'||r.implementerActor.length<3||
    new Set([r.ownerActor,r.reviewerActor,r.implementerActor]).size!==3)
   fail.push('THREE_DISTINCT_ACTORS_REQUIRED');
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(r.issuedAt)||
    !Number.isSafeInteger(r.expiresAt)||r.issuedAt>now||r.issuedAt<now-300||
    r.expiresAt<=now||r.expiresAt-r.issuedAt>3600)
   fail.push('SHORT_LIVED_REVIEW_WINDOW_REQUIRED');
 if(r.readOnly!==true||r.noFunctionBodyLogging!==true||
   r.forbidsAuthSessions!==true||r.forbidsSecrets!==true||
   r.forbidsPrivilegeChanges!==true)fail.push('STRICT_READ_ONLY_REDACTION_REQUIRED');
 if(typeof r.evidenceDestination!=='string'||!HTTPS.test(r.evidenceDestination)||
   !r.evidenceDestination.startsWith('https://private-review.example.invalid/'))
   fail.push('FIXTURE_PRIVATE_EVIDENCE_DESTINATION_REQUIRED');
 // Cryptographically validate fixture approvals. The input trust registry is
 // NOT the user's real identity registry and cannot authorize real access.
 const trusted=fixtureTrust?.mode==='SYNTHETIC_OFFLINE_TEST'
   &&fixtureTrust.ownerKey&&fixtureTrust.reviewerKey;
 if(!trusted)fail.push('TRUSTED_REAL_OWNER_REVIEWER_KEYS_NOT_ESTABLISHED');
 for(const [p,key,name] of [[ownerProof,fixtureTrust?.ownerKey,'OWNER'],
                            [reviewerProof,fixtureTrust?.reviewerKey,'REVIEWER']]){
   let good=false;
   try{
     good=!!trusted&&p?.algorithm==='Ed25519'&&typeof p.signature==='string'&&
       /^[a-f0-9]{128}$/.test(p.signature)&&
       verify(null,Buffer.from(canonicalRequest(r)),createPublicKey(key),
        Buffer.from(p.signature,'hex'));
   }catch{good=false;}
   if(!good)fail.push(name+'_SYNTHETIC_PROOF_INVALID');
 }
 if(fail.length)return result('BLOCKED_REVIEW_REQUEST',fail);
 return result('SYNTHETIC_SIGNATURES_PASS_PRIVATE_HUMAN_APPROVAL_STILL_REQUIRED',[]);
}
