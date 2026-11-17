'use strict';
const EXPECTED='tien404-merchant-evidence-quarantine-staging';
const CONTRACT='T404_RPC15_R2_PRIVATE_BUCKET_API_SNAPSHOT_V1';
function inspect(s){
 const b=[];
 if(s?.contract!==CONTRACT||s?.scope!=='SANITIZED_METADATA_ONLY')b.push('BAD_SNAPSHOT');
 if(s?.r2Enabled!==true)b.push('R2_NOT_ENABLED');
 if(s?.bucketName!==EXPECTED)b.push('BUCKET_MISMATCH');
 if(s?.location!=='APAC'||s?.storageClass!=='Standard')b.push('BUCKET_LOCATION_CLASS_UNVERIFIED');
 if(s?.publicDevelopmentUrlEnabled!==false)b.push('PUBLIC_R2_DEV_ENABLED_OR_UNKNOWN');
 if(s?.customDomainCount!==0)b.push('CUSTOM_DOMAIN_PRESENT_OR_UNKNOWN');
 if(s?.corsConfigurationPresent!==false)b.push('CORS_NOT_VERIFIED');
 if(s?.objectCount!==0)b.push('PREEXISTING_OBJECTS_REQUIRE_PRIVATE_AUDIT');
 if(s?.accountTokenInventoryReadable!==true)b.push('TOKEN_INVENTORY_NOT_AUDITED');
 if(s?.dedicatedAccessAppVerified!==true)b.push('DEDICATED_ACCESS_APP_MISSING');
 if(s?.durableHostedRegistryVerified!==true)b.push('HOSTED_REGISTRY_NOT_VERIFIED');
 if(s?.trustedMalwareScannerVerified!==true)b.push('REAL_SCANNER_NOT_VERIFIED');
 if(s?.independentReviewerVerified!==true)b.push('INDEPENDENT_REVIEWER_NOT_VERIFIED');
 if(s?.fourOriginalMerchantRowsVerified!==true)b.push('FOUR_REAL_ROW_PROOFS_MISSING');
 if(s?.realSameTenantTwoStoreJwtUatVerified!==true)b.push('REAL_JWT_AB_UAT_MISSING');
 if(s?.fullAuthStorageRecoveryVerified!==true)b.push('BACKUP_RESTORE_NOT_VERIFIED');
 if(s?.hostedIntakeEnabled!==false)b.push('HOSTED_INTAKE_MUST_REMAIN_DISABLED');
 b.push('INDEPENDENT_SECURITY_OPERATOR_RELEASE_REQUIRED');
 const privateBucketVerified=s?.r2Enabled===true&&s?.bucketName===EXPECTED&&
  s?.publicDevelopmentUrlEnabled===false&&s?.customDomainCount===0;
 return Object.freeze({
  status:'RPC15_PRIVATE_BUCKET_VERIFIED_HOSTED_NO_GO',
  privateBucketVerified,
  blockers:Object.freeze([...new Set(b)]),
  canDraftOfflineBinding:privateBucketVerified,
  canDeployUpload:false,
  canIssueExternalR2Token:false,
  canAcceptRealMerchantEvidence:false,
  canAssignStore:false,
  canRunRealJwtUat:false,
  canWriteCommerce:false,
  canRelease:false
 });
}
module.exports=Object.freeze({inspect});