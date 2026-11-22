import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REACTION_PROFILES_VERSION, REACTION_PROFILES, INDUSTRY_REACTION_RULES,
  suggestReactionProfile, validatePublishedReactionProfile, classifyReactionForProfile,
} from '../lib/reaction-profiles.mjs';
import {
  REACTION_POLICY_SCHEMA_VERSION, verifyPublishedPageReactionPolicy,
  prepareReactionAdmission,
} from '../lib/reaction-admission.mjs';

const now=1795345000000;
const base={
  schemaVersion:2, provider:'meta_messenger', lifecycle:'published', enabled:true,
  revision:3, tenantId:'tenant-a',pageId:'page-111',installationId:'install-111',
  ownerId:'owner-111',industryId:'retail_general',
  publishedAtMs:now-10000,expiresAtMs:now+3600000,
  ownerConsent:{approved:true,revision:3,ownerId:'owner-111',approvedAtMs:now-9000,expiresAtMs:now+3600000},
  settings:{profileId:'friendly',intents:{thanks:true,praise:true},cooldownSeconds:300,maxPerHour:2},
};
const authority=(patch={})=>({
  source:'trusted_server',resolverVerified:true,policyReadAuthorized:true,
  tenantId:'tenant-a',pageId:'page-111',installationId:'install-111',ownerId:'owner-111',
  industryId:'retail_general',webhookHmacVerified:true,recipientPageVerified:true,
  sourceMessageId:'m_test-111',sourceSenderId:'sender-111',
  messageTimestampMs:now-1000,notEcho:true,messageIsOriginalText:true,...patch
});
const clone=x=>JSON.parse(JSON.stringify(x));
const policy=(patch={})=>({...clone(base),...patch});
const event=(patch={})=>({
  channel:'messenger',kind:'message',messageType:'text',tenantId:'tenant-a',
  pageId:'page-111',senderId:'sender-111',messageId:'m_test-111',
  text:'Cảm ơn shop nhé!',...patch
});
const thread=()=>({source:'trusted_meta_thread_lookup',verified:true,botIsOwner:true,
  pageId:'page-111',senderId:'sender-111',checkedAtMs:now-1000});
const business=()=>({source:'trusted_business_state',verified:true,
  tenantId:'tenant-a',pageId:'page-111',senderId:'sender-111',checkedAtMs:now-1000,
  handoffClear:true,ordersClear:true,approvalsClear:true,billingClear:true,
  menuClear:true,privilegedClear:true,pendingToolsClear:true});
function prepared(p,auth=authority(),text='Cảm ơn shop nhé!'){
  return prepareReactionAdmission({event:event({text}),policy:p,authority:auth,thread:thread(),business:business()},now);
}

