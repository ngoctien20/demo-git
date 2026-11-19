/**
 * V18.3.6L — private key-custody proposal validator, metadata ONLY.
 * Absolutely no keys, KMS API, secrets or provider credentials.
 * A compliant-looking configuration is a design review candidate, not a
 * verified deployment and never authorizes a production signer.
 */
const PURPOSES=['TIEN404_AUTHORITY_ED25519','TIEN404_RPC_SIGNER','SUPABASE_AUTH_JWT_VERIFY'];
const sha=/^[0-9a-f]{64}$/;
const safe=x=>typeof x==='string'&&/^[a-z0-9_.:-]{3,100}$/i.test(x);
const nonblank=x=>typeof x==='string'&&x.length>0&&x.length<=200;
function evaluateKey(key) {
  const errors=[];
  if(!key||typeof key!=='object')return ['KEY_RECORD_MISSING'];
  if(!PURPOSES.includes(key.purpose))errors.push('UNRECOGNIZED_KEY_PURPOSE');
  if(!safe(key.kid))errors.push('MISSING_PINNED_KID');
  if(!['QA','STAGING','PRODUCTION'].includes(key.environment))errors.push('UNRECOGNIZED_ENVIRONMENT');
  if(!['SIGN','VERIFY'].includes(key.operation))errors.push('OPERATION_UNRECOGNIZED');
  if(key.purpose==='TIEN404_AUTHORITY_ED25519'){
    if(key.algorithm!=='Ed25519')errors.push('AUTHORITY_ALGORITHM_NOT_PINNED');
    if(key.operation!=='SIGN')errors.push('AUTHORITY_SIGN_OPERATION_MISSING');
    if(key.privateKeyExportable!==false)errors.push('EXTRACTABLE_PRIVATE_KEY_FORBIDDEN');
    if(key.signingEndpointPublic!==false)errors.push('PUBLIC_SIGNER_FORBIDDEN');
    if(key.operatorScope!=='dedicated_private_issuer')errors.push('ISSUER_SCOPING_REQUIRED');
  }
  if(key.purpose==='SUPABASE_AUTH_JWT_VERIFY'){
    if(key.operation!=='VERIFY'||key.privateKeyPresent!==false)
      errors.push('AUTH_VERIFIER_MUST_HAVE_PUBLIC_TRUST_ONLY');
    if(key.trustedSupabaseIssuerPinned!==true)errors.push('JWT_ISSUER_JWKS_NOT_PINNED');
  }
  if(key.purpose==='TIEN404_RPC_SIGNER'){
    if(key.operation!=='SIGN')errors.push('RPC_SIGNING_OPERATION_MISSING');
    // Current K uses HMAC inside DB and shared synthetic fixture.
    // Keep the production decision blocked until signer secret custody and
    // verification boundary are independently proved.
    if(!['PRIVATE_HMAC_DB_BOUNDARY','VETTED_PUBLIC_KEY_VERIFIER'].includes(key.design))
      errors.push('RPC_VERIFY_DESIGN_UNRESOLVED');
    if(key.design==='PRIVATE_HMAC_DB_BOUNDARY'&&key.symmetricSecretInDatabase!==true)
      errors.push('HMAC_DB_SECRET_BOUNDARY_UNSPECIFIED');
    if(key.design==='VETTED_PUBLIC_KEY_VERIFIER'&&key.pgVerifierExtensionIndependentlyApproved!==true)
      errors.push('ASYMMETRIC_DB_VERIFIER_NOT_VERIFIED');
    if(key.signingEndpointPublic!==false)errors.push('RPC_PUBLIC_SIGNER_FORBIDDEN');
  }
  if(!sha.test(key.attestationHash||''))errors.push('MISSING_REDACTED_EVIDENCE_HASH');
  if(!['PROPOSED','CANDIDATE','APPROVED','RELEASED'].includes(key.lifecycle))
    errors.push('INVALID_LIFECYCLE');
  if(key.lifecycle==='RELEASED')errors.push('RELEASE_STATUS_NOT_REVIEWABLE_OFFLINE');
  return errors;
}
export function assessKeyCustodyProposal(packageInfo){
  const p=packageInfo&&typeof packageInfo==='object'?packageInfo:{};
  const findings=[];
  const keys=Array.isArray(p.keys)?p.keys:[];
  if(keys.length!==3 || new Set(keys.map(k=>k&&k.purpose)).size!==3)
    findings.push('REQUIRES_DISTINCT_ISSUER_RPC_AND_AUTH_VERIFIER_ROLES');
  for(const k of keys){
    for(const e of evaluateKey(k))findings.push((k?.purpose||'UNKNOWN')+':'+e);
  }
  const ids=keys.map(k=>k?.kid);
  if(new Set(ids).size!==ids.length)findings.push('KID_COLLISION');
  const env=keys.map(k=>k?.environment);
  if(new Set(env).size!==1)findings.push('KEY_ENVIRONMENT_MISMATCH');
  if(p.signerNetworkPrivate!==true)findings.push('PRIVATE_NETWORK_NOT_VERIFIED');
  if(p.keyAccessTwoPersonReview!==true)findings.push('DUAL_CONTROL_NOT_VERIFIED');
  if(p.rotationProcedureDryRunPassed!==true)findings.push('ROTATION_AND_REVOCATION_DRILL_NOT_VERIFIED');
  if(p.redactedSignAuditEnabled!==true)findings.push('ISSUER_AUDIT_NOT_VERIFIED');
  if(p.automatedKeyMaterialLeakCheckPassed!==true)findings.push('KEY_LEAK_GUARD_MISSING');
  if(!nonblank(p.independentReviewId))findings.push('INDEPENDENT_REVIEW_REFERENCE_MISSING');
  // Metadata booleans are not cryptographic proof of deployment.
  return Object.freeze({
    status:findings.length?'DESIGN_INCOMPLETE':'DESIGN_PACKET_READY_FOR_EXTERNAL_REVIEW',
    findings:Object.freeze(findings),
    keyMaterialAccessed:false,
    deploymentVerified:false,
    signedByIndependentReviewer:false,
    productionSignerEnabled:false,
    productionAdmitted:false,
  });
}
