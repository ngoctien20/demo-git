// TIEN404 V17.7H.2 — private read-only Bot API runner contract.
// No imports of fetch/axios/http: this module NEVER reaches the network.
// A separate authenticated operator service must hold the Bot Token in a
// vault. NEVER return the token-bearing URL, webhook URL, raw error, actor,
// response, name, auth state or message to ChatGPT, GitHub Actions or logs.
// The only permitted API method strings are getMe + getWebhookInfo.
import {createHash} from 'node:crypto';

const BOT_ID=/^[0-9]{8,24}$/;
const INSTALL=/^[A-Za-z0-9][A-Za-z0-9_-]{11,95}$/;
const SHA=x=>createHash('sha256').update(x,'utf8').digest('hex');
const GATE=Object.freeze({
 sourceOnly:true,realBotCreatorOwnerVerified:false,
 realProviderSessionVerified:false,realStoreOwnerVerified:false,
 realPrivateIssuerVerified:false,realOperatorVerified:false,
 realReviewerVerified:false,realOwnerConsentSigned:false,
 realProviderSignedWebhookReceived:false,
 realHostedRateAndReplayVerified:false,
 realStoreABJwtRlsVerified:false,
 canSendProvider:false,canUpdateWebhook:false,
 canReadCommerce:false,canWriteCommerce:false,
 canPublish:false
});
const fail=reason=>Object.freeze({
 readbackFixturePassed:false,
 status:'PRIVATE_READBACK_NOT_REAL_OWNER_ACCEPTANCE',
 reason,...GATE
});
const pass=details=>Object.freeze({
 readbackFixturePassed:true,
 status:'PRIVATE_READONLY_METHOD_CONTRACT_SHAPE_ONLY',
 reason:'MOCK_TRANSPORT_IS_NOT_REAL_BOT_ADMIN_SESSION',
 ...GATE,...details
});
/** Injected transport only; it MUST be a separately approved private vault
 * component, but CI currently injects strictly a MOCK and never calls Zalo.
 * Nothing in this function can independently attest that the transport is
 * genuine or that the caller owns the Zalo Bot Creator account.
 */
export async function inspectTwoReadOnlyCalls(intent,transport){
 if(!intent||typeof intent!=='object'||Array.isArray(intent)||
    Object.keys(intent).some(k=>![
      'mode','channel','installationRef','expectedBotId','noSend',
      'noMutation','noCommerceReadWrite','transportKind'
    ].includes(k))||
    intent.mode!=='OFFLINE_INJECTED_MOCK_ONLY'||
    intent.channel!=='ZALO_BOT'||
    !INSTALL.test(intent.installationRef??'')||
    !BOT_ID.test(intent.expectedBotId??'')||
    intent.noSend!==true||intent.noMutation!==true||
    intent.noCommerceReadWrite!==true||
    intent.transportKind!=='OFFLINE_FIXTURE'||
    !transport||transport.kind!=='OFFLINE_FIXTURE'||
    typeof transport.callReadOnly!=='function')
   return fail('NO_PRIVATE_TRUSTED_TRANSPORT_OR_BOT_ID_PIN');
 let me,web;
 try{
   me=await transport.callReadOnly('getMe');
   if(!me||me.ok!==true||typeof me.result!=='object'||
       me.result?.id!==intent.expectedBotId||
       typeof me.result?.account_name!=='string'||
       !/^bot\.[A-Za-z0-9._-]{5,80}$/i.test(me.result.account_name))
     return fail('GETME_ID_OR_TOKEN_ACCESS_NOT_VERIFIED');
   web=await transport.callReadOnly('getWebhookInfo');
   if(!web||web.ok!==true||typeof web.result!=='object'||
      typeof web.result.url!=='string'||web.result.url.length>2048||
      !Number.isSafeInteger(web.result.updated_at)||
      (web.result.url!==''&&
       !/^https:\/\/[a-z0-9.-]+(?::443)?(?:\/[^\s]*)?$/i.test(web.result.url)))
     return fail('GETWEBHOOKINFO_UNTRUSTED_OR_MUTATION_RISK');
 }catch{
   // Never expose native fetch error strings: they may contain Bot Token in URL.
   return fail('PRIVATE_PROVIDER_READBACK_FAILED_REDACTED');
 }
 return pass({
  botIdSha256:SHA(me.result.id),
  configuredWebhook:web.result.url.length>0,
  webhookUrlSha256:web.result.url?SHA(web.result.url):null,
  existingWebhookMustRemainUnchanged:true,
  requestsExpectedExactlyTwo:true,
  readOnlyMethodList:Object.freeze(['getMe','getWebhookInfo']),
  noActualProviderNetworkMadeByThisModule:true,
  approvedRealProviderCallsExecuted:0,
  realOwnerAdminAttestationPresent:false
 });
}
export const expectedReadOnlyMethods=Object.freeze(['getMe','getWebhookInfo']);
