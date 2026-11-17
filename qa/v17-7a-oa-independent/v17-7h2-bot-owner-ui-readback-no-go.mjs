// TIEN404 V17.7H.2 — User-confirmed Bot Creator list + PRIVATE readback gate.
// SOURCE ONLY / NO NETWORK / NO CREDENTIALS / NO LIVE WEBHOOK.
// The uploaded screenshot proves that a Bot name appears in a Bot Creator UI,
// NOT a verified Bot ID, native Bot Token control, merchant Store ownership,
// or identity of the owner. Never treat user-supplied JSON as trusted provider.
import {createHash} from 'node:crypto';

const SCREEN_SHA='da459617e310e2341eb7f27430b8c6e0c6fe3f745560ab54e2be771b74b54258';
const DISPLAY_NAME='Bot TIEN404 AI';
const NO_GO=Object.freeze({
 sourceOnly:true,
 uiScreenVerifiedAsUserUpload:false,
 independentProviderPortalSessionVerified:false,
 actualBotOwnerAuthenticated:false,
 realBotTokenValidated:false,
 actualReadOnlyGetMePerformed:false,
 actualReadOnlyGetWebhookInfoPerformed:false,
 independentOperatorVerified:false,
 independentReviewerVerified:false,
 originalStoreOwnerProofVerified:false,
 realSameTenantABJwtRlsVerified:false,
 hostedNativeWebhookTested:false,
 hostedReplayLedgerVerified:false,
 realNoSendExternallyAudited:false,
 canSetWebhook:false,
 canDeleteWebhook:false,
 canSendMessage:false,
 canReadCustomerRows:false,
 canReadCommerce:false,
 canWriteOrder:false,
 canWriteStock:false,
 canChangeCloudflareRoute:false,
 canDeploy:false,
 canPublish:false
});
const deny=(reason,more={})=>Object.freeze({
 shapeCandidate:false,reason,...NO_GO,...more
});
const accept=(reason,more={})=>Object.freeze({
 shapeCandidate:true,reason,...NO_GO,...more
});
const strictBotId=x=>typeof x==='string'&&/^[0-9]{8,24}$/.test(x);
const safeAccount=x=>typeof x==='string'&&/^bot\.[A-Za-z0-9._-]{5,80}$/i.test(x);
const strictlyOwn=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).every(k=>keys.includes(k));

/** This is an EVIDENCE SUPPORT check, not Bot ownership verification.
 * SHA256 is computed on bytes in the user-uploaded image; no image data or
 * customer name, account ID, phone, token, screenshot are stored in GitHub.
 */
export function inspectOwnerListScreenshotReceipt(receipt){
 if(!strictlyOwn(receipt,['mode','source','screenshotSha256','displayName',
      'observedBotCount','observedBotCapacity','observedSurface','userConfirmsAdmin',
      'botIdVisible','botTokenVisible','actualProviderSessionVerified']) ||
    receipt.mode!=='REDACTED_USER_SCREENSHOT_RECEIPT' ||
    receipt.source!=='USER_UPLOADED_IMAGE' ||
    receipt.screenshotSha256!==SCREEN_SHA ||
    receipt.displayName!==DISPLAY_NAME ||
    receipt.observedBotCount!==1 ||
    receipt.observedBotCapacity!==3 ||
    receipt.observedSurface!=='ZALO_BOT_CREATOR_BETA_BOT_LIST' ||
    receipt.userConfirmsAdmin!==true ||
    receipt.botIdVisible!==false ||
    receipt.botTokenVisible!==false ||
    receipt.actualProviderSessionVerified!==false)
   return deny('SCREENSHOT_UNTRUSTED_OR_OWNER_NOT_INDEPENDENTLY_VERIFIED');
 return accept('BOT_CREATOR_LIST_UI_OBSERVED_ONLY',{
  userConfirmedBotManagement:true,
  observedDisplayName:DISPLAY_NAME,
  reportedBotCount:1,
  reportedMaximumBots:3,
  screenshotHashMatchesProvidedUpload:true,
  screenshotIdentityIsNotAttested:true,
  providerBotIdStillUnknown:true,
  consentDoesNotAuthorizeExistingWebhookChange:true
 });
}

/** Native Zalo Bot API readback with a trusted PRIVATE runner is a follow-up.
 * No network and no BOT_TOKEN are accepted or materialized by this module.
 * The official API has the Bot Token embedded in its HTTPS URL path, so
 * HTTP logs, errors, traces, GitHub, and chat MUST NOT log full URL.
 */
