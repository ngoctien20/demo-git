/**
 * V18.3.6O: metadata review manifest gate. NEVER fetches function bodies.
 * A SHA over schema/name/identity args is NOT a body hash or security review.
 */
import {createHash} from 'node:crypto';
const sha=/^[a-f0-9]{64}$/;
const exact=new Map([
 ['qa_owner_pairing','authenticated'],
 ['qa_shop_b_zalo_claim','anon'],
 ['save_merchant_product','authenticated'],
 ['tien404_tester_track_change','service_role'],
]);
export function identityDigest(f){
 if(!f||typeof f.schema!=='string'||typeof f.name!=='string'||
    typeof f.identity_arguments!=='string')throw Error('INVALID_FUNCTION_METADATA');
 return createHash('sha256').update(
  f.schema+'.'+f.name+'('+f.identity_arguments+')','utf8').digest('hex');
}
export function reviewManifest(manifest){
 const x=manifest&&typeof manifest==='object'&&!Array.isArray(manifest)?manifest:{};
 const errors=[];
 if(x.environment!=='supabase-staging'||x.project_ref!=='ifxlvrhyjhbzbrkdsida')
  errors.push('STAGING_IDENTITY_MISMATCH');
 if(x.schema_version!=='TIEN404_V18_3_6O_METADATA_ONLY_V1')
  errors.push('INVALID_MANIFEST_SCHEMA');
 if(x.identity_sha_is_body_hash!==false||x.actual_function_body_reviewed!==false||
    x.explicit_owner_body_review_approval!==false||
    x.real_auth_sessions_read!==false||x.production_approved!==false)
  errors.push('UNAUTHORIZED_PROOF_OR_APPROVAL_CLAIM');
 const fs=Array.isArray(x.functions)?x.functions:[];
 if(fs.length!==4||new Set(fs.map(f=>f?.name)).size!==4)
  errors.push('EXACT_FOUR_FUNCTIONS_REQUIRED');
 const effective={anon:0,authenticated:0,service_role:0};
 for(const f of fs){
  if(!f||f.schema!=='public'||!exact.has(f.name)||
     f.owner_role!=='postgres'||f.security_definer!==true||
     f.search_path_configured!==true||f.body_review_status!=='NOT_AUTHORIZED')
   {errors.push('FUNCTION_SCOPE_OR_OWNER_DRIFT');continue;}
  if(!sha.test(f.identity_sha256||'')||identityDigest(f)!==f.identity_sha256)
   errors.push('IDENTITY_DIGEST_DRIFT_'+f.name);
  const roles=['anon','authenticated','service_role']
   .filter(role=>f[role+'_exec']===true);
  for(const role of ['anon','authenticated','service_role'])
   if(typeof f[role+'_exec']!=='boolean')errors.push('MISSING_EFFECTIVE_PRIVILEGE_'+f.name);
  if(roles.length!==1||roles[0]!==exact.get(f.name))
   errors.push('ROLE_GRANT_METADATA_DRIFT_'+f.name);
  for(const r of roles)effective[r]++;
  if('body' in f||'prosrc' in f||'definition' in f||
     'key' in f||'secret' in f||'source_code' in f)
   errors.push('SENSITIVE_FUNCTION_CONTENT_FORBIDDEN');
 }
 if(effective.anon!==1||effective.authenticated!==2||effective.service_role!==1)
  errors.push('SECDEF_EFFECTIVE_COUNT_DRIFT');
 if(x.session_privilege_metadata?.anon_select!==false||
    x.session_privilege_metadata?.authenticated_select!==false||
    x.session_privilege_metadata?.service_role_select!==false||
    x.session_privilege_metadata?.actual_rows_read!==false)
  errors.push('SESSION_METADATA_OR_PRIVILEGE_DRIFT');
 if(x.data_api_exposure_verified!==false)
  errors.push('DATA_API_EXPOSURE_UNVERIFIED');
 const known=x.source_counts||{};
 if(known.public_functions!==8||known.public_security_definer!==4)
  errors.push('FUNCTION_COUNT_DRIFT');
 return Object.freeze({
   status:errors.length?'BLOCKED_METADATA_DRIFT':'READY_FOR_PRIVATE_REVIEW_SCOPE_REQUEST',
   blockers:Object.freeze([...new Set(errors)]),
   observedEntries:fs.length,
   exactIdentityDigestsMatch:errors.every(x=>!x.startsWith('IDENTITY_DIGEST_DRIFT')),
   actualFunctionBodyHashVerified:false,
   actualSecurityReviewPerformed:false,
   externalOwnerApprovalVerified:false,
   postgrestExposureVerified:false,
   permissionChangeAllowed:false,
   productionAdmitted:false,
 });
}
export function compareManifestToFreshMetadata(manifest,observed){
 if(!Array.isArray(observed)||observed.length!==4)
  return Object.freeze({status:'BLOCKED_METADATA_DRIFT',reason:'FRESH_METADATA_COUNT_REQUIRED',
    permissionChangeAllowed:false,productionAdmitted:false});
 const a=(manifest?.functions||[]).map(f=>f.name+':'+f.identity_sha256).sort();
 const b=observed.map(f=>f.name+':'+f.identity_sha256).sort();
 const matches=a.length===b.length&&a.every((v,i)=>v===b[i]);
 return Object.freeze({status:matches?'SCOPE_DIGESTS_MATCH_METADATA_ONLY':'BLOCKED_METADATA_DRIFT',
   permissionChangeAllowed:false,productionAdmitted:false});
}
