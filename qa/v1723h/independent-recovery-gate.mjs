// Zero-IO evidence gate. A Boolean or locally signed packet cannot grant real Owner/Operator authority.
export function recoveryAdmission(input={}) {
 const evidence=input?.evidence??{},deny=[];
 if (!['FULL_SERVICE','APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN'].includes(input?.ownerScope)) deny.push('OWNER_SCOPE_UNDECIDED');
 if (input?.localBackupDeferred!==false) deny.push('REAL_BACKUP_DEFERRED');
 for (const k of ['currentArchiveRestored','authRecoveryRestored','rolesAndAclVerified','storageAndSettingsCovered','independentOperatorVerified','independentReviewerVerified','fourRowOwnershipVerified','privateSignedRestoreReceiptVerified','issuerJwtAValidated','issuerJwtBValidated','sameTenantStoreABMembershipVerified'])
  if(evidence[k]!==true)deny.push('MISSING_'+k.toUpperCase());
 if(input?.requestedOperation!=='REVIEW_ONLY')deny.push('HOSTED_OR_WRITE_OPERATION_BLOCKED');
 if(input?.jwt||input?.refresh_token||input?.service_role||input?.credential)deny.push('SECRET_INPUT_REJECTED');
 // Deliberate permanent gate: proof from independent private runtime absent.
 return Object.freeze({status:'NO_GO',canDeploy:false,canBackup:false,canMigrate:false,canSend:false,realJwtAccepted:false,realRestoreAccepted:false,reasonCodes:Object.freeze(deny.length?deny:['INDEPENDENT_PRIVATE_RUNTIME_REQUIRED'])});
}
