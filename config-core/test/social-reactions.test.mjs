import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOCIAL_REACTIONS_VERSION, SUPPORTED_CHANNELS, REACTION_EMOJI,
  classifyLightweightReaction, decideSocialReaction, buildMetaReactionDryRun,
  evaluateReactionSendResult, classifyCustomerReactionEvent,
} from '../lib/social-reactions.mjs';

const event = (patch = {}) => ({
  channel: 'messenger', kind: 'message', messageType: 'text',
  tenantId: 'tenant-a', pageId: '1234567', senderId: '7654321',
  messageId: 'mid.$abc-123', text: 'Cảm ơn shop nhé!', ...patch,
});
const gate = (patch = {}) => ({
  featureEnabled: true, signatureVerified: true, tenantResolved: true,
  pageAuthorized: true, botOwnsThread: true, withinMessagingWindow: true,
  cooldownGranted: true, allowedPageIds: ['1234567'], ...patch,
});

test('version is explicitly candidate and only Messenger/Web channels have reaction capability', () => {
  assert.equal(SOCIAL_REACTIONS_VERSION, 'v21-candidate-1');
  assert.equal(SUPPORTED_CHANNELS.messenger, true);
  assert.equal(SUPPORTED_CHANNELS.web, true);
  assert.equal(SUPPORTED_CHANNELS.zalo_bot, false);
  assert.equal(SUPPORTED_CHANNELS.zalo_oa, false);
});

test('conservative social phrases can become candidates without calling an LLM', () => {
  assert.equal(classifyLightweightReaction('Cảm ơn shop nhé! ❤️'), REACTION_EMOJI.THANKS);
  assert.equal(classifyLightweightReaction('THANK YOU'), REACTION_EMOJI.THANKS);
  assert.equal(classifyLightweightReaction('Shop dễ thương quá!'), REACTION_EMOJI.PRAISE);
  assert.equal(classifyLightweightReaction('Yêu shop nha'), REACTION_EMOJI.PRAISE);
});

test('question, order, payments, approval and mixed intent never become reaction-only', () => {
  for (const s of [
    'Cảm ơn shop, đặt giúp tôi 2 món',
    'Cảm ơn shop, giá bao nhiêu?',
    'Được, tiếp tục',
    'Đồng ý migration Supabase',
    'Ok',
    '👍',
    'Cho tôi gặp nhân viên',
    'Cảm ơn đã hỗ trợ lỗi đơn hàng',
    'Cảm ơn, hãy xóa dữ liệu',
    'Cảm ơn shop, tôi chưa nhận hàng',
    'Tôi thích mẫu này, mua luôn',
  ]) assert.equal(classifyLightweightReaction(s), null, s);
});

test('feature flag OFF is pass-through, not an extra bot reply', () => {
  assert.deepEqual(decideSocialReaction(event(), gate({featureEnabled:false})),
    {mode:'pass_through',reason:'feature_disabled'});
});

test('missing or untrusted HMAC, tenant and page guards fail closed', () => {
  for (const field of ['signatureVerified','tenantResolved','pageAuthorized']) {
    assert.notEqual(decideSocialReaction(event(),gate({[field]:false})).mode,'reaction_candidate',field);
  }
});

test('only explicit allowed Page can receive a candidate (tenant A vs B)', () => {
  assert.equal(decideSocialReaction(event({pageId:'2222222'}),gate()).reason,'page_not_allowlisted');
  assert.equal(decideSocialReaction(event({tenantId:'tenant-b',pageId:'2222222'}),gate({allowedPageIds:['2222222']})).mode,'reaction_candidate');
});

test('same Meta MID in another Page or tenant gets a different dedupe key', () => {
  const a=decideSocialReaction(event(),gate());
  const b=decideSocialReaction(event({pageId:'2222222'}),gate({allowedPageIds:['2222222']}));
  const c=decideSocialReaction(event({tenantId:'tenant-b'}),gate());
  assert.equal(a.mode,'reaction_candidate');
  assert.notEqual(a.dedupeKey,b.dedupeKey);
  assert.notEqual(a.dedupeKey,c.dedupeKey);
  assert.equal(a.dedupeKey,decideSocialReaction(event(),gate()).dedupeKey);
});

