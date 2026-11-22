import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REACTION_ADMISSION_VERSION, verifyPublishedPageReactionPolicy,
  prepareReactionAdmission, verifyAtomicReactionClaim, planSocialResponseAfterProvider,
} from '../lib/reaction-admission.mjs';

const now = 1795345000000;
const page = '1234567890', otherPage = '9999999999', sender = '7654321098', tenant = 'tenant-qa';
const policy = (patch={}) => ({
  schemaVersion:1,provider:'meta_messenger',lifecycle:'published',enabled:true,
  revision:4,tenantId:tenant,pageId:page,installationId:'installation-qa',ownerId:'owner-qa',
  publishedAtMs:now-120000,expiresAtMs:now+30*86400000,
  ownerConsent:{approved:true,revision:4,ownerId:'owner-qa',approvedAtMs:now-120000,expiresAtMs:now+30*86400000},
  settings:{intents:{thanks:true,praise:true},cooldownSeconds:300,maxPerHour:2},...patch,
});
const auth = (patch={}) => ({
  source:'trusted_server',resolverVerified:true,policyReadAuthorized:true,
  tenantId:tenant,pageId:page,installationId:'installation-qa',ownerId:'owner-qa',
  webhookHmacVerified:true,recipientPageVerified:true,sourceMessageId:'m_qa_7777',
  sourceSenderId:sender,messageTimestampMs:now-8000,notEcho:true,
  messageIsOriginalText:true,...patch,
});
const event = (patch={}) => ({
  channel:'messenger',kind:'message',messageType:'text',tenantId:tenant,pageId:page,
  senderId:sender,messageId:'m_qa_7777',text:'Cảm ơn shop nhé!',...patch,
});
const thread = (patch={}) => ({
  source:'trusted_meta_thread_lookup',verified:true,botIsOwner:true,
  pageId:page,senderId:sender,checkedAtMs:now-5000,...patch,
});
const business = (patch={}) => ({
  source:'trusted_business_state',verified:true,tenantId:tenant,pageId:page,senderId:sender,
  checkedAtMs:now-2000,handoffClear:true,ordersClear:true,approvalsClear:true,
  billingClear:true,menuClear:true,privilegedClear:true,pendingToolsClear:true,...patch,
});
const request = (patch={}) => ({event:event(),policy:policy(),authority:auth(),thread:thread(),business:business(),...patch});
const receipt = (preflight,patch={}) => ({
  source:'trusted_durable_atomic_store',serverVerified:true,acquired:true,
  claimId:'claim-abc-123',action:'react',dedupeKey:preflight.dedupeKey,
  tenantId:preflight.tenantId,pageId:preflight.pageId,
  senderId:preflight.senderId,messageId:preflight.messageId,
  policyRevision:preflight.policyRevision,cooldownEnforced:true,hourlyLimitEnforced:true,
  acquiredAtMs:now-1000,expiresAtMs:now+10000,...patch,
});
const preflight = () => prepareReactionAdmission(request(),now);

