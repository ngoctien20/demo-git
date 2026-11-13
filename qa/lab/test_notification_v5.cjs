/** Isolated contract regression: run with node --test qa/lab/test_notification_v5.cjs */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateSavedOrder, channelEligibility, prepareNotificationPlan, nextFallback
} = require('./notification_v5_contract.cjs');
const event = Object.freeze({
  tenant_id: 'TENANT_QA_A', store_id: 'STORE_QA_A', merchant_id: 'MERCHANT_QA_A',
  order_id: 'ORDER_QA_001', event_type: 'order_created', event_version: 1,
  event_id: 'TENANT_QA_A:STORE_QA_A:ORDER_QA_001:order_created:v1',
  saved_order_verified: true, customer_confirmed: true, status: 'pending',
  source_receipt_ref: 'STAGING_FAKE_RECEIPT', quantity: 2, unit_price: 159000, total: 318000
});
const common = {tenant_id:event.tenant_id, store_id:event.store_id, merchant_id:event.merchant_id,
  owner_verified:true, consent:true, recipient_verified:true, enabled:true};
const telegram = { ...common, channel:'telegram', recipient_ref:'7529646489' };
const gmail = { ...common, channel:'gmail', recipient_ref:'qa.owner@example.test' };
const zaloDisabled = { ...common, channel:'zalo', recipient_ref:'OA_UID_QA', enabled:false };
const discord = { ...common, channel:'discord', recipient_ref:'x' };
const opts = {mode:'single', primary_channel:'telegram', authenticated_tenant_id:event.tenant_id,
  authenticated_merchant_id:event.merchant_id, now_iso:'2026-11-13T00:00:00.000Z'};
const plan = (channels,overrides={}) => prepareNotificationPlan(event,channels,{...opts,...overrides});
const reject = (code,fn) => assert.throws(fn, {code});

