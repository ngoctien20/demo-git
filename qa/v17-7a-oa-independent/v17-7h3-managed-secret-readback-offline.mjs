// TIEN404 V17.7H.3 — Private Managed-Secret Bot Readback DRY RUN ONLY.
// This file wraps the inherited V17.7H.2 verified mock-only Bot API probe.
// The token is obtained by a VAULT CALLBACK, never as an input field. Only
// synthetic QA_ONLY secret values and injected offline transports are allowed.
// NO GLOBAL FETCH, NO REAL ZALO API, NO n8n credential access, NO Cloudflare
// deploy, NO webhook change, NO customer row, NO provider send.
// A vault interface is NOT proof of Bot Creator/Store ownership.
import { runSyntheticPrivateBotReadback } from './v17-7h2-private-readonly-bot-probe.mjs';

const BOT_ID=/^\d{8,24}$/;
const SECRET_REF=/^qa_zalo_bot_[A-Za-z0-9_-]{8,64}$/;
const INSTALL=/^[A-Za-z0-9][A-Za-z0-9_-]{11,95}$/;
const SCREEN_SHA='da459617e310e2341eb7f27430b8c6e0c6fe3f745560ab54e2be771b74b54258';
const SCOPE='READ_GETME_GETWEBHOOKINFO_ONLY_NO_SEND';
const keys=new Set(['mode','source','channel','installationRef','ownerUiSha256',
  'expectedBotId','secretRef','scope','noLiveApi','noWebhookChange',
  'noProviderSend','noCommerceReadWrite','maxReadMethods']);

const NO_GO=Object.freeze({
  sourceOnly:true,privateVaultAccessProven:false,
  independentBotCreatorOwnerVerified:false,
  independentlyAuthenticatedOperatorVerified:false,
  independentSecurityReviewerVerified:false,
  realGetMeCalled:false,realGetWebhookInfoCalled:false,
  realZaloBotOwnerVerified:false,realStoreAuthorityVerified:false,
  realProviderEventReceived:false,realHostedReplayVerified:false,
  providerApiCallsMade:0,allowedActualProviderEvents:0,
  canSetWebhook:false,canDeleteWebhook:false,canSendMessage:false,
  canChangeWorkerRoute:false,canDeploy:false,
  canReadCommerce:false,canWriteCommerce:false,canPublish:false
});
const denied=(reason,detail={})=>Object.freeze({
  status:'REAL_OPERATOR_AUTHORITY_NO_GO',reason,...NO_GO,...detail
});
const dry=(reason,detail={})=>Object.freeze({
  status:'SYNTHETIC_VAULT_READBACK_SHAPE_TESTED',reason,...NO_GO,...detail
});

export async function runManagedSecretOfflineReadback(intent,adapters){
  if(!intent||typeof intent!=='object'||Array.isArray(intent)||
     Object.keys(intent).some(k=>!keys.has(k))||
     intent.mode!=='OFFLINE_CLOSED_VAULT_FIXTURE'||
     intent.source!=='H3_INHERITED_H2_NO_LIVE_CALL'||
     intent.channel!=='ZALO_BOT'||
     !INSTALL.test(intent.installationRef??'')||
     intent.ownerUiSha256!==SCREEN_SHA ||
     !BOT_ID.test(intent.expectedBotId??'')||
     !SECRET_REF.test(intent.secretRef??'')||
     intent.scope!==SCOPE ||
     intent.noLiveApi!==true || intent.noWebhookChange!==true ||
     intent.noProviderSend!==true || intent.noCommerceReadWrite!==true ||
     intent.maxReadMethods!==2)
    return denied('BOT_OWNER_AND_PRIVATE_READONLY_SCOPE_NOT_PROVEN');
  if(!adapters||adapters.mode!=='OFFLINE_INJECTED_LOCAL_ONLY'||
     !adapters.vault||adapters.vault.mode!=='OFFLINE_MEMORY_VAULT'||
     typeof adapters.vault.withSecret!=='function'||
     !adapters.transport||adapters.transport.mode!=='OFFLINE_FIXED_MOCK'||
     typeof adapters.transport.request!=='function')
    return denied('PRIVATE_VAULT_OR_OPERATOR_RUNNER_NOT_ADMITTED');

  let callbackCount=0;
  let receipt;
  try {
    receipt=await adapters.vault.withSecret(intent.secretRef,async token=>{
      callbackCount++;
      // inherited H.2 accepts only QA_ONLY fake values and fake transport.
      return runSyntheticPrivateBotReadback({
        mode:'OFFLINE_MOCK_READONLY',noSend:true,noMutation:true,
        noCustomerRows:true,expectedBotId:intent.expectedBotId,
        qaOnlyTestToken:token
      },adapters.transport);
    });
  } catch {
    // Never log the error: vault/http exceptions can contain token URL.
    return denied('PRIVATE_VAULT_READBACK_FAILED_REDACTED');
  }
  if(callbackCount!==1 || !receipt || typeof receipt!=='object')
    return denied('VAULT_CALLBACK_NOT_EXACTLY_ONCE');
  if(receipt.status==='NO_GO'&&
     receipt.reason==='EXISTING_WEBHOOK_DO_NOT_REPOINT'){
    return denied('EXISTING_PROVIDER_WEBHOOK_HARD_STOP',{
      syntheticTokenAccessShapeMatched:true,
      webhookConfiguredInMock:true
    });
  }
  if(receipt.status!=='SYNTHETIC_READBACK_ONLY'||
     receipt.syntheticGetMeMatched!==true||
     receipt.syntheticWebhookConfigured!==false||
     receipt.providerMethodsChecked!==2)
    return denied('MOCK_GETME_OR_WEBHOOKINFO_FAILED');
  return dry('ONE_VAULT_CALLBACK_TWO_MOCK_READONLY_CALLS',{
    syntheticVaultCallbackCount:1,
    syntheticMethodCount:2,existingWebhookInMock:false,
    realBotIdentityOrAdminSessionObserved:false,
    noTokenBotIdOrWebhookUrlReturned:true
  });
}

export function describeActualManagedSecretUatPrerequisites(){
  return Object.freeze({
    status:'REAL_GETME_PRIVATE_UAT_NOT_AUTHORIZED',
    privateOperatorRequirements:Object.freeze([
      'REAL_DISPOSABLE_QA_BOT_CONFIRMED_BY_CREATOR_UI_ID',
      'INDEPENDENTLY_VERIFIED_BOT_CREATOR_OWNER_SESSION',
      'EXPLICIT_OWNER_CONSENT_SCOPED_TO_TWO_READONLY_METHODS',
      'AUTHORIZED_OPERATOR_AND_INDEPENDENT_ATTESTATION',
      'PRIVATE_MANAGED_SECRET_WITH_MASKED_URL_AND_ACCESS_AUDIT',
      'READONLY_GETME_MATCHES_INDEPENDENTLY_PINNED_BOT_ID',
      'READONLY_GETWEBHOOKINFO_NO_UNAPPROVED_REPOINT',
      'NO_SETWEBHOOK_NO_SENDMESSAGE_NO_GETUPDATES',
      'ZERO_CUSTOMER_AND_COMMERCE_ACCESS',
      'PRIVATE_REDACTED_EVIDENCE_NO_RAW_URL_OR_CREDENTIALS'
    ]),...NO_GO
  });
}

export const recognizedOwnerUiEvidenceSha=SCREEN_SHA;
