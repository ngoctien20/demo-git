import test from 'node:test';
import assert from 'node:assert/strict';
import {
 inspectOwnerListScreenshotReceipt,inspectReadOnlyBotReadbackShape,
 privateReadOnlyCallPlan,inspectOneNativeEventGate,screenshotSha256
} from './v17-7h2-bot-owner-ui-readback-no-go.mjs';
const BOT_ID='1459232241454765289';
function screenshot(){
 return {
  mode:'REDACTED_USER_SCREENSHOT_RECEIPT',
  source:'USER_UPLOADED_IMAGE',
  screenshotSha256,
  displayName:'Bot TIEN404 AI',
  observedBotCount:1,observedBotCapacity:3,
  observedSurface:'ZALO_BOT_CREATOR_BETA_BOT_LIST',
  userConfirmsAdmin:true,botIdVisible:false,botTokenVisible:false,
  actualProviderSessionVerified:false
 };
}
function response(url='https://test.example.invalid/qa-zalo-old-webhook'){
 return {
  mode:'OFFLINE_REDACTED_PROVIDER_FIXTURE_ONLY',
  source:'QA_ONLY_TEST_PAYLOAD',provider:'ZALO_BOT',expectedBotId:BOT_ID,
  secretNotCaptured:true,noWebhookMutation:true,noProviderSend:true,
  noCustomerData:true,
  getMeResponse:{ok:true,result:{id:BOT_ID,account_name:'bot.QaFixture1',
    account_type:'BASIC',can_join_groups:false}},
  getWebhookInfoResponse:{ok:true,result:{url,updated_at:1794912000000}}
 };
}
function locked(x){
 for(const k of ['independentProviderPortalSessionVerified',
  'actualBotOwnerAuthenticated','realBotTokenValidated',
  'actualReadOnlyGetMePerformed','actualReadOnlyGetWebhookInfoPerformed',
  'independentOperatorVerified','independentReviewerVerified',
  'originalStoreOwnerProofVerified','realSameTenantABJwtRlsVerified',
  'hostedNativeWebhookTested','hostedReplayLedgerVerified',
  'realNoSendExternallyAudited','canSetWebhook','canDeleteWebhook',
  'canSendMessage','canReadCustomerRows','canReadCommerce','canWriteOrder',
  'canWriteStock','canChangeCloudflareRoute','canDeploy','canPublish'
 ])assert.equal(x[k],false,k);
 assert.equal(x.sourceOnly,true);
}
function badScreenshot(modifier){
 const r=screenshot();modifier(r);
 const x=inspectOwnerListScreenshotReceipt(r);
 assert.equal(x.shapeCandidate,false);
 assert.equal(x.reason,'SCREENSHOT_UNTRUSTED_OR_OWNER_NOT_INDEPENDENTLY_VERIFIED');
 locked(x);
}
function badProvider(reason,modifier){
 const r=response();modifier(r);
 const x=inspectReadOnlyBotReadbackShape(r);
 assert.equal(x.shapeCandidate,false);
 assert.equal(x.reason,reason);
 locked(x);
}
test('actual screenshot hash + visible Bot list UI candidate only',()=>{
 const x=inspectOwnerListScreenshotReceipt(screenshot());
 assert.equal(x.shapeCandidate,true);
 assert.equal(x.reason,'BOT_CREATOR_LIST_UI_OBSERVED_ONLY');
 assert.equal(x.reportedBotCount,1);
 assert.equal(x.reportedMaximumBots,3);
 assert.equal(x.providerBotIdStillUnknown,true);
 assert.equal(x.screenshotIdentityIsNotAttested,true);
 assert.equal(x.consentDoesNotAuthorizeExistingWebhookChange,true);
 locked(x);
});
test('matching user screenshot never auto authorizes any real provider call',()=>{
 const x=inspectOwnerListScreenshotReceipt(screenshot());
 assert.equal(x.actualReadOnlyGetMePerformed,false);
 assert.equal(x.canChangeCloudflareRoute,false);
 assert.equal(x.canSendMessage,false);
 locked(x);
});
test('screenshot hash mismatch refused',()=>badScreenshot(x=>x.screenshotSha256='0'.repeat(64)));
test('blank screenshot hash refused',()=>badScreenshot(x=>x.screenshotSha256=''));
test('wrong Bot name refused',()=>badScreenshot(x=>x.displayName='Bot Unknown'));
test('Bot count spoof refused',()=>badScreenshot(x=>x.observedBotCount=2));
test('Bot quota spoof refused',()=>badScreenshot(x=>x.observedBotCapacity=10));
test('no screenshot source refused',()=>badScreenshot(x=>x.source='POTENTIALLY_FORGED'));
test('screenshot cannot assert verified session',()=>badScreenshot(x=>x.actualProviderSessionVerified=true));
test('screenshot cannot expose Bot Token',()=>badScreenshot(x=>x.botTokenVisible=true));
test('screenshot cannot claim visible Bot ID',()=>badScreenshot(x=>x.botIdVisible=true));
test('user admin confirmation cannot be silently flipped',()=>badScreenshot(x=>x.userConfirmsAdmin=false));
test('wrong UI app refused',()=>badScreenshot(x=>x.observedSurface='FAKE_BOT_CREATOR'));
test('live screenshot intake mode blocked',()=>badScreenshot(x=>x.mode='REAL_PROVIDER_AUTH'));
for(const f of ['token','password','otp','jwt','zaloUserId',
    'ownerId','phone','rawImage','email','customerData','confirmedStoreId']){
 test('unexpected screenshot field '+f+' forbidden',()=>badScreenshot(x=>x[f]='untrusted'));
}
test('getMe + getWebhookInfo synthetic shape validated but not real',()=>{
 const x=inspectReadOnlyBotReadbackShape(response());
 assert.equal(x.shapeCandidate,true);
 assert.equal(x.botIdMatchesSyntheticFixture,true);
 assert.equal(x.currentWebhookConfiguredInFixture,true);
 assert.equal(x.webhookConfigurationMustNotChange,true);
 assert.equal(x.returnedWebhookUrlNeverLogged,true);
 assert.equal(x.existingWebhookDigestOnly.length,64);
 assert.equal(JSON.stringify(x).includes('test.example.invalid'),false);
 locked(x);
});
test('synthetic no webhook URL is a non-mutating state',()=>{
 const x=inspectReadOnlyBotReadbackShape(response(''));
 assert.equal(x.currentWebhookConfiguredInFixture,false);
 assert.equal(x.existingWebhookDigestOnly,null);
 locked(x);
});
test('invalid source cannot self attest actual API readback',()=>badProvider(
 'READBACK_FIXTURE_SCOPE_OR_BOT_ID_INVALID',x=>x.source='LIVE_ZALO'));
