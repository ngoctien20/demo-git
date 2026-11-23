/**
 * TIEN404 V19.8.11 - Zalo Bot official READ-ONLY API identity evidence.
 *
 * The operator-only CLI performs exactly POST /getMe and /getWebhookInfo with
 * an existing Bot Token typed locally WITHOUT echo. NEVER in GitHub Actions.
 * No SetWebhook, SendMessage, credentials mutation or DB access.
 *
 * Even a successful official read check proves token->Bot identity and callback
 * configuration only. It does NOT attest merchant Store ownership or consent.
 */
import {pathToFileURL} from 'node:url';
import process from 'node:process';

const BOT_ID=/^[0-9]{12,22}$/;
const BOT_TOKEN=/^[0-9]{6,24}:[A-Za-z0-9_-]{6,512}$/;
const BASE='https://bot-api.zaloplatforms.com';
const invalid=(reason)=>({
 decision:'NO_GO',reason,botTokenValidated:false,webhookMatches:false,
 merchantConsentVerified:false,hostedCatalogAuthorized:false,
 canSend:false,canWrite:false,productionReady:false,providerSends:0
});
export function validateReadOnlyZaloResponses(expected,me,hook){
 if(!expected||typeof expected!=='object'||
  Object.keys(expected).sort().join(',')!=='botId,webhookUrl')
  return invalid('EXPECTED_BINDING_MISSING');
 if(typeof expected.botId!=='string'||!BOT_ID.test(expected.botId))
  return invalid('EXPECTED_BOT_ID_INVALID');
 let expectedUrl;
 try{expectedUrl=new URL(expected.webhookUrl)}
 catch{return invalid('EXPECTED_WEBHOOK_INVALID')}
 if(expectedUrl.protocol!=='https:'||!expectedUrl.hostname||expectedUrl.username||
   expectedUrl.password||expectedUrl.hash||
   expectedUrl.search||expectedUrl.port||
   !['443',''].includes(expectedUrl.port) ||
   expected.webhookUrl!==expectedUrl.href)
  return invalid('EXPECTED_WEBHOOK_INVALID');
 if(me?.ok!==true||typeof me?.result?.id!=='string'||
  !BOT_ID.test(me.result.id)||me.result.id!==expected.botId)
  return invalid('GETME_BOT_ID_MISMATCH');
 if(hook?.ok!==true||typeof hook?.result?.url!=='string'||
   hook.result.url!==expected.webhookUrl)
  return invalid('WEBHOOK_URL_MISMATCH');
 return {
  decision:'READONLY_PROVIDER_TOKEN_AND_WEBHOOK_MATCH',
  reason:'BOT_TOKEN_AND_WEBHOOK_MATCH_NOT_MERCHANT_OWNERSHIP',
  botTokenValidated:true,webhookMatches:true,
  merchantConsentVerified:false,hostedCatalogAuthorized:false,
  canSend:false,canWrite:false,productionReady:false,providerSends:0
 };
}
function safeError(){throw Error('READONLY_API_VERIFICATION_FAILED');}
async function officialRead(method,token){
 if(!['getMe','getWebhookInfo'].includes(method))safeError();
 if(!BOT_TOKEN.test(token))safeError();
 let response;
 try{
  // Bot Token is part of the official API URL, do not log URL/request/error.
  response=await fetch(BASE+'/bot'+token+'/'+method,{
   method:'POST',headers:{accept:'application/json','content-type':'application/json'},
   body:'{}',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)
  });
 }catch{safeError()}
 if(!response.ok)safeError();
 let payload;
 try{
  const content=await response.text();
  if(content.length>16384)safeError();
  payload=JSON.parse(content);
 }catch{safeError()}
 return payload;
}
async function hidden(label){
 if(!process.stdin.isTTY||!process.stdout.isTTY||!process.stdin.setRawMode)
  throw Error('OPERATOR_LOCAL_TTY_REQUIRED');
 process.stdout.write(label+': ');
 return new Promise((resolve,reject)=>{
  let input='';
  const previous=process.stdin.isRaw;
  function cleanup(){process.stdin.removeListener('data',handler);
   process.stdin.setRawMode(Boolean(previous));process.stdin.pause();
   process.stdout.write('\n');}
  function handler(buf){
   for(const ch of buf.toString('utf8')){
    if(ch==='\r'||ch==='\n'){cleanup();resolve(input);return;}
    if(ch==='\u0003'){cleanup();reject(Error('CANCELLED_BY_OPERATOR'));return;}
    if(ch==='\u007f'||ch==='\b')input=input.slice(0,-1);
    else if(ch>=' '&&input.length<2048)input+=ch;
   }
  }
  process.stdin.setRawMode(true);process.stdin.resume();
  process.stdin.on('data',handler);
 });
}
async function run(){
 if(process.argv[2]!=='--operator-readonly')throw Error('EXPLICIT_OPERATOR_FLAG_REQUIRED');
 const approval=await hidden('Enter READONLY_ZALO_GETME_WEBHOOKINFO_NO_SEND to confirm');
 if(approval!=='READONLY_ZALO_GETME_WEBHOOKINFO_NO_SEND')
  throw Error('OPERATOR_APPROVAL_MISSING');
 let token='';
 try{
  token=await hidden('Existing Bot Token (hidden; never stored)');
  const botId=await hidden('Expected Bot ID (hidden)');
  const webhookUrl=await hidden('Existing HTTPS webhook URL (hidden)');
  if(!BOT_TOKEN.test(token))throw Error('BOT_TOKEN_FORMAT_INVALID');
  const expected={botId,webhookUrl};
  const profile=await officialRead('getMe',token);
  const webhook=await officialRead('getWebhookInfo',token);
  const result=validateReadOnlyZaloResponses(expected,profile,webhook);
  // No raw Bot Token, URL, ID, usernames, response objects or PII printed.
  process.stdout.write(JSON.stringify({
   task:'TIEN404_V19811_ZALO_READONLY_OPERATOR',
   providerMethodsCalled:['getMe','getWebhookInfo'],
   decision:result.decision,botTokenValidated:result.botTokenValidated,
   webhookMatches:result.webhookMatches,
   merchantConsentVerified:false,hostedCatalogAuthorized:false,
   canSend:false,canWrite:false,productionReady:false,providerSends:0,
   recordedAtUtc:new Date().toISOString(),
   note:'Owner consent + protected signed Store session still required.'
  })+'\n');
 }finally{token='';}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 run().catch(e=>{
  // No network exception or request URL to avoid leaking Bot Tokens.
  const code=['OPERATOR_LOCAL_TTY_REQUIRED','EXPLICIT_OPERATOR_FLAG_REQUIRED',
   'OPERATOR_APPROVAL_MISSING','CANCELLED_BY_OPERATOR','BOT_TOKEN_FORMAT_INVALID']
   .includes(e.message)?e.message:'READONLY_ZALO_VERIFICATION_FAILED';
  process.stderr.write('TIEN404_V19811_NO_GO_'+code+'\n');process.exitCode=1;
 });
}
