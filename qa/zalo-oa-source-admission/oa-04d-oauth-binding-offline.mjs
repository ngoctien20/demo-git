// TIEN404 V17.ZALO-SOURCE-04D — OAuth callback binding shape, offline ONLY.
// Zalo OA docs allow state OR a custom parameter in redirect_uri. Never accept
// a callback without one previously issued server-side 256-bit nonce bound to
// the same authenticated owner session. No HTTP, OAuth exchange or token custody.
import {createHash,timingSafeEqual} from 'node:crypto';

const PARAMS=new Set(['code','oa_id','state','tien404_qa']);
const B64_43=/^[A-Za-z0-9_-]{43}$/;
const OA_ID=/^[0-9]{5,25}$/;
const HASH=/^[a-f0-9]{64}$/;
const refused=reason=>Object.freeze({bindingCandidate:false,reason,
  ownerGrantVerified:false,oaProfileVerified:false,
  canExchangeOAuthCode:false,canConnectStore:false,
  canSend:false,canWriteOrders:false,liveProviderUat:false});
const pending=()=>Object.freeze({bindingCandidate:true,
  reason:'OFFLINE_CALLBACK_BINDING_SHAPE_VALID_UNVERIFIED_PROVIDER',
  ownerGrantVerified:false,oaProfileVerified:false,
  canExchangeOAuthCode:false,canConnectStore:false,
  canSend:false,canWriteOrders:false,liveProviderUat:false});
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const equals=(a,b)=>HASH.test(a??'')&&HASH.test(b??'')&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const ms=x=>Number.isSafeInteger(x)&&x>0;
export function makeOfflineCallbackFixtureHash(secret){return typeof secret==='string'?sha(secret):null;}

/**
 * @param {{callbackUrl:string, pinnedRedirectBase:string, transaction:object}} input
 * transaction MUST come from a separately authenticated server-side one-time store:
 *  {mode:'STATE_QUERY'|'REDIRECT_QUERY_NONCE', stateOrNonceDigest, ownerActorId,
 *    ownerSessionDigest, expiresAtMs, appId, storeId, tenantId, canSend:false}.
 * ctx MUST come from a fresh owner session verifier, never from callback query.
 * deps.consumeOnce() must be atomic in real usage. Here mocked exclusively.
 */
export async function inspectOaOAuthCallbackBinding(input,ctx,deps){
  if(!deps||deps.executionMode!=='OFFLINE_FIXTURE_ONLY'||deps.liveEnabled!==false||
    typeof deps.consumeOnce!=='function'||!input||!ctx||!input.transaction)
    return refused('SERVER_ONE_SHOT_CALLBACK_DEPENDENCIES_MISSING');
  const t=input.transaction;
  const now=deps.nowMs??Date.now();
  if(!ms(now)||!ctx.ownerAuthenticated||ctx.ownerRevoked!==false||
    typeof ctx.ownerActorId!=='string'||!ctx.ownerActorId||
    typeof ctx.ownerSessionId!=='string'||ctx.ownerSessionId.length<8)
    return refused('FRESH_OWNER_SESSION_REQUIRED');
  if(typeof t.appId!=='string'||!OA_ID.test(t.appId)||
    typeof t.tenantId!=='string'||!t.tenantId||
    typeof t.storeId!=='string'||!t.storeId||
    t.ownerActorId!==ctx.ownerActorId||!equals(t.ownerSessionDigest,sha(ctx.ownerSessionId))||
    !ms(t.createdAtMs)||!ms(t.expiresAtMs)||
    t.createdAtMs>now||now-t.createdAtMs>5*60*1000||
    t.expiresAtMs<=now||t.expiresAtMs>t.createdAtMs+5*60*1000||
    t.canSend!==false||t.canWriteOrders!==false)
    return refused('TRUSTED_TRANSACTION_NOT_BOUND_TO_OWNER');
  let uri,base;
  try{uri=new URL(input.callbackUrl);base=new URL(input.pinnedRedirectBase);}
  catch{return refused('INVALID_CALLBACK_URL');}
  if(uri.protocol!=='https:'||base.protocol!=='https:'||
    uri.username||uri.password||uri.hash||base.username||base.password||
    base.search||base.hash||uri.origin!==base.origin||uri.pathname!==base.pathname)
    return refused('EXACT_HTTPS_CALLBACK_NOT_MATCHED');
  if(uri.searchParams.has('error'))return refused('PROVIDER_OAUTH_ERROR');
  if([...uri.searchParams.keys()].some(k=>!PARAMS.has(k)))
    return refused('UNKNOWN_QUERY_FIELDS_REQUIRE_PROVIDER_REVIEW');
  for(const k of PARAMS)if(uri.searchParams.getAll(k).length>1)
    return refused('DUPLICATED_CALLBACK_PARAMETER');
  const code=uri.searchParams.get('code');
  const oaId=uri.searchParams.get('oa_id');
  if(typeof code!=='string'||code.length<8||code.length>2048||
     /[\u0000-\u001f\u007f]/.test(code)||!/^[^\s<>]+$/.test(code))
    return refused('CODE_FORMAT_UNVERIFIED');
  if(!OA_ID.test(oaId??''))return refused('OA_ID_CLAIM_FORMAT_INVALID');
  let nonce;
  if(t.mode==='STATE_QUERY'){
    if(uri.searchParams.has('tien404_qa'))return refused('AMBIGUOUS_CALLBACK_BINDING');
    nonce=uri.searchParams.get('state');
  }else if(t.mode==='REDIRECT_QUERY_NONCE'){
    if(uri.searchParams.has('state'))return refused('AMBIGUOUS_CALLBACK_BINDING');
    nonce=uri.searchParams.get('tien404_qa');
  }else return refused('UNSUPPORTED_CALLBACK_BINDING_MODE');
  if(!B64_43.test(nonce??'')||!equals(t.stateOrNonceDigest,sha(nonce)))
    return refused('STATE_OR_REDIRECT_NONCE_NOT_MATCHED');
  let once;
  try{once=await deps.consumeOnce(sha(JSON.stringify([
    'TIEN404_OA_CALLBACK_04D',t.appId,t.tenantId,t.storeId,t.ownerActorId,t.mode,nonce
  ])));}
  catch{return refused('ATOMIC_STATE_SERVICE_UNAVAILABLE');}
  if(once!==true)return refused('CALLBACK_REPLAY_OR_ALREADY_USED');
  return pending();
}