test('wrong channel is blocked',()=>badProvider(
 'READBACK_FIXTURE_SCOPE_OR_BOT_ID_INVALID',x=>x.provider='ZALO_OA'));
test('malformed Bot ID is blocked',()=>badProvider(
 'READBACK_FIXTURE_SCOPE_OR_BOT_ID_INVALID',x=>x.expectedBotId='bot.tien404'));
test('getMe Bot ID mismatch blocks',()=>badProvider(
 'GETME_BOT_ID_MISMATCH_OR_NOT_AUTHENTICATED',x=>x.getMeResponse.result.id='1459232241454765288'));
test('getMe not ok is blocked',()=>badProvider(
 'GETME_BOT_ID_MISMATCH_OR_NOT_AUTHENTICATED',x=>x.getMeResponse.ok=false));
test('getMe account name malformed blocked',()=>badProvider(
 'GETME_BOT_ID_MISMATCH_OR_NOT_AUTHENTICATED',x=>x.getMeResponse.result.account_name='user@zalo'));
test('getMe extra credential is rejected',()=>badProvider(
 'GETME_BOT_ID_MISMATCH_OR_NOT_AUTHENTICATED',x=>x.getMeResponse.result.access_token='unsafe'));
test('getWebhookInfo wrong response status refused',()=>badProvider(
 'GETWEBHOOKINFO_UNTRUSTED_OR_NON_HTTPS',x=>x.getWebhookInfoResponse.ok=false));
