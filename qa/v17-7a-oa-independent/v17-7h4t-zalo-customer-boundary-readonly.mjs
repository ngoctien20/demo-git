/**
 * TIEN404 V17.7H.4T — offline customer ingress / channel identity boundary.
 *
 * This is NOT a router, NOT an installation registrar, and NOT an authorization
 * source. Input is sanitized metadata only. No network, DB, credentials, PII,
 * order data or provider API usage. Never return live permission.
 *
 * Respects V17.7H.4S cross-channel Store/Customer NO-GO. Reuses the existing
 * Shared Core technical deny; never edits Published n8n workflows.
 */
const FIELDS = Object.freeze({
  ingress: ['source','channel','marker','route','ownerGate','readOnly','noSend'],
  shadow: ['inputChannel','outputChannel','accountId','denied','providerSends','commerceWrites','stockWrites','modelCalls'],
});
const PERMISSION = Object.freeze({
  canRegisterChannel:false,canBindRealBot:false,canTrustRealOwner:false,
  canReadCustomer:false,canReadOrder:false,canReadStock:false,
  canWriteOrder:false,canSendProvider:false,canPublishWorkflow:false,
  canChangeWebhook:false,canChangeToken:false,canPromoteCore:false
});
const answer=(status,reason,extra={})=>Object.freeze({status,reason,...PERMISSION,...extra});
const exactKeys=(v,keys)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const isText=(v)=>typeof v==='string'&&v.length>0&&v.length<=128;
const stable=(a,b)=>isText(a)&&isText(b)&&a===b;

export function classifyExistingZaloShadow(input={}){
 const {ingress,shadow}=input||{};
 if(!exactKeys(ingress,FIELDS.ingress)||!exactKeys(shadow,FIELDS.shadow))
  return answer('NO_GO','UNTRUSTED_OR_EXTRA_CUSTOMER_FIELDS');
 if(ingress.source!=='protected_bot_header'||ingress.channel!=='zalo_bot'||
    ingress.marker!=='SEEN_AUTHENTICATED_WEBHOOK'||
    ingress.route!=='CUSTOMER_ROUTE_ELIGIBLE'||ingress.ownerGate!=='denied'||
    ingress.readOnly!==true||ingress.noSend!==true)
  return answer('NO_GO','CUSTOMER_INGRESS_OR_OWNER_DENIAL_UNVERIFIED');
 if(shadow.inputChannel!=='zalo_bot'||shadow.outputChannel!=='zalo_oa'||
    shadow.accountId!=='__V1715_NO_REAL_STORE_BINDING__')
  return answer('NO_GO','SHADOW_TECHNICAL_DENY_CONTRACT_DRIFT');
 if(shadow.denied!==true||[shadow.providerSends,shadow.commerceWrites,
    shadow.stockWrites,shadow.modelCalls].some(x=>x!==0))
  return answer('NO_GO','SIDE_EFFECT_OR_DENIAL_PROOF_MISSING');
 return answer('QA_TECHNICAL_DENY_VERIFIED_REAL_NO_GO',
   'INTENTIONAL_ZALO_BOT_TO_ZALO_OA_SHADOW_WITH_NO_STORE', {
      realInboundContentVerified:false,realOwnerVerified:false,
      realStoreBound:false,existingShadowIsNotLiveChannelRouter:true
   });
}

export function inspectProposedQaChannelJoin(input={}){
 const {channelRows,installations,profiles,nowMs}=input||{};
 if(!Array.isArray(channelRows)||!Array.isArray(installations)||
    !Array.isArray(profiles)||!Number.isSafeInteger(nowMs)||nowMs<=0||
    [channelRows.length,installations.length,profiles.length].some(n=>n>100))
  return answer('NO_GO','INVALID_METADATA_SET');
 // Zalo OA is NOT the existing Bot Creator Bot; no coercion or fallback.
 const channels=channelRows.filter(r=>r?.channelType==='zalo_bot');
 if(channels.length===0)return answer('NO_GO','ZALO_BOT_COMMERCE_CHANNEL_NOT_REGISTERED');
 if(channels.length!==1)return answer('NO_GO','DUPLICATE_ZALO_BOT_COMMERCE_CHANNEL');
 const channel=channels[0];
 if(channel.enabled!==true||channel.connectionStatus!=='sandbox')
  return answer('NO_GO','QA_CHANNEL_DISABLED_OR_NOT_SANDBOX');
 if(!isText(channel.accountId)||!isText(channel.tenantId))
  return answer('NO_GO','QA_CHANNEL_IDENTITY_MISSING');

 const inst=installations.filter(r=>r?.provider==='ZALO_BOT'&&
   r?.binding_status==='ACTIVE'&&r?.installation_ref===channel.accountId);
 if(inst.length!==1)return answer('NO_GO','TRUSTED_INSTALLATION_MISSING_OR_DUPLICATE');
 const i=inst[0];
 if(i.qa_only!==true||i.read_only!==true||
    i.approval_scope!=='QA_SYNTHETIC_NO_REAL_OWNER'||
    !Number.isSafeInteger(i.expires_at_ms)||i.expires_at_ms<=nowMs)
  return answer('NO_GO','INSTALLATION_UNAUTHORIZED_EXPIRED_OR_NOT_QA_ONLY');
 if(!stable(i.tenant_id,channel.tenantId)||!isText(i.store_id))
  return answer('NO_GO','STORE_TENANT_SCOPE_NOT_CANONICAL');
 const matchingProfiles=profiles.filter(p=>p?.channel==='zalo_bot'&&
    p?.installation_ref===i.installation_ref);
 if(matchingProfiles.length!==1)
  return answer('NO_GO','BOT_PROFILE_INSTALLATION_REF_MISMATCH');
 const p=matchingProfiles[0];
 if(p.status!=='QA_APPROVED'||p.approval_scope!=='SYNTHETIC_ONLY'||
    p.owner_authority_verified!==false||p.read_only!==true||
    p.subscription_active!==true||p.store_paused!==false)
  return answer('NO_GO','PROFILE_NOT_SYNTHETIC_READONLY');
 // Versions and store IDs must be server-authoritatively mapped, not
 // inferred from the names QA_STORE_A vs uuid or customer-submitted data.
 if(!stable(p.tenant_ref,i.tenant_id)||!stable(p.store_ref,i.store_id)||
    !stable(p.bot_version,i.bot_profile_version))
  return answer('NO_GO','UNVERIFIED_TENANT_STORE_OR_PROFILE_VERSION_BRIDGE');
 return answer('QA_JOIN_SHAPE_ONLY_REAL_NO_GO',
   'SYNTHETIC_METADATA_JOIN_NOT_AN_OWNER_OR_CUSTOMER_AUTHORITY',{
      qaOnly:true,installationCount:1,customerIdentityLinksVerified:false,
      storeAbJwtRlsVerified:false,actualOrderReads:0,actualProviderSends:0
   });
}
export const currentReleaseDecision=()=>answer('NO_GO',
 'REAL_BOT_INSTALLATION_AND_STORE_AUTHORITY_UNVERIFIED');
