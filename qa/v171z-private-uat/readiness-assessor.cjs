'use strict';
/*
 TIEN404 V17.1Z — read-only, deterministic admission PRE-FLIGHT.
 This source cannot grant authorization. A checked-in snapshot is not a
 live signed provider/operator receipt. No network, Auth, R2, DB writes.
*/
const PROJECT='ifxlvrhyjhbzbrkdsida';
const WORKER='tien404-rpc16-merchant-evidence-inactive-staging';
const BUCKET='tien404-merchant-evidence-quarantine-staging';
const PREFIX='qa-v171x-disposable/';
function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype}
function exact(x,keys){return plain(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|')}
function blocked(code){return Object.freeze({ok:false,code})}
const outerKeys=['schema','projectRef','observedAt','cloudflare','supabase','approval'];
const cfKeys=['worker','bucket','prefix','workerExists','workersDevEnabled',
 'previewsEnabled','workerCustomDomainCount','workerZoneRouteCount',
 'accessAppExists','accessPolicyCount','accessBypassPolicyCount',
 'accessAnonymousDenyCanaryRun','accessAuthenticatedOperatorCanaryRun',
 'r2PublicDevEnabled','r2CustomDomainCount','qaPrefixFirstPageCount',
 'qaPrefixPaginationComplete','qaPrefixContainsObjectData',
 'r2ObjectExpirationRuleCount','atomicReplayWorkerBindingVerified'];
const sbKeys=['mappedTenants','mappedStores','ownerLinks','sameTenantDistinctOwnerPairs',
 'sameTenantActiveAuthPairs','legacyCoreStorePolicyCount',
 'tenantMapUniqueAuthTenantId','tenantMapPrimaryKeyTenantKey',
 'tenantMembershipKey','hasPublicStoreMemberships','hasActualStoreLevelRlsJwtAcceptance'];
const apKeys=['protectedRouteOwnerApproved','independentSecurityReviewerApproved',
 'identityProvisioningApproved','r2PolicyChangeApproved',
 'paidResourceChangeApproved','disposableQaOnly','noCustomerData',
 'noExternalSends','noExistingMerchantTransfer'];
function assess(snapshot){
 if(!exact(snapshot,outerKeys)||snapshot.schema!=='TIEN404_V171Z_READONLY_SNAPSHOT_V1'||
    snapshot.projectRef!==PROJECT||typeof snapshot.observedAt!=='string'||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/.test(snapshot.observedAt))
  return blocked('UNTRUSTED_SNAPSHOT');
 const c=snapshot.cloudflare,s=snapshot.supabase,a=snapshot.approval;
 if(!exact(c,cfKeys)||!exact(s,sbKeys)||!exact(a,apKeys))return blocked('UNTRUSTED_EVIDENCE_FIELDS');
 if(c.worker!==WORKER||c.bucket!==BUCKET||c.prefix!==PREFIX||
    c.workerExists!==true||c.accessAppExists!==true)return blocked('WRONG_INFRA_SCOPE');
 const cfBooleans=['workersDevEnabled','previewsEnabled','accessAnonymousDenyCanaryRun',
 'accessAuthenticatedOperatorCanaryRun','r2PublicDevEnabled',
 'qaPrefixPaginationComplete','qaPrefixContainsObjectData','atomicReplayWorkerBindingVerified'];
 const sbBooleans=['tenantMapUniqueAuthTenantId','tenantMapPrimaryKeyTenantKey',
 'hasPublicStoreMemberships','hasActualStoreLevelRlsJwtAcceptance'];
 if([...cfBooleans].some(k=>typeof c[k]!=='boolean')||
    [...sbBooleans].some(k=>typeof s[k]!=='boolean')||
    apKeys.some(k=>typeof a[k]!=='boolean'))return blocked('INVALID_BOOLEAN_EVIDENCE');
 const cfCounts=['workerCustomDomainCount','workerZoneRouteCount','accessPolicyCount',
 'accessBypassPolicyCount','r2CustomDomainCount','qaPrefixFirstPageCount',
 'r2ObjectExpirationRuleCount'];
 const sbCounts=['mappedTenants','mappedStores','ownerLinks',
 'sameTenantDistinctOwnerPairs','sameTenantActiveAuthPairs','legacyCoreStorePolicyCount'];
 if([...cfCounts].some(k=>!Number.isSafeInteger(c[k])||c[k]<0)||
    [...sbCounts].some(k=>!Number.isSafeInteger(s[k])||s[k]<0)||
    s.tenantMembershipKey!=='(tenant_id,user_id)')return blocked('INVALID_SCHEMA_NUMBERS');
 const blockers=[];
 const add=(condition,code)=>{if(condition)blockers.push(code)};
 add(c.workerCustomDomainCount===0&&c.workerZoneRouteCount===0&&!c.workersDevEnabled&&!c.previewsEnabled,
    'WORKER_HAS_NO_VERIFIED_PROTECTED_ROUTE');
 add(c.accessPolicyCount===0,'ACCESS_POLICY_MISSING');
 add(c.accessBypassPolicyCount>0,'ACCESS_BYPASS_PRESENT');
 add(!c.accessAnonymousDenyCanaryRun,'ANONYMOUS_DENIAL_NOT_VERIFIED');
 add(!c.accessAuthenticatedOperatorCanaryRun,'OPERATOR_ALLOWED_SESSION_NOT_VERIFIED');
 add(c.r2PublicDevEnabled||c.r2CustomDomainCount>0,'R2_PUBLIC_SURFACE_RISK');
 add(!c.qaPrefixPaginationComplete||c.qaPrefixFirstPageCount>0,'R2_PREFIX_NOT_CONFIRMED_EMPTY');
 add(c.qaPrefixContainsObjectData,'R2_METADATA_ONLY_CONTRACT_VIOLATED');
 add(c.r2ObjectExpirationRuleCount===0,'R2_OBJECT_RETENTION_NOT_CONFIGURED');
 add(!c.atomicReplayWorkerBindingVerified,'WORKER_DURABLE_REPLAY_UNPROVEN');
 add(s.tenantMapUniqueAuthTenantId&&s.tenantMapPrimaryKeyTenantKey,
    'ONE_AUTH_TENANT_ONE_STORE_MAPPING_CONSTRAINT');
 add(!s.hasPublicStoreMemberships,'NO_VERIFIED_STORE_MEMBERSHIP_MODEL');
 add(s.sameTenantDistinctOwnerPairs===0,'NO_REAL_SAME_TENANT_TWO_STORE_OWNERS');
 add(s.sameTenantActiveAuthPairs===0,'NO_SAME_TENANT_TWO_LIVE_AUTH_SESSIONS');
 add(s.legacyCoreStorePolicyCount===0||!s.hasActualStoreLevelRlsJwtAcceptance,
    'NO_REAL_STORE_SCOPED_RLS_JWT_ACCEPTANCE');
 add(!a.protectedRouteOwnerApproved,'PROTECTED_ROUTE_OWNER_APPROVAL_MISSING');
 add(!a.independentSecurityReviewerApproved,'INDEPENDENT_REVIEWER_APPROVAL_MISSING');
 add(!a.identityProvisioningApproved,'DISPOSABLE_QA_AUTH_PROVISIONING_NOT_APPROVED');
 add(!a.r2PolicyChangeApproved,'R2_LIFECYCLE_CHANGE_NOT_APPROVED');
 add(!a.paidResourceChangeApproved,'COST_CHANGES_NOT_APPROVED');
 add(!a.disposableQaOnly||!a.noCustomerData||!a.noExternalSends||
     !a.noExistingMerchantTransfer,'QA_SCOPE_UNSAFE');
 const immutable=Object.freeze([...blockers]);
 return Object.freeze({ok:true,
  assessment:Object.freeze({
    kind:'V171Z_PREPROVISIONING_READINESS_ONLY',
    projectRef:PROJECT,
    source:'READ_ONLY_CONNECTOR_SNAPSHOT_NOT_HOSTED_ATTESTATION',
    blockers:immutable,blockerCount:immutable.length,
    qaTenantModel:'NEW_DISPOSABLE_TENANT_WITH_TWO_STORE_MEMBERSHIPS',
    useExistingWorker:true,
    protectedAccessCanaryAuthorized:false,
    realJwtAuthUatAttested:false,
    allowCreateUsers:false,allowCreateStores:false,
    allowChangeRls:false,allowModifyR2:false,
    allowDeployWorker:false,allowSendProviderMessage:false,
    allowNewSpend:false,productionApproved:false,
    release:'HOSTED_NO_GO'
  })
 });
}
module.exports={assess};