test('contract v1: verified published owner-approved Page policy, no send grant',()=>{
  assert.equal(REACTION_ADMISSION_VERSION,'t404.reaction-admission.v1');
  assert.equal(verifyPublishedPageReactionPolicy(policy(),auth(),now).mode,'verified_policy');
  const a=preflight();
  assert.equal(a.mode,'claim_required');
  assert.equal(a.reaction,'❤️');
  assert.equal(a.sendAllowed,false);
  assert.equal(a.limits.cooldownSeconds,300);
  assert.equal(a.limits.maxPerHour,2);
});
test('default OFF, unpublished, wrong schema, disabled owner consent all block',()=>{
  for(const patch of [
    {enabled:false},{lifecycle:'draft'},{schemaVersion:2},{revision:0},{ownerConsent:null},
    {ownerConsent:{...policy().ownerConsent,approved:false}},
    {ownerConsent:{...policy().ownerConsent,revision:3}},
  ]) assert.equal(verifyPublishedPageReactionPolicy(policy(patch),auth(),now).mode,'blocked');
});
test('owner consent, policy expiry and nonfinite timestamps block',()=>{
  for(const patch of [
    {expiresAtMs:now-1},{expiresAtMs:Infinity},{publishedAtMs:now+9000},
    {ownerConsent:{...policy().ownerConsent,expiresAtMs:now}},
    {ownerConsent:{...policy().ownerConsent,ownerId:'other-owner'}},
  ]) assert.equal(verifyPublishedPageReactionPolicy(policy(patch),auth(),now).mode,'blocked');
});
test('tenant, Page, installation or owner mismatch never cross shop',()=>{
  for(const patch of [{tenantId:'tenant-b'},{pageId:otherPage},{installationId:'install-other'},{ownerId:'owner-b'}])
    assert.equal(verifyPublishedPageReactionPolicy(policy(patch),auth(),now).reason,'policy_scope_mismatch');
  for(const patch of [{tenantId:'tenant-b'},{pageId:otherPage},{installationId:'install-other'},{ownerId:'owner-b'}])
    assert.equal(verifyPublishedPageReactionPolicy(policy(),auth(patch),now).mode,'blocked');
});
test('policy comes only from trusted server adapter, never customer or AI fields',()=>{
  for(const patch of [{source:'webhook'},{source:'ai_output'},{resolverVerified:false},{policyReadAuthorized:false}])
    assert.equal(verifyPublishedPageReactionPolicy(policy(),auth(patch),now).reason,'untrusted_policy_source');
});
test('owner can enable only thanks or praise; invalid limits fail closed',()=>{
  const base=policy();
  for(const settings of [
    {...base.settings,cooldownSeconds:0},{...base.settings,cooldownSeconds:3601},
    {...base.settings,maxPerHour:0},{...base.settings,maxPerHour:100},
    {...base.settings,intents:{thanks:false,praise:false}},
    {...base.settings,intents:{thanks:true,praise:true,approval:true}},
  ]) assert.equal(verifyPublishedPageReactionPolicy(policy({settings}),auth(),now).mode,'blocked');
  const thanksOnly=policy({settings:{...base.settings,intents:{thanks:true,praise:false}}});
  assert.equal(prepareReactionAdmission(request({policy:thanksOnly,event:event({text:'Yêu shop nha'})}),now).reason,'intent_disabled_by_owner');
});
test('message HMAC, recipient, MID, timestamp and original-text identity all fail closed',()=>{
  for(const a of [
    {webhookHmacVerified:false},{recipientPageVerified:false},{sourceMessageId:'m_other'},
    {sourceSenderId:'2222222222'},{messageTimestampMs:now-3600001},
    {messageTimestampMs:now+15000},{notEcho:false},{messageIsOriginalText:false},
  ]) assert.equal(prepareReactionAdmission(request({authority:auth(a)}),now).mode,'blocked');
});
test('inbound spoofed Page, tenant, sender-as-Page, voice, postback and mixed business messages block',()=>{
  for(const e of [
    {tenantId:'tenant-b'},{pageId:otherPage},{senderId:page},{senderId:'invalid space'},
    {messageType:'voice'},{kind:'postback'},{text:'Cảm ơn shop, cho hỏi giá?'},
    {text:'Tôi đồng ý chuyển khoản'},{text:'👍'},
  ]) assert.equal(prepareReactionAdmission(request({event:event(e)}),now).mode,'blocked');
});
test('Meta thread ownership must be attested fresh, never inferred from a webhook success',()=>{
  for(const t of [
    {source:'webhook'},{verified:false},{botIsOwner:false},{pageId:otherPage},
    {senderId:'another-sender'},{checkedAtMs:now-61000},
  ]) assert.equal(prepareReactionAdmission(request({thread:thread(t)}),now).reason,'thread_ownership_not_fresh');
});
test('trusted business state blocks handoff/order/payment/menu/tools and stale snapshots',()=>{
  for(const b of [
    {source:'messenger_webhook'},{verified:false},{tenantId:'tenant-b'},{pageId:otherPage},
    {checkedAtMs:now-16000},{handoffClear:false},{ordersClear:false},
    {approvalsClear:false},{billingClear:false},{menuClear:false},
    {privilegedClear:false},{pendingToolsClear:false},
  ]) assert.equal(prepareReactionAdmission(request({business:business(b)}),now).reason,'business_state_not_clear');
});
test('dedupe key is Page / tenant / sender / MID scoped, not a global MID',()=>{
  const a=preflight();
  const b=prepareReactionAdmission(request({event:event({messageId:'m_qa_9999'}),authority:auth({sourceMessageId:'m_qa_9999'})}),now);
  assert.equal(b.mode,'claim_required');
  assert.notEqual(a.dedupeKey,b.dedupeKey);
  assert.deepEqual(JSON.parse(a.dedupeKey),[tenant,page,sender,'m_qa_7777','react']);
});
test('durable atomic claim receipt is mandatory; valid one still not a release approval',()=>{
  const a=preflight();
  assert.equal(verifyAtomicReactionClaim(a,null,now).mode,'blocked');
  const b=verifyAtomicReactionClaim(a,receipt(a),now);
  assert.equal(b.mode,'dispatch_candidate');
  assert.equal(b.sendAllowed,false);
  assert.equal(b.requiresExplicitReleaseApproval,true);
});
test('fake or duplicate claim, wrong MID, rate limits not enforced, expired receipt fail closed',()=>{
  const a=preflight();
  for(const patch of [
    {source:'in_memory_set'},{serverVerified:false},{acquired:false},
    {action:'reply'},{dedupeKey:'fake'},{messageId:'m_other'},
    {pageId:otherPage},{tenantId:'tenant-b'},{policyRevision:1},
    {cooldownEnforced:false},{hourlyLimitEnforced:false},
    {acquiredAtMs:now-16000},{expiresAtMs:now-1},
  ]) assert.equal(verifyAtomicReactionClaim(a,receipt(a,patch),now).mode,'blocked');
});
test('reaction-only only on confirmed provider accept for same exact Page/MID',()=>{
  const pre=preflight(),c=verifyAtomicReactionClaim(pre,receipt(pre),now);
  const ok={source:'trusted_meta_send_result',requestCorrelationVerified:true,claimId:c.claimId,recipientId:c.senderId,action:'react',messageId:c.messageId,pageId:c.pageId,transportConfirmed:true,providerAccepted:true,providerError:false};
  assert.equal(planSocialResponseAfterProvider(c,ok).mode,'reaction_only');
  for(const patch of [
    {source:'untrusted_webhook'},{requestCorrelationVerified:false},{claimId:'other-claim'},
    {recipientId:'wrong-sender'},{transportConfirmed:false},{providerAccepted:false},{providerError:true},
    {pageId:otherPage},{messageId:'m_another'},{action:'unreact'},
  ]) {
    const decision=planSocialResponseAfterProvider(c,{...ok,...patch});
    assert.equal(decision.mode,'normal_text');
    assert.equal(decision.retryReaction,false);
  }
});
test('no preflight / malformed claim cannot suppress user text',()=>{
  const outcome={action:'react',messageId:'m_qa_7777',pageId:page,transportConfirmed:true,providerAccepted:true,providerError:false};
  assert.equal(planSocialResponseAfterProvider(null,outcome).mode,'normal_text');
  assert.equal(planSocialResponseAfterProvider({mode:'blocked'},outcome).mode,'normal_text');
});