test('01 saved synthetic order receipt validates',()=>assert.equal(validateSavedOrder(event).total,318000));
test('02 unverified order is denied',()=>reject('ORDER_NOT_VERIFIED',()=>validateSavedOrder({...event,saved_order_verified:false})));
test('03 missing explicit customer confirmation denied',()=>reject('CUSTOMER_NOT_CONFIRMED',()=>validateSavedOrder({...event,customer_confirmed:false})));
test('04 pending is not completed',()=>reject('ORDER_STATUS_INVALID',()=>validateSavedOrder({...event,status:'completed'})));
test('05 incorrect amount denied',()=>reject('ORDER_AMOUNT_INVALID',()=>validateSavedOrder({...event,total:317999})));
test('06 unsafe decimal quantity denied',()=>reject('ORDER_AMOUNT_INVALID',()=>validateSavedOrder({...event,quantity:1.2})));
test('07 wrong event ID denied',()=>reject('EVENT_ID_INVALID',()=>validateSavedOrder({...event,event_id:'FORGED'})));
test('08 missing readback receipt denied',()=>reject('EVENT_FIELD_INVALID_SOURCE_RECEIPT_REF',()=>validateSavedOrder({...event,source_receipt_ref:''})));
test('09 tenant from session must match',()=>reject('TENANT_AUTH_FAILED',()=>plan([telegram],{authenticated_tenant_id:'TENANT_QA_B'})));
test('10 merchant from session must match',()=>reject('MERCHANT_AUTH_FAILED',()=>plan([telegram],{authenticated_merchant_id:'MERCHANT_QA_B'})));
test('11 recipient from foreign store denied',()=>reject('CROSS_TENANT_RECIPIENT',()=>plan([{...telegram,store_id:'STORE_QA_B'}])));
test('12 duplicate channel config rejected',()=>reject('DUPLICATE_CHANNEL_CONFIGURATION',()=>plan([telegram,telegram])));
test('13 unknown channel rejected',()=>reject('CHANNEL_NAME_INVALID',()=>plan([discord])));
test('14 disabled Zalo does not prevent Telegram',()=>{const p=plan([zaloDisabled,telegram,gmail]);assert.deepEqual(p.routes.map(x=>x.channel),['telegram']);assert.equal(p.blocked[0].reason,'CHANNEL_DISABLED');assert.equal(p.dashboard_inbox,true);assert.equal(p.no_external_sends,true)});
test('15 parallel routes distinct channel idempotency keys',()=>{const p=plan([telegram,gmail],{mode:'parallel'});assert.equal(p.routes.length,2);assert.notEqual(p.routes[0].idempotency_key,p.routes[1].idempotency_key);assert.ok(p.routes.every(r=>r.status==='proposed_only'))});
test('16 blocked recipient remains blocked',()=>{const p=plan([{...telegram,recipient_verified:false}]);assert.equal(p.routes.length,0);assert.equal(p.blocked[0].reason,'RECIPIENT_NOT_VERIFIED')});
test('17 dashboard retained with no external channels',()=>{const p=plan([]);assert.equal(p.dashboard_inbox,true);assert.deepEqual(p.routes,[])});
test('18 Zalo requires authorized OA and policy',()=>{assert.equal(channelEligibility('zalo',{...common,recipient_ref:'QA_UID',oa_status:'disconnected'}).reason,'ZALO_OA_NOT_AUTHORIZED');assert.equal(channelEligibility('zalo',{...common,recipient_ref:'QA_UID',oa_status:'connected',api_permission_verified:true}).reason,'ZALO_POLICY_NOT_APPROVED')});
test('19 Zalo requires approved cost limit',()=>{const z={...common,recipient_ref:'QA_UID',oa_status:'connected',api_permission_verified:true,message_policy_approved:true,template_approved:true,billing_approved:true,estimated_cost_vnd:500,cost_ceiling_vnd:100};assert.equal(channelEligibility('zalo',z).reason,'ZALO_COST_NOT_APPROVED');z.cost_ceiling_vnd=500;assert.equal(channelEligibility('zalo',z).allowed,true)});
test('20 Meta PSID valid but 24h expired is blocked',()=>{const m={...common,recipient_ref:'1234567890',meta_page_verified:true,meta_policy_approved:true,inbound_hmac_verified:true,last_interaction_utc:'2026-11-11T00:00:00Z'};assert.equal(channelEligibility('messenger',m,opts.now_iso).reason,'META_INTERACTION_WINDOW_CLOSED')});
test('21 Meta fresh HMAC recipient is only eligible for preview',()=>{const m={...common,recipient_ref:'1234567890',meta_page_verified:true,meta_policy_approved:true,inbound_hmac_verified:true,last_interaction_utc:'2026-11-12T23:00:00Z'};assert.equal(channelEligibility('messenger',m,opts.now_iso).reason,'ELIGIBLE_FOR_PREVIEW_ONLY')});
test('22 fallback denied for uncertain or accepted first channel',()=>{const p=plan([telegram,gmail],{mode:'fallback'});assert.equal(nextFallback(p,'needs_review','gmail').allowed,false);assert.equal(nextFallback(p,'accepted','gmail').allowed,false)});
test('23 definitive failure can propose only eligible backup',()=>{const p=plan([telegram,gmail],{mode:'fallback'});assert.equal(nextFallback(p,'failed_definitive','gmail').allowed,true);assert.equal(nextFallback(p,'failed_definitive','zalo').allowed,false)});
test('24 no duplicate fallback channel',()=>{const p=plan([telegram,gmail],{mode:'fallback'});assert.equal(nextFallback(p,'failed_definitive','telegram').allowed,false)});
test('25 nonstandard/unsupported mode denied',()=>reject('ROUTING_MODE_INVALID',()=>plan([telegram],{mode:'broadcast'})));
test('26 gmail syntactic validation',()=>assert.equal(channelEligibility('gmail',{...gmail,recipient_ref:'not-email'}).reason,'GMAIL_ADDRESS_INVALID'));
test('27 Telegram numeric chat id validation',()=>assert.equal(channelEligibility('telegram',{...telegram,recipient_ref:'bad-chat-id'}).reason,'TELEGRAM_CHAT_ID_INVALID'));
test('28 missing Zalo approval never triggers send',()=>{const p=plan([zaloDisabled],{mode:'parallel'});assert.equal(p.no_external_sends,true);assert.equal(p.routes.length,0)});
