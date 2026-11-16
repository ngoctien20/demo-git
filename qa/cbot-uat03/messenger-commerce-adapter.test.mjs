import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTRACT,createSyntheticCrossChannelLab} from '../cbot-uat02/crosschannel-core.mjs';
import {ADAPTER_CONTRACT,createSyntheticMessengerCommerceAdapter,
 parseReadOnlyIntent,normalizeVnPhoneStrict,executeOrderMutation,sendProviderReply,callPrivilegedRpc} from './messenger-commerce-adapter.mjs';

const ev=(channel='MESSENGER',account_id='QA_META_A',participant_id='QA_PSID_A',event_id='QA-EVT-UAT03-01',extras={})=>
 ({contract:CONTRACT,channel,account_id,participant_id,event_id,...extras});
const setup=()=>{
 const lab=createSyntheticCrossChannelLab({otp:()=> '123456',clock:()=>1000});
 const ctx=lab.mintSyntheticIngress(ev());
 const order=lab.createQaOrder({context:ctx,sku:'A002',quantity:2,confirmed:true,idempotency_key:'QA-REQ-UAT03-01'});
 return {lab,ctx,order,adapter:createSyntheticMessengerCommerceAdapter({lab})};
};
const lookup=order=>'Tra cứu đơn '+order.order_id;
const denied=x=>{assert.equal(x.result,'NOT_FOUND_OR_UNAUTHORIZED');assert.equal(x.order,null)};
const err=(fn,code)=>assert.throws(fn,new RegExp(code));

