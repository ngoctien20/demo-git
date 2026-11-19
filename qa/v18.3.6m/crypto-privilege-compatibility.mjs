/**
 * TIEN404 V18.3.6M — metadata-only crypto verifier and SQL exposure review.
 * Ed25519 can be checked in Node's crypto runtime with pinned public keys.
 * PostgreSQL pgcrypto HMAC support is NOT an Ed25519 verification capability.
 * No live secret, installed extension change or production Auth is touched.
 */
const validNum=(n)=>Number.isSafeInteger(n)&&n>=0;
const hash=/^[a-f0-9]{64}$/;
export const cryptoOptions=Object.freeze([
 Object.freeze({id:'NODE_CRYPTO_ED25519',supportedByOfflineTest:true,
   dbSidePublicKeyVerification:false,independentReviewRequired:true}),
 Object.freeze({id:'PGCRYPTO_HMAC_SHA256',supportedByOfflineTest:true,
   dbSidePublicKeyVerification:false,sharedSecretInDB:true,independentReviewRequired:true}),
 Object.freeze({id:'PGSODIUM_ED25519_CANDIDATE',supportedByOfflineTest:false,
   dbSidePublicKeyVerification:'UNKNOWN',independentReviewRequired:true}),
 Object.freeze({id:'PGJWT_AS_ED25519_VERIFIER',supportedByOfflineTest:false,
   dbSidePublicKeyVerification:'UNVERIFIED',independentReviewRequired:true})
]);
export function assessCryptoCompatibility(snapshot) {
 const s=snapshot&&typeof snapshot==='object'?snapshot:{};
 const blockers=[];
 for(const field of ['pgcryptoInstalled','pgsodiumInstalled','pgsodiumAvailable',
                       'pgjwtInstalled','candidateEd25519PublicFunctions']){
   if(!validNum(s[field]))blockers.push('MISSING_METADATA_'+field);
 }
 if(s.pgcryptoInstalled!==1)blockers.push('PGCRYPTO_HMAC_NOT_CONFIRMED');
 if(s.pgsodiumInstalled!==0)blockers.push('RECHECK_PGSODIUM_INSTALLED_BEFORE_CLAIM');
 if(s.pgjwtInstalled!==0)blockers.push('RECHECK_PGJWT_INSTALLED_BEFORE_CLAIM');
 if(s.candidateEd25519PublicFunctions!==0)blockers.push('ED25519_CANDIDATE_NEEDS_INDEPENDENT_AUDIT');
 if(s.pgsodiumAvailable===0)blockers.push('PGSODIUM_NOT_AVAILABLE');
 // Even all green means ONLY: metadata is well-formed and HMAC is installed.
 // It does NOT establish any usable SQL Ed25519 verification contract.
 return Object.freeze({
   status:blockers.length?'REQUIRES_METADATA_RECHECK':'CRYPTO_DESIGN_REVIEW_ONLY',
   blockers:Object.freeze(blockers),
   nodeEd25519OfflineAvailable:true,
   postgresHmacPresent:s.pgcryptoInstalled===1,
   postgresEd25519Verified:false,
   pgSodiumActivationApproved:false,
   productionKeyCustodyVerified:false,
   productionAdmitted:false,
 });
}
export function assessPrivilegeInventory(snapshot){
 const s=snapshot&&typeof snapshot==='object'?snapshot:{};
 const blockers=[];
 for(const f of ['publicFunctionCount','publicSecurityDefiner','definerAnonExecutable',
                 'definerAuthenticatedExecutable','definerServiceExecutable']){
   if(!validNum(s[f]))blockers.push('MISSING_GRANT_METADATA_'+f);
 }
 if(!blockers.length && (s.publicSecurityDefiner>s.publicFunctionCount ||
    Math.max(s.definerAnonExecutable,s.definerAuthenticatedExecutable,s.definerServiceExecutable)>s.publicSecurityDefiner))
   blockers.push('INCONSISTENT_GRANT_COUNTS');
 if(s.definerAnonExecutable>0)blockers.push('PUBLIC_SECDEF_ANON_EXEC_REVIEW_REQUIRED');
 if(s.definerAuthenticatedExecutable>0)blockers.push('PUBLIC_SECDEF_AUTHENTICATED_EXEC_REVIEW_REQUIRED');
 if(s.definerServiceExecutable>0)blockers.push('SERVICE_ROLE_SECDEF_REVIEW_REQUIRED');
 if(s.verifiedFunctionBodiesByIndependentHuman!==true)
   blockers.push('FUNCTION_BODY_SECURITY_REVIEW_PENDING');
 if(s.dataApiSchemaExposureVerified!==true)
   blockers.push('POSTGREST_EXPOSED_SCHEMA_REVIEW_PENDING');
 if(s.explicitOwnerApprovalToAlterGrants!==true)
   blockers.push('NO_APPROVAL_TO_CHANGE_GRANTS');
 if(s.reviewedCommitHash && !hash.test(s.reviewedCommitHash))
   blockers.push('INVALID_REVIEWED_COMMIT_DIGEST');
 return Object.freeze({
   status:'REVIEW_REQUIRED',blockers:Object.freeze([...new Set(blockers)]),
   exposureProven:false,exploitProven:false,securityDefinerBodiesAccessed:false,
   permissionsChanged:false,grantRevocationApproved:false,
   productionAdmitted:false
 });
}