export function inspectReadOnlyBotReadbackShape(receipt){
 if(!strictlyOwn(receipt,['mode','source','provider','expectedBotId',
      'getMeResponse','getWebhookInfoResponse','secretNotCaptured',
      'noWebhookMutation','noProviderSend','noCustomerData']) ||
    receipt.mode!=='OFFLINE_REDACTED_PROVIDER_FIXTURE_ONLY' ||
    receipt.source!=='QA_ONLY_TEST_PAYLOAD' ||
    receipt.provider!=='ZALO_BOT' ||
    !strictBotId(receipt.expectedBotId) ||
    receipt.secretNotCaptured!==true ||
    receipt.noWebhookMutation!==true ||
    receipt.noProviderSend!==true ||
    receipt.noCustomerData!==true)
   return deny('READBACK_FIXTURE_SCOPE_OR_BOT_ID_INVALID');
 const me=receipt.getMeResponse,webhook=receipt.getWebhookInfoResponse;
 if(!strictlyOwn(me,['ok','result']) ||
    !strictlyOwn(me.result,['id','account_name','account_type','can_join_groups']) ||
    me.ok!==true ||
    me.result.id!==receipt.expectedBotId ||
    !safeAccount(me.result.account_name))
   return deny('GETME_BOT_ID_MISMATCH_OR_NOT_AUTHENTICATED');
 if(!strictlyOwn(webhook,['ok','result']) ||
    !strictlyOwn(webhook.result,['url','updated_at']) ||
    webhook.ok!==true ||
    !Number.isSafeInteger(webhook.result.updated_at) ||
    webhook.result.updated_at<0 ||
    typeof webhook.result.url!=='string' ||
    webhook.result.url.length>2048 ||
    (webhook.result.url!==''&&
      !/^https:\/\/[a-z0-9.-]+(?::443)?(?:\/[^\s]*)?$/i.test(webhook.result.url)))
   return deny('GETWEBHOOKINFO_UNTRUSTED_OR_NON_HTTPS');
 const configured=webhook.result.url.length>0;
 const urlDigest=configured
    ?createHash('sha256').update(webhook.result.url,'utf8').digest('hex')
    :null;
 return accept('OFFLINE_GETME_AND_WEBHOOKINFO_CONTRACT_VALID_NO_REAL_PROVIDER_PROOF',{
  botIdMatchesSyntheticFixture:true,
  currentWebhookConfiguredInFixture:configured,
  webhookConfigurationMustNotChange:true,
  existingWebhookDigestOnly:urlDigest,
  returnedWebhookUrlNeverLogged:true,
  realBotCreatorIdentityUnverified:true
 });
}

/** This is the ONLY planned method allowlist, not an HTTP implementation.
 * Never put the token-bearing path into public logs / screenshots.
 */
export function privateReadOnlyCallPlan(){
 return Object.freeze({
  source:'ZALO_OFFICIAL_DOCS',
  transport:'PRIVATE_AUTHENTICATED_RUNNER_ONLY',
  allowedBotApiMethods:['getMe','getWebhookInfo'],
  httpMethod:'POST',
  providerHost:'bot-api.zaloplatforms.com',
  requestBody:'{}',
  tokenInUrlPathMustNeverBeLogged:true,
  noAutomaticRetries:true,
  rawUrlNeverInEvidence:true,
  noNetworkExecuted:true,
  noActualTokenAvailableInThisArtifact:true,
  forbiddenMethods:['setWebhook','deleteWebhook','sendMessage','getUpdates',
   'sendPhoto','sendSticker','sendChatAction'],
  ...NO_GO
 });
}
export function inspectOneNativeEventGate(input){
 // A user confirmation/screenshot + synthetic getMe cannot authorize a
 // real provider message or a hosted public webhook. Even all-true inputs
 // have no effect without independent real provider proof + Store isolation.
 return Object.freeze({
  ...NO_GO,
  status:'REAL_NATIVE_ONE_EVENT_NO_GO',
  ignoredSelfReportedGreen:!!input,
  acceptedRealMessages:0,
  allowedQaMessageCount:0,
  required:Object.freeze([
   'BOT_CREATOR_REAL_ADMIN_IDENTITY_SESSION_VERIFIED_PRIVATELY',
   'REAL_GETME_MATCHES_QA_BOT_ID_VIA_PRIVATE_MANAGED_SECRET',
   'REAL_GETWEBHOOKINFO_CONFIRMS_NO_UNAPPROVED_REPOINTING',
   'INDEPENDENT_OPERATOR_AND_REVIEWER_AUTHORITY',
   'QA_BOT_SEPARATE_FROM_EXISTING_ACTIVE_WEBHOOK',
   'APPROVED_HOSTED_NATIVE_CALLBACK_AND_DURABLE_REPLAY_AND_QUOTA',
   'INDEPENDENT_ZERO_OUTBOUND_ZERO_ORDER_ZERO_STOCK_EVIDENCE',
   'SEPARATE_CANONICAL_SAME_TENANT_STORE_AB_RLS_BEFORE_COMMERCE'
  ])
 });
}
export const screenshotSha256=SCREEN_SHA;