test('getWebhookInfo non-HTTPS refused',()=>badProvider(
 'GETWEBHOOKINFO_UNTRUSTED_OR_NON_HTTPS',x=>x.getWebhookInfoResponse.result.url='http://example.invalid/a'));
test('getWebhookInfo URL containing spaces refused',()=>badProvider(
 'GETWEBHOOKINFO_UNTRUSTED_OR_NON_HTTPS',x=>x.getWebhookInfoResponse.result.url='https://example.invalid/ bad'));
test('getWebhookInfo no timestamp refused',()=>badProvider(
 'GETWEBHOOKINFO_UNTRUSTED_OR_NON_HTTPS',x=>delete x.getWebhookInfoResponse.result.updated_at));
test('getWebhookInfo extra admin receipt refused',()=>badProvider(
 'GETWEBHOOKINFO_UNTRUSTED_OR_NON_HTTPS',x=>x.getWebhookInfoResponse.result.ownerAdminVerified=true));
test('wrong request mode refused',()=>badProvider(
 'READBACK_FIXTURE_SCOPE_OR_BOT_ID_INVALID',x=>x.mode='LIVE_PROD'));
test('secrets cannot be inserted into owner scope',()=>badProvider(
 'READBACK_FIXTURE_SCOPE_OR_BOT_ID_INVALID',x=>x.botToken='EXPOSED'));
test('unapproved webhook mutation refused',()=>badProvider(
 'READBACK_FIXTURE_SCOPE_OR_BOT_ID_INVALID',x=>x.noWebhookMutation=false));
test('unapproved send refused',()=>badProvider(
 'READBACK_FIXTURE_SCOPE_OR_BOT_ID_INVALID',x=>x.noProviderSend=false));
test('unapproved customer data read refused',()=>badProvider(
 'READBACK_FIXTURE_SCOPE_OR_BOT_ID_INVALID',x=>x.noCustomerData=false));
test('secret captured cannot be treated as fixture',()=>badProvider(
 'READBACK_FIXTURE_SCOPE_OR_BOT_ID_INVALID',x=>x.secretNotCaptured=false));
test('read-only private call plan only getMe/getWebhookInfo',()=>{
 const x=privateReadOnlyCallPlan();
 assert.deepEqual(x.allowedBotApiMethods,['getMe','getWebhookInfo']);
 assert.equal(x.httpMethod,'POST');
 assert.equal(x.providerHost,'bot-api.zaloplatforms.com');
 assert.equal(x.tokenInUrlPathMustNeverBeLogged,true);
 assert.equal(x.noNetworkExecuted,true);
 assert.equal(x.noActualTokenAvailableInThisArtifact,true);
 assert.equal(x.forbiddenMethods.includes('setWebhook'),true);
 assert.equal(x.forbiddenMethods.includes('sendMessage'),true);
 locked(x);
});
test('all green self declaration never opens native one-event ingress',()=>{
 const x=inspectOneNativeEventGate({
  screenshot:true,getMe:true,owner:true,operator:true,reviewer:true,
  allowOneRealMessage:true,botToken:true
 });
 assert.equal(x.status,'REAL_NATIVE_ONE_EVENT_NO_GO');
 assert.equal(x.acceptedRealMessages,0);
 assert.equal(x.allowedQaMessageCount,0);
 assert.equal(x.required.length,8);
 locked(x);
});
test('even null one-event input still denied',()=>{
 const x=inspectOneNativeEventGate(null);
 assert.equal(x.status,'REAL_NATIVE_ONE_EVENT_NO_GO');
 locked(x);
});
