/**
 * TIEN404 V17.1-E isolated Meta callback CONTRACT — source QA only.
 * No listener, no provider network, no send API, no Orders, no model.
 * Consumer must supply private App Secret, verify token, QA Page ID and tester
 * identity via PRIVATE operator configuration. Never commit these values.
 * Production adapter requires signed owner evidence + atomic durable claim.
 */
import {createHmac,createHash,timingSafeEqual} from 'node:crypto';

export const CONTRACT='T404_V171E_ISOLATED_SIGNED_NOSEND_V1';
export const LIMIT_BYTES=32768;
const text=v=>typeof v==='string';
const ident=v=>text(v)&&/^[0-9]{5,30}$/.test(v);
const compare=(a,b)=>text(a)&&text(b)&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const hexhash=b=>createHash('sha256').update(b).digest('hex');
const result=(status,reason,code,detail={})=>Object.freeze({
  contract:CONTRACT,status,reason,http_status:code,
  meta_outbound:0,model_calls:0,commerce_writes:0,
  ...detail
});
function ready(config) {
  return config&&typeof config==='object'&&
    text(config.appSecret)&&config.appSecret.length>=20&&
    text(config.verifyToken)&&config.verifyToken.length>=12&&
    ident(config.qaPageId)&&ident(config.qaTesterPsid)&&
    config.ownerApproval?.qaAppPageIsolated===true&&
    config.ownerApproval?.callbackPermissionGranted===true&&
    config.ownerApproval?.merchantPageControlVerified===true&&
    config.ownerApproval?.evidenceReference?.startsWith('PRIVATE_')===true&&
    config.ownerApproval?.productionAppCallbackUnchanged===true&&
    typeof config.claimOnce==='function';
}
function reject(reason,http=403){return result('BLOCKED',reason,http);}
function handleGet(req,cfg){
  const q=new URL(req.url,'https://qa.invalid').searchParams;
  const challenge=q.get('hub.challenge');
  if(q.get('hub.mode')!=='subscribe'||!text(challenge)||!/^[0-9]{1,30}$/.test(challenge)||!compare(q.get('hub.verify_token'),cfg.verifyToken))
    return reject('GET_VERIFY_TOKEN_INVALID');
  return result('QA_VERIFY_CHALLENGE_ACCEPTED','VERIFICATION_TOKEN_MATCH_ONLY_NOT_META_OWNER_PROOF',200,{response_text:challenge});
}
function validatedMeta(raw,now,cfg){
  const b=JSON.parse(raw.toString('utf8'));
  if(b?.object!=='page'||!Array.isArray(b.entry)||b.entry.length!==1)
    throw Error('META_OBJECT_OR_BATCH_UNSUPPORTED');
  for(const key of ['tenant_id','store_id','bot_id','verification_status','verified'])
    if(Object.hasOwn(b,key))throw Error('CLIENT_AUTHORITY_CLAIM_DENIED');
  const e=b.entry[0];
  if(e?.id!==cfg.qaPageId||!Array.isArray(e.messaging)||e.messaging.length!==1)
    throw Error('UNBOUND_PAGE_OR_BATCH_DENIED');
  const m=e.messaging[0];
  if(m?.recipient?.id!==cfg.qaPageId||m?.sender?.id!==cfg.qaTesterPsid)
    throw Error('QA_PAGE_OR_TESTER_MISMATCH');
  if(!Number.isSafeInteger(m.timestamp)||Math.abs(now-m.timestamp)>300000)
    throw Error('EVENT_TIMESTAMP_OUTSIDE_QA_WINDOW');
  if(!m.message||m.message.is_echo===true||m.message.is_deleted===true||
     m.message.is_unsupported===true)throw Error('MESSAGE_TYPE_UNSUPPORTED');
  if(!text(m.message.mid)||m.message.mid.length<1||m.message.mid.length>256)
    throw Error('MID_REQUIRED');
  if(!text(m.message.text)||m.message.text.length<1||m.message.text.length>1000)
    throw Error('TEXT_ONLY_QA');
  for(const x of [e,m,m.message]){
    for(const key of ['tenant_id','store_id','bot_id','verification_status','verified'])
      if(Object.hasOwn(x,key))throw Error('CLIENT_AUTHORITY_CLAIM_DENIED');
  }
  return {mid:m.message.mid};
}
export async function handleIsolatedMeta({method,url,headers={},rawBody},cfg={},clock=()=>Date.now()){
  // FAIL CLOSED: sign-off fields come from PRIVATE operator-controlled approval,
  // never from an HTTP header or the message body. This is an integration gate,
  // NOT independent certification of Business Manager / Meta App ownership.
  if(!ready(cfg))return reject('PRIVATE_QA_OWNER_PROOF_OR_ATOMIC_CLAIM_MISSING');
  if(method==='GET')return handleGet({url},cfg);
  if(method!=='POST')return reject('HTTP_METHOD_DENIED',405);
  if(!Buffer.isBuffer(rawBody)||rawBody.length===0||rawBody.length>LIMIT_BYTES)
    return reject('RAW_BODY_REQUIRED_AND_BOUNDED',413);
  const sig=headers['x-hub-signature-256']??headers['X-Hub-Signature-256'];
  if(!text(sig)||!/^sha256=[0-9a-f]{64}$/.test(sig))
    return reject('META_HMAC_MISSING_OR_MALFORMED');
  const expected=createHmac('sha256',cfg.appSecret).update(rawBody).digest('hex');
  if(!compare(sig.slice(7),expected))return reject('META_HMAC_MISMATCH');
  let parsed;
  try{parsed=validatedMeta(rawBody,clock(),cfg)}
  catch{return reject('SIGNED_EVENT_NOT_ELIGIBLE_FOR_QA');}
  // Claim needs to be an atomic durable operation in any real hosted test.
  // If claimOnce returns unknown, DENY — never silently use local memory.
  const receiptId=hexhash(Buffer.from(cfg.qaPageId+':'+parsed.mid));
  let claimed;
  try{claimed=await cfg.claimOnce(receiptId)}
  catch{return reject('DURABLE_CLAIM_FAILED',503);}
  if(claimed==='duplicate')return result('DUPLICATE_IGNORED','DURABLE_CLAIM_DUPLICATE',200,{receipt_id:receiptId});
  if(claimed!=='claimed')return reject('DURABLE_CLAIM_NOT_CONFIRMED',503);
  // NO bot call, no customer data access, no third-party messaging, no storage
  // of raw payload. A later authorized integration may use this attestation.
  return result('SIGNED_QA_EVENT_NO_SEND','META_HMAC_MATCHED_PRIVATE_QA_SCOPE',200,{
    receipt_id:receiptId,
    signature_matched_configured_app_secret:true,
    page_and_test_sender_matched_private_configuration:true,
    merchant_owner_proved_independently_by_this_code:false,
    owner_approval_reference_scope:'PRIVATE_OPERATOR_ATTESTATION',
    mock_outbound:'NO_SEND',
    accepted_as_real_provider_delivery:false
  });
}