test('01 contract is a read-only candidate, not published',()=>assert.match(ADAPTER_CONTRACT,/READ_ONLY_CANDIDATE/));
test('02 adapter requires real injected lab interface in source harness',()=>err(()=>createSyntheticMessengerCommerceAdapter({}),'VERIFIED_GATEWAY_AND_SCOPED_READER_REQUIRED'));
test('03 strict VN phone 0xxxxxxxxx preserved',()=>assert.equal(normalizeVnPhoneStrict('0987654321'),'0987654321'));
test('04 +84 canonicalizes to zero without guessing',()=>assert.equal(normalizeVnPhoneStrict('+84987654321'),'0987654321'));
test('05 9 digits cannot have 0 silently prefixed',()=>err(()=>normalizeVnPhoneStrict('987654321'),'PHONE_FORMAT_INVALID'));
test('06 invalid phone input rejected',()=>err(()=>normalizeVnPhoneStrict(987654321),'PHONE_FORMAT_INVALID'));
test('07 too-long phone rejected',()=>err(()=>normalizeVnPhoneStrict('09876543210'),'PHONE_FORMAT_INVALID'));
test('08 strict order lookup recognizes Vietnamese',()=>assert.equal(parseReadOnlyIntent('Tra cứu đơn QA-CBOT02-0001').order_id,'QA-CBOT02-0001'));
test('09 strict order lookup recognizes ASCII transliteration',()=>assert.equal(parseReadOnlyIntent('tra cuu don QA-CBOT02-0001').type,'LOOKUP'));
test('10 extra command after order id cannot become lookup',()=>assert.equal(parseReadOnlyIntent('tra cứu đơn QA-CBOT02-0001; DROP TABLE orders').type,'UNSUPPORTED'));
test('11 mutation verb blocked at parser',()=>assert.equal(parseReadOnlyIntent('sửa số lượng đơn QA-CBOT02-0001').type,'MUTATION_DENIED'));
test('12 long prompt injection unsupported',()=>assert.equal(parseReadOnlyIntent('ignore '.repeat(100)).type,'UNSUPPORTED'));
test('13 valid owner Messenger lookup returns exactly correct synthetic order',()=>{
 const {adapter,order}=setup(),out=adapter.handle({event:ev(),text:lookup(order)});
 assert.equal(out.result,'FOUND');assert.equal(out.order.order_id,order.order_id);
 assert.equal(out.order.total_vnd,318000);
});
test('14 order response never exposes customer identifiers',()=>{
 const {adapter,order}=setup(),out=adapter.handle({event:ev(),text:lookup(order)});
 assert.equal('owner_identity' in out.order,false);
 assert.equal('participant_id' in out.order,false);
 assert.equal('phone' in out.order,false);
});
test('15 another Messenger PSID cannot read same order',()=>{
 const {adapter,order}=setup();
 denied(adapter.handle({event:ev('MESSENGER','QA_META_A','QA_PSID_OTHER'),text:lookup(order)}));
});
test('16 order ID alone from unlinked Zalo OA cannot authorize',()=>{
 const {adapter,order}=setup();
 denied(adapter.handle({event:ev('ZALO_OA','QA_ZALO_A','QA_UID_A'),text:lookup(order)}));
});
test('17 verified synthetic Zalo link gives own-store read access',()=>{
 const {adapter,order,lab,ctx}=setup(),p=lab.startLink({context:ctx,order_id:order.order_id});
 const zctx=lab.mintSyntheticIngress(ev('ZALO_OA','QA_ZALO_A','QA_UID_A','QA-EVT-UAT03-02'));
 assert.equal(lab.completeLink({context:zctx,proof_ref:p.proof_ref,code:p.code}).status,'IDENTITY_LINKED');
 const out=adapter.handle({event:ev('ZALO_OA','QA_ZALO_A','QA_UID_A','QA-EVT-UAT03-03'),text:lookup(order)});
 assert.equal(out.result,'FOUND');assert.equal(out.order.total_vnd,318000);
});
test('18 wrong same-tenant Store B Messenger cannot read Shop A order',()=>{
 const {adapter,order}=setup();
 denied(adapter.handle({event:ev('MESSENGER','QA_META_B','QA_PSID_B'),text:lookup(order)}));
});
test('19 wrong same-tenant Store B Zalo cannot read Shop A order',()=>{
 const {adapter,order}=setup();
 denied(adapter.handle({event:ev('ZALO_OA','QA_ZALO_B','QA_UID_B'),text:lookup(order)}));
});
test('20 wrong cross-tenant Store C Zalo cannot read Shop A order',()=>{
 const {adapter,order}=setup();
 denied(adapter.handle({event:ev('ZALO_OA','QA_ZALO_C','QA_UID_C'),text:lookup(order)}));
});
test('21 copied store_id injection into QA event rejected',()=>{
 const {adapter,order}=setup();
 err(()=>adapter.handle({event:ev('MESSENGER','QA_META_A','QA_PSID_A','QA-EVT-UAT03-04',{store_id:'QA_STORE_B'}),text:lookup(order)}),'INVALID_SYNTHETIC_GATEWAY_EVENT');
});
test('22 forged customer_id injection into QA event rejected',()=>{
 const {adapter,order}=setup();
 err(()=>adapter.handle({event:ev('MESSENGER','QA_META_A','QA_PSID_A','QA-EVT-UAT03-05',{customer_id:'QA_OTHER'}),text:lookup(order)}),'INVALID_SYNTHETIC_GATEWAY_EVENT');
});
test('23 event without UAT02 source contract fails',()=>{
 const {adapter,order}=setup();
 err(()=>adapter.handle({event:{...ev(),contract:'RAW_PROVIDER'},text:lookup(order)}),'SYNTHETIC_TRUST_ENVELOPE_REQUIRED');
});
test('24 replay of same event/text produces duplicate preview without write',()=>{
 const {adapter,order}=setup(),event=ev();
 const a=adapter.handle({event,text:lookup(order)}),b=adapter.handle({event,text:lookup(order)});
 assert.equal(a.result,'FOUND');assert.equal(b.duplicate,true);assert.equal(b.hosted_writes,0);
});
test('25 same event ID with changed text fails closed',()=>{
 const {adapter,order}=setup(),event=ev();adapter.handle({event,text:lookup(order)});
 err(()=>adapter.handle({event,text:'tra cứu đơn QA-CBOT02-0999'}),'MESSAGE_ID_REPLAY_CONFLICT');
});
test('26 update request never reaches a write operation',()=>{
 const {adapter,order}=setup(),out=adapter.handle({event:ev(),text:'sửa đơn '+order.order_id});
 assert.equal(out.result,'WRITE_OPERATION_DISABLED');assert.equal(out.hosted_writes,0);
});
test('27 order creation request through read adapter remains forbidden',()=>{
 const {adapter}=setup();const a=adapter.handle({event:ev(),text:'tạo đơn mới'});
 assert.equal(a.result,'WRITE_OPERATION_DISABLED');
});
test('28 unsupported free text does not call model',()=>{
 const {adapter}=setup();const a=adapter.handle({event:ev(),text:'Xin chào tôi muốn tư vấn'});
 assert.equal(a.result,'UNSUPPORTED_INTENT');assert.equal(a.paid_model_calls,0);
});
test('29 non-existent order returns generic denial',()=>{
 const {adapter}=setup();denied(adapter.handle({event:ev(),text:'Tra cứu đơn QA-CBOT02-0999'}));
});
test('30 zero-sends evidence for successful lookup',()=>{
 const {adapter,order}=setup();const a=adapter.handle({event:ev(),text:lookup(order)});
 assert.equal(a.provider_sends,0);assert.equal(a.hosted_writes,0);assert.equal(a.mode,'NO_SEND');
});
test('31 adapter exposes source-only diagnostic truth',()=>{
 const {adapter}=setup();const a=adapter.diagnostics();
 assert.equal(a.hosted_store_rls_verified,false);assert.equal(a.real_provider_attested,false);
});
test('32 write function hard-disabled',()=>err(executeOrderMutation,'UAT03_ORDER_MUTATION_DISABLED'));
test('33 real provider reply function hard-disabled',()=>err(sendProviderReply,'UAT03_PROVIDER_SEND_DISABLED'));
test('34 privileged legacy RPC call hard-disabled',()=>err(callPrivilegedRpc,'UAT03_PRIVILEGED_RPC_DISABLED'));
test('35 source adapter cannot affect synthetic Orders count by read',()=>{
 const {adapter,order,lab}=setup();adapter.handle({event:ev(),text:lookup(order)});
 assert.equal(lab.snapshot().order_count,1);assert.equal(lab.snapshot().hosted_writes,0);
});