test('policy profile schema v2 is gated and no profile enables any Page by default',()=>{
  assert.equal(REACTION_POLICY_SCHEMA_VERSION,2);
  assert.equal(REACTION_PROFILES_VERSION,'t404.reaction-profiles.v1');
  for(const industryId of Object.keys(INDUSTRY_REACTION_RULES))
    assert.equal(suggestReactionProfile(industryId).enabledByDefault,false);
  assert.equal(suggestReactionProfile('unknown-sector').recommendedProfileId,'silent');
  assert.deepEqual(suggestReactionProfile('unknown-sector').allowedProfiles,['silent']);
});
test('high-stakes Pages are silent-only without exception from owner-selected style',()=>{
  for(const industryId of [
    'healthcare','legal','banking_finance','insurance','public_services',
    'crisis_support','funeral_services','professional_services'
  ]){
    const suggestion=suggestReactionProfile(industryId);
    assert.equal(suggestion.recommendedProfileId,'silent',industryId);
    assert.equal(validatePublishedReactionProfile(industryId,'expressive',{
      profileId:'expressive',intents:{thanks:true,praise:true},cooldownSeconds:90,maxPerHour:5
    }).status,'blocked',industryId);
  }
});
test('industry recommendations reflect shop vs artist without automatic activation',()=>{
  assert.equal(suggestReactionProfile('construction_materials').recommendedProfileId,'restrained');
  assert.equal(suggestReactionProfile('wholesale').recommendedProfileId,'restrained');
  assert.equal(suggestReactionProfile('grocery').recommendedProfileId,'friendly');
  assert.equal(suggestReactionProfile('fashion').recommendedProfileId,'friendly');
  assert.equal(suggestReactionProfile('artist').recommendedProfileId,'expressive');
  assert.equal(suggestReactionProfile('music').recommendedProfileId,'expressive');
});
test('all Page profiles are bounded by cooldown and hourly quota, owner may be stricter',()=>{
  for(const id of ['restrained','friendly','expressive']){
    const preset=REACTION_PROFILES[id];
    assert.equal(validatePublishedReactionProfile('artist',id,{
      profileId:id,intents:{...preset.intents},
      cooldownSeconds:preset.cooldownSeconds,maxPerHour:preset.maxPerHour,
    }).status,'validated');
    assert.equal(validatePublishedReactionProfile('artist',id,{
      profileId:id,intents:{...preset.intents},
      cooldownSeconds:preset.cooldownSeconds-1,maxPerHour:preset.maxPerHour,
    }).reason,'profile_frequency_exceeded');
    assert.equal(validatePublishedReactionProfile('artist',id,{
      profileId:id,intents:{...preset.intents},
      cooldownSeconds:preset.cooldownSeconds,maxPerHour:preset.maxPerHour+1,
    }).reason,'profile_frequency_exceeded');
  }
});
test('unknown or fabricated industry, profile and ambiguous settings block',()=>{
  assert.equal(validatePublishedReactionProfile('unclassified','friendly',{}).status,'blocked');
  assert.equal(validatePublishedReactionProfile('artist','invented',{}).status,'blocked');
  assert.equal(validatePublishedReactionProfile('artist','silent',{profileId:'silent'}).status,'blocked');
  assert.equal(validatePublishedReactionProfile('artist','friendly',{
    profileId:'expressive',intents:{thanks:true,praise:true},cooldownSeconds:300,maxPerHour:2
  }).reason,'profile_not_bound_to_policy');
});
test('restrained profile cannot enable praise or increase frequency',()=>{
  assert.equal(validatePublishedReactionProfile('wholesale','restrained',{
    profileId:'restrained',intents:{thanks:true,praise:true},cooldownSeconds:600,maxPerHour:1
  }).reason,'profile_intents_exceeded');
  assert.equal(validatePublishedReactionProfile('wholesale','restrained',{
    profileId:'restrained',intents:{thanks:true,praise:false},cooldownSeconds:600,maxPerHour:2
  }).reason,'profile_frequency_exceeded');
});
test('normal shop defaults to known phrases, expressive artist gains additional social-only expressions',()=>{
  assert.equal(classifyReactionForProfile('Cảm ơn shop nhé!','friendly'),'❤️');
  assert.equal(classifyReactionForProfile('Shop dễ thương quá!','friendly'),'👍');
  assert.equal(classifyReactionForProfile('Đỉnh quá!','friendly'),null);
  assert.equal(classifyReactionForProfile('Đỉnh quá!','expressive'),'👍');
  assert.equal(classifyReactionForProfile('Fan cứng đây','expressive'),'👍');
  assert.equal(classifyReactionForProfile('Cảm ơn mọi người!','expressive'),'❤️');
  assert.equal(classifyReactionForProfile('Cảm ơn mọi người!','restrained'),null);
});
test('expressive is still no reaction for price, order, refund, sensitive or urgent intent',()=>{
  for(const msg of [
    'Đỉnh quá, giá bao nhiêu?', 'Cảm ơn mọi người, đặt 2 vé',
    'Fan cứng đây, làm sao chuyển khoản?',
    'Hay quá, khiếu nại đơn hàng nhé',
    'Có thể cho tôi gặp quản lý?',
    'Tôi đồng ý triển khai', 'Đau quá!', 'Tuyệt vời?',
  ])assert.equal(classifyReactionForProfile(msg,'expressive'),null,msg);
});
test('published Page policy fails when owner selects a forbidden style for trusted industry',()=>{
  const p=policy({industryId:'healthcare',settings:{
    profileId:'expressive',intents:{thanks:true,praise:true},cooldownSeconds:90,maxPerHour:5
  }});
  assert.equal(verifyPublishedPageReactionPolicy(p,authority({industryId:'healthcare'}),now).reason,'profile_disallowed_for_industry');
});
test('trusted industry mismatch blocks Page policy even if owner attempted to change industry',()=>{
  assert.equal(verifyPublishedPageReactionPolicy(policy({industryId:'artist'}),authority(),now).reason,'policy_industry_mismatch');
  assert.equal(verifyPublishedPageReactionPolicy(policy(),authority({industryId:'artist'}),now).reason,'policy_industry_mismatch');
});
test('legacy schema v1 cannot bypass profile enforcement after migration',()=>{
  const p=policy({schemaVersion:1,settings:{intents:{thanks:true,praise:true},cooldownSeconds:60,maxPerHour:6}});
  assert.equal(verifyPublishedPageReactionPolicy(p,authority(),now).mode,'blocked');
});
test('per-Page consent remains necessary regardless of suggested style',()=>{
  assert.equal(prepared(policy({enabled:false})).mode,'blocked');
  assert.equal(prepared(policy({ownerConsent:{...base.ownerConsent,approved:false}})).mode,'blocked');
  assert.equal(prepared(policy()).mode,'claim_required');
});
test('professional Page always blocks social reaction even if spoofing a harmless message',()=>{
  const p=policy({industryId:'legal',settings:{
    profileId:'restrained',intents:{thanks:true,praise:false},cooldownSeconds:600,maxPerHour:1
  }});
  const res=prepared(p,authority({industryId:'legal'}));
  assert.equal(res.mode,'blocked');
  assert.equal(res.reason,'profile_disallowed_for_industry');
});
test('artist gets extra eligible phrases only with a published, consented expressive Page profile',()=>{
  const s={profileId:'expressive',intents:{thanks:true,praise:true},cooldownSeconds:90,maxPerHour:5};
  const p=policy({industryId:'artist',settings:s});
  const yes=prepared(p,authority({industryId:'artist'}),'Đỉnh quá!');
  assert.equal(yes.mode,'claim_required');
  assert.equal(yes.reaction,'👍');
  assert.equal(yes.profileId,'expressive');
  assert.equal(yes.sendAllowed,false);
  assert.equal(prepared(policy({industryId:'artist',settings:s,enabled:false}),authority({industryId:'artist'}),'Đỉnh quá!').mode,'blocked');
});
test('two Fanpages in same tenant cannot borrow a policy from each other',()=>{
  const p=policy(),a=authority({pageId:'page-222'});
  assert.equal(verifyPublishedPageReactionPolicy(p,a,now).reason,'policy_scope_mismatch');
});