test('bad, missing, swapped or invented message identity is rejected', () => {
  for(const patch of [
    {messageId:undefined}, {messageId:'a'}, {senderId:'1234567'},
    {pageId:'1'}, {tenantId:''}, {messageId:'mid with spaces'},
  ]) assert.notEqual(decideSocialReaction(event(patch),gate()).mode,'reaction_candidate');
});

test('handoff, order, billing, approval, menu or tool execution always takes normal path', () => {
  for (const field of [
    'handoffActive','handoffPending','commercePending','approvalPending',
    'menuAction','orderAction','privilegedAction','toolCallPlanned',
  ]) assert.equal(decideSocialReaction(event(),gate({[field]:true})).mode,'pass_through',field);
});

test('reaction does not steal control from human agent or exceed messaging window', () => {
  for(const field of ['botOwnsThread','withinMessagingWindow','cooldownGranted']) {
    assert.equal(decideSocialReaction(event(),gate({[field]:false})).mode,'pass_through');
  }
});

test('voice, comment, postback, echo and reaction webhook do not create outgoing reactions', () => {
  for(const patch of [
    {messageType:'voice'}, {kind:'comment'}, {kind:'postback'}, {kind:'echo'},
    {kind:'message_reaction'}, {channel:'zalo_bot'}, {channel:'web'},
  ]) assert.notEqual(decideSocialReaction(event(patch),gate()).mode,'reaction_candidate');
});

test('positive decision creates a dry-run only Meta request with original MID and PSID', () => {
  const decision=decideSocialReaction(event(),gate());
  const request=buildMetaReactionDryRun(decision);
  assert.equal(decision.mode,'reaction_candidate');
  assert.equal(request.status,'DRY_RUN_ONLY');
  assert.equal(request.sendAllowed,false);
  assert.equal(request.method,'POST');
  assert.equal(request.body.sender_action,'react');
  assert.equal(request.body.payload.message_id,'mid.$abc-123');
  assert.equal(request.body.payload.reaction,'❤️');
  assert.equal(request.body.recipient.id,'7654321');
  assert.equal(request.body.access_token,undefined);
});

test('request builder rejects arbitrary payload and unreviewed emoji or action', () => {
  assert.throws(()=>buildMetaReactionDryRun({mode:'pass_through'}),/reaction_decision_required/);
  assert.throws(()=>buildMetaReactionDryRun({
    ...decideSocialReaction(event(),gate()),emoji:'😡',
  }),/reaction_decision_required/);
});

test('provider API errors and uncertain results cannot be reported as accepted', () => {
  assert.deepEqual(evaluateReactionSendResult({error:{code:100,error_subcode:2018311}}),
    {status:'not_confirmed',followup:'normal_text_path_no_auto_retry'});
  assert.equal(evaluateReactionSendResult({transportConfirmed:true}).status,'not_confirmed');
  assert.equal(evaluateReactionSendResult({providerAccepted:true}).status,'not_confirmed');
  assert.equal(evaluateReactionSendResult({transportConfirmed:true,providerAccepted:true}).status,'accepted_by_provider');
});

test('customer reaction is only a social signal; no order/payment/admin approval', () => {
  const r=classifyCustomerReactionEvent(event({kind:'message_reaction'}),gate());
  assert.deepEqual(r,{mode:'signal_only',signal:'customer_reaction',createsOrder:false,
    changesPayment:false,grantsApproval:false,triggersTool:false});
});

test('untrusted customer reaction cannot even produce an analytics signal', () => {
  const r=classifyCustomerReactionEvent(event({kind:'message_reaction'}),gate({signatureVerified:false}));
  assert.equal(r.mode,'skip');
  assert.equal(classifyCustomerReactionEvent(event({kind:'message_reaction',pageId:'999999'}),gate()).mode,'skip');
});

test('returning from a thank-you to a normal business question preserves response path', () => {
  assert.equal(decideSocialReaction(event({text:'Cảm ơn shop nhé!'}),gate()).mode,'reaction_candidate');
  assert.equal(decideSocialReaction(event({text:'Cảm ơn shop, cho hỏi còn size L không?'}),gate()).mode,'pass_through');
});
