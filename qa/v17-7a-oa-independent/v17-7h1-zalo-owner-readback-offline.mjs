// TIEN404 V17.7H.1 — OFFLINE Zalo Bot Creator API readback contract.
// Official provider getMe and getWebhookInfo are POST-shaped READ APIs.
// No HTTP calls or tokens here. Do not use setWebhook or sendMessage.
// Even a matching Bot Token getMe response DOES NOT prove the human
// owner of the Store or Bot Creator account. Require private admin proof.
const BOT=/^[0-9]{8,24}$/;
const ACCOUNT=/^bot\.[A-Za-z0-9._-]{5,80}$/i;
const REF=/^[a-zA-Z0-9_-]{12,96}$/;
const DENY=Object.freeze({
 sourceOnly:true,realBotTokenValidated:false,
 realBotCreatorAdminVerified:false,
 realStoreOwnerVerified:false,realWebhookOwnershipVerified:false,
 currentHostedWebhookInfoRead:false,
 realMetaPageOwnerVerified:false,
 canSetWebhook:false,canDeleteWebhook:false,canSendMessage:false,
 canOpenPublicRoute:false,canReadCommerce:false,canWriteCommerce:false,
 canPublish:false
});
const fail=(reason)=>Object.freeze({readbackShapeCandidate:false,reason,...DENY});
export function inspectZaloBotApiReadbackFixture(input){
 if(!input||input.mode!=='SYNTHETIC_OFFLINE_READBACK_ONLY'||
    input.source!=='OFFLINE_PROVIDER_FIXTURE'||
    input.noNetwork!==true||input.noMutation!==true||
    !REF.test(input.installationRef??'')||
    !BOT.test(input.expectedBotId??'')||
    Object.keys(input).some(k=>!['mode','source','noNetwork','noMutation',
      'installationRef','expectedBotId','getMe','getWebhookInfo'].includes(k)))
   return fail('PROVIDER_READBACK_SOURCE_OR_PIN_MISSING');
 const me=input.getMe,hook=input.getWebhookInfo;
 if(!me||!hook||typeof me!=='object'||typeof hook!=='object'||
    me.ok!==true||hook.ok!==true||
    !me.result||!hook.result||
    me.result.id!==input.expectedBotId||
    !ACCOUNT.test(me.result.account_name??''))
   return fail('GETME_BOT_ID_OR_WEBHOOKINFO_MISMATCH');
 // Never print actual webhook URL, bot display name, token, admin, IP or PII.
 const url=hook.result.url;
 if(typeof url!=='string'||url.length>2048 ||
    (url!==''&& !/^https:\/\/[^/\s]+(?:\/[^\s]*)?$/i.test(url)))
   return fail('WEBHOOK_URL_READBACK_NOT_HTTPS_OR_EMPTY');
 const validKeys=new Set(['url','updated_at']);
 if(Object.keys(hook.result).some(k=>!validKeys.has(k))||
    !Number.isSafeInteger(hook.result.updated_at))
   return fail('UNTRUSTED_WEBHOOK_INFO_READBACK_FIELDS');
 const status=url===''?'WEBHOOK_UNSET_SYNTHETIC':'EXISTING_WEBHOOK_DO_NOT_OVERWRITE';
 return Object.freeze({
   readbackShapeCandidate:true,
   reason:'SYNTHETIC_BOT_API_READBACK_SHAPE_NOT_PROVIDER_VERIFIED',
   webhookStatus:status,
   expectedBotPinned:true,
   exactProviderWebhookUnchanged:true,
   ...DENY
 });
}
export function requireActualPrivateOwnerAndReadOnlyGetMe(_claimedToken){
 return Object.freeze({
   readbackShapeCandidate:false,
   reason:'BOT_CREATOR_OWNER_CHALLENGE_AND_PRIVATE_GETME_NOT_EXECUTED',
   requiredMethods:['PRIVATE_BOT_CREATOR_ADMIN_SESSION',
     'GET_ME_READ_ONLY_WITH_PRIVATELY_MANAGED_TOKEN',
     'GET_WEBHOOK_INFO_READ_ONLY_BEFORE_ANY_CHANGE',
     'INDEPENDENT_QA_OPERATOR_AND_REVIEWER_CONSENT',
     'NO_SET_WEBHOOK_NO_SEND_MESSAGE_NO_DELETE_WEBHOOK'],
   ...DENY
 });
}
