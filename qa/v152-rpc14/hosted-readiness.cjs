'use strict';
/** Pure metadata-only NO-GO gate; nothing here can authorize an operation. */
function inspect(v={}) {
 const blockers=[];
 for(const p of ['r2Enabled','dedicatedAccessApp','scannerDeployed','durableRegistry','signedFourRowEvidence','dualIndependentSignins','sameTenantTwoStores','realJwtUatPassed','fullRestoreVerified'])
  if(v[p]!==true)blockers.push('MISSING_'+p.toUpperCase());
 blockers.push('INDEPENDENT_HOSTED_SECURITY_AUTHORIZATION_REQUIRED');
 return Object.freeze({status:'RPC14_HOSTED_NO_GO',blockers,canProvisionR2:false,canDeployUpload:false,canAcceptRealMerchantEvidence:false,canCreateStore:false,canWriteCommerce:false,canChangeRls:false,canRunRealJwtUat:false,canRelease:false});
}
module.exports={inspect};