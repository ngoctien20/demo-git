// TIEN404 V17.MULTI-CHANNEL-03A — *public-safe* PRIVATE evidence intake preflight.
// No file/URL/identity/token is accepted or stored. This does not collect real evidence.
// Operators place originals only in separately authorized private encrypted custody.
const TYPES=new Set(['MERCHANT_STORE_OWNERSHIP','COMMERCIAL_STAFF_AUTHORITY',
 'SAME_TENANT_STORE_PAIR','META_PAGE_APP_ADMIN','META_HANDOVER_PERMISSION',
 'RECOVERY_OPERATOR_APPROVAL']);
const REF=/^EV-[A-Z0-9]{16,48}$/;
const PROPS=['contract','ticket','evidenceType','stage','expiresAtMs'];
const deny=reason=>Object.freeze({accepted:false,reason,
  status:'BLOCKED',privateEvidenceVerified:false,privateVaultWrite:false,
  canApproveUat:false,canDeploy:false,noSend:true});
function exact(o,keys) {
 return !!o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
}
export function preflightPrivateEvidenceTicket(record,clockMs) {
 if(!exact(record,PROPS)||record.contract!=='T404_MC03A_PRIVATE_INTAKE_V1')
   return deny('STRICT_METADATA_ONLY_NO_ATTACHMENTS');
 if(!REF.test(record.ticket??'')||!TYPES.has(record.evidenceType)||
  record.stage!=='PRIVATE_SUBMISSION_PENDING'||!Number.isSafeInteger(record.expiresAtMs)||
  !Number.isSafeInteger(clockMs)||clockMs<=0 ||
  record.expiresAtMs<=clockMs || record.expiresAtMs>clockMs+24*3600*1000)
    return deny('TICKET_TYPE_STAGE_OR_EXPIRY_INVALID');
 // A ticket is not a statement that there is a real file, an actual owner,
 // an authorized reviewer, or an attestation. It grants no access.
 return Object.freeze({accepted:true,reason:'METADATA_FORMAT_OK',
  ticket:record.ticket,evidenceType:record.evidenceType,
  status:'PENDING_PRIVATE_OWNER_AND_INDEPENDENT_REVIEW',
  privateEvidenceVerified:false,privateVaultWrite:false,
  canApproveUat:false,canDeploy:false,noSend:true,
  allowedNext:'OWNER_SUBMITS_DIRECTLY_TO_PREAPPROVED_ENCRYPTED_PRIVATE_VAULT'});
}
export function privateEvidenceAcceptanceChecklist(){
 return Object.freeze({
  contract:'T404_MC03A_PRIVATE_INTAKE_V1',
  privateOnly:true,canPublishEvidence:false,
  checks:Object.freeze([
    'REAL_MERCHANT_ORIGINAL_SOURCE_AND_EXACT_STORE_CONSENT',
    'AUTHENTICATED_OWNER_SESSION_AND_STORE_SCOPE',
    'INDEPENDENT_REVIEWER_IDENTITY_SEPARATE_FROM_OWNER',
    'SOURCE_PROVENANCE_AND_REVOKABLE_TIME_LIMIT',
    'ENCRYPTED_PRIVATE_CUSTODY_WITH_MANAGED_KEYS',
    'SINGLE_USE_ADMISSION_AND_AUDIT_LEDGER',
    'NO_PERSONAL_DATA_SECRETS_TOKENS_OR_PAGE_IDS_IN_GITHUB'
  ]),
  verified:false,approved:false
 });
}
