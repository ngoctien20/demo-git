/**
 * TIEN404 CBOT-UAT-03 — Source-only Messenger Commerce Read-Only Adapter.
 * INHERITS CBOT-UAT02 synthetic lab; does NOT import AI_SALES_DEMO tools or credentials.
 * No provider I/O, hosted DB connection, paid AI, credential access, or order mutation.
 *
 * Security prerequisite for hosted: the real trusted gateway MUST authenticate the
 * raw Meta/Zalo event first and issue an opaque Store-scoped capability. This source
 * harness uses only the explicitly labeled synthetic fixture issuer from UAT02.
 */
import {CONTRACT} from '../cbot-uat02/crosschannel-core.mjs';

export const ADAPTER_CONTRACT='T404_CBOT_UAT03_READ_ONLY_CANDIDATE_V1';
const deny=(code)=>{throw new Error(code)};
const stable=x=>JSON.parse(JSON.stringify(x));

/** Business-approved phone policy: never guess a missing leading zero. */
export function normalizeVnPhoneStrict(phone){
  if(typeof phone!=='string')deny('PHONE_FORMAT_INVALID');
  const s=phone.trim();
  if(/^0\d{9}$/.test(s))return s;
  if(/^\+84\d{9}$/.test(s))return '0'+s.slice(3);
  deny('PHONE_FORMAT_INVALID');
}
/** Do not send arbitrary LLM text to a privileged database tool. */
export function parseReadOnlyIntent(text){
  if(typeof text!=='string'||text.length>256)return Object.freeze({type:'UNSUPPORTED'});
  const s=text.normalize('NFC').trim().replace(/\s+/g,' ');
  const match=/^(?:tra cứu đơn|tra cuu don|trạng thái đơn|trang thai don)\s+(QA-CBOT02-\d{4})$/iu.exec(s);
  if(match)return Object.freeze({type:'LOOKUP',order_id:match[1]});
  if(/^(?:đổi|sửa|hủy|huỷ|xóa|tạo|đặt|thêm|cập nhật|doi|sua|huy|xoa|tao|dat|update)\b/iu.test(s)
     ||/(?:\bcập nhật\b|\bthay đổi\b|\bdelete\b|\bdrop\b|\bupdate\b)/iu.test(s)){
    return Object.freeze({type:'MUTATION_DENIED'});
  }
  return Object.freeze({type:'UNSUPPORTED'});
}
const denied=()=>Object.freeze({
  contract:ADAPTER_CONTRACT,mode:'NO_SEND',kind:'READ_ONLY_REPLY_PREVIEW',
  result:'NOT_FOUND_OR_UNAUTHORIZED',text:'Không tìm thấy đơn phù hợp hoặc chưa xác minh quyền xem.',
  order:null,provider_sends:0,hosted_writes:0,paid_model_calls:0
});
/**
 * This function is deliberately NOT a runnable Meta webhook.
 * "event" is a synthetic post-gateway fixture envelope, not a verified provider event.
 * Input cannot carry tenant_id, store_id or a caller-supplied customer_id.
 */
export function createSyntheticMessengerCommerceAdapter({lab}={}){
  if(!lab||typeof lab.mintSyntheticIngress!=='function'||typeof lab.lookupOrder!=='function'){
    deny('VERIFIED_GATEWAY_AND_SCOPED_READER_REQUIRED');
  }
  const seen=new Map();
  function handle({event,text}={}){
    if(!event||event.contract!==CONTRACT||!['MESSENGER','ZALO_OA'].includes(event.channel))
      deny('SYNTHETIC_TRUST_ENVELOPE_REQUIRED');
    // The inner issuer enforces the known QA channel-account binding and refuses
    // injected store/tenant/role/customer fields. Never replace with JSON trust flags.
    const scoped=lab.mintSyntheticIngress(event);
    const intent=parseReadOnlyIntent(text);
    const replayKey=scoped.channel+'|'+scoped.account_id+'|'+scoped.participant_id+'|'+scoped.event_id;
    const fingerprint=JSON.stringify({store:scoped.store_id,text:typeof text==='string'?text:''});
    const replay=seen.get(replayKey);
    if(replay){
      if(replay.fingerprint!==fingerprint)deny('MESSAGE_ID_REPLAY_CONFLICT');
      return Object.freeze({...stable(replay.result),duplicate:true});
    }
    let output;
    if(intent.type==='MUTATION_DENIED'){
      output=Object.freeze({contract:ADAPTER_CONTRACT,mode:'NO_SEND',kind:'READ_ONLY_REPLY_PREVIEW',
        result:'WRITE_OPERATION_DISABLED',text:'Chưa hỗ trợ thay đổi đơn qua kênh này.',
        order:null,provider_sends:0,hosted_writes:0,paid_model_calls:0});
    }else if(intent.type!=='LOOKUP'){
      output=Object.freeze({contract:ADAPTER_CONTRACT,mode:'NO_SEND',kind:'READ_ONLY_REPLY_PREVIEW',
        result:'UNSUPPORTED_INTENT',text:'Vui lòng nhập: Tra cứu đơn [MÃ ĐƠN QA].',
        order:null,provider_sends:0,hosted_writes:0,paid_model_calls:0});
    }else{
      const result=lab.lookupOrder({context:scoped,order_id:intent.order_id});
      output=result.status==='FOUND'?
        Object.freeze({contract:ADAPTER_CONTRACT,mode:'NO_SEND',kind:'READ_ONLY_REPLY_PREVIEW',
          result:'FOUND',text:'Đã xác minh quyền xem đơn QA.',order:stable(result.data),
          provider_sends:0,hosted_writes:0,paid_model_calls:0}):
        denied();
    }
    // In-memory dedup is only a synthetic behavior check; hosted requires durable
    // idempotency/outbox transaction and explicit replay TTL.
    seen.set(replayKey,{fingerprint,result:stable(output)});
    return output;
  }
  return Object.freeze({handle,diagnostics:()=>Object.freeze({
    mode:'SYNTHETIC_NO_SEND',events_seen:seen.size,real_provider_attested:false,
    hosted_store_rls_verified:false,hosted_order_reader:false,read_only:true
  })});
}
export function executeOrderMutation(){deny('UAT03_ORDER_MUTATION_DISABLED')}
export function sendProviderReply(){deny('UAT03_PROVIDER_SEND_DISABLED')}
export function callPrivilegedRpc(){deny('UAT03_PRIVILEGED_RPC_DISABLED')}
