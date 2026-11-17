import test from 'node:test';
import assert from 'node:assert/strict';
import {
 classifyExistingZaloShadow,inspectProposedQaChannelJoin,currentReleaseDecision
} from './v17-7h4t-zalo-customer-boundary-readonly.mjs';

const NOW=1795000000000;
const customer=()=>({
 ingress:{source:'protected_bot_header',channel:'zalo_bot',
   marker:'SEEN_AUTHENTICATED_WEBHOOK',route:'CUSTOMER_ROUTE_ELIGIBLE',
   ownerGate:'denied',readOnly:true,noSend:true},
 shadow:{inputChannel:'zalo_bot',outputChannel:'zalo_oa',
   accountId:'__V1715_NO_REAL_STORE_BINDING__',denied:true,
   providerSends:0,commerceWrites:0,stockWrites:0,modelCalls:0}
});
const join=()=>({
 nowMs:NOW,
 channelRows:[{channelType:'zalo_bot',accountId:'QA_BOT_INSTALL_A',
   tenantId:'QA_TENANT_A',enabled:true,connectionStatus:'sandbox'}],
 installations:[{provider:'ZALO_BOT',installation_ref:'QA_BOT_INSTALL_A',
   tenant_id:'QA_TENANT_A',store_id:'QA_STORE_A',binding_status:'ACTIVE',
   qa_only:true,read_only:true,approval_scope:'QA_SYNTHETIC_NO_REAL_OWNER',
   expires_at_ms:NOW+100000,bot_profile_version:'QA_BOT_A_V1'}],
 profiles:[{channel:'zalo_bot',installation_ref:'QA_BOT_INSTALL_A',
   tenant_ref:'QA_TENANT_A',store_ref:'QA_STORE_A',
   status:'QA_APPROVED',approval_scope:'SYNTHETIC_ONLY',
   owner_authority_verified:false,read_only:true,
   subscription_active:true,store_paused:false,bot_version:'QA_BOT_A_V1'}]
});
const denied=r=>{
 for(const k of ['canRegisterChannel','canBindRealBot','canTrustRealOwner',
 'canReadCustomer','canReadOrder','canReadStock','canWriteOrder',
 'canSendProvider','canPublishWorkflow','canChangeWebhook','canChangeToken',
 'canPromoteCore']) assert.equal(r[k],false,k);
};
test('connected customer marker plus intentional technical shadow is NOT real Store auth',()=>{
 const r=classifyExistingZaloShadow(customer());
 assert.equal(r.status,'QA_TECHNICAL_DENY_VERIFIED_REAL_NO_GO');
 assert.equal(r.existingShadowIsNotLiveChannelRouter,true);denied(r);
});
for(const [label,part,key,value] of [
 ['owner not denied','ingress','ownerGate','eligible'],
 ['caller claims OA','ingress','channel','zalo_oa'],
 ['unknown header','ingress','source','unverified'],
 ['missing accepted marker','ingress','marker','OTHER_TEXT'],
 ['real provider send requested','shadow','providerSends',1],
 ['commerce writes','shadow','commerceWrites',1],
 ['model calls','shadow','modelCalls',1],
 ['no Store-less sentinel','shadow','accountId','QA_STORE_A'],
 ['shadow not OA coercion','shadow','outputChannel','zalo_bot']
])test('reject '+label,()=>{const x=customer();x[part][key]=value;const r=classifyExistingZaloShadow(x);assert.equal(r.status,'NO_GO');denied(r)});
test('reject user/customer attached metadata in shadow receipt',()=>{
 const x=customer();x.ingress.customer_phone='untrusted';denied(classifyExistingZaloShadow(x));
 assert.equal(classifyExistingZaloShadow(x).reason,'UNTRUSTED_OR_EXTRA_CUSTOMER_FIELDS');
});
test('null inputs fail closed',()=>{
 denied(classifyExistingZaloShadow(null));
 denied(inspectProposedQaChannelJoin(null));
});
test('current six-row commerce registry with no zalo_bot remains NO-GO',()=>{
 const x=join();x.channelRows=[{channelType:'zalo_oa',enabled:false,connectionStatus:'not_connected'}];
 const r=inspectProposedQaChannelJoin(x);
 assert.equal(r.reason,'ZALO_BOT_COMMERCE_CHANNEL_NOT_REGISTERED');denied(r);
});
test('matching offline synthetic joins never grant real owner or Store',()=>{
 const r=inspectProposedQaChannelJoin(join());
 assert.equal(r.status,'QA_JOIN_SHAPE_ONLY_REAL_NO_GO');
 assert.equal(r.actualOrderReads,0);assert.equal(r.actualProviderSends,0);denied(r);
});
for(const [name,action,reason]of [
 ['disabled channel',x=>x.channelRows[0].enabled=false,'QA_CHANNEL_DISABLED_OR_NOT_SANDBOX'],
 ['duplicate channel',x=>x.channelRows.push({...x.channelRows[0]}),'DUPLICATE_ZALO_BOT_COMMERCE_CHANNEL'],
 ['OA fallback',x=>x.channelRows[0].channelType='zalo_oa','ZALO_BOT_COMMERCE_CHANNEL_NOT_REGISTERED'],
 ['wrong app channel',x=>x.channelRows[0].accountId='QA_BOT_OTHER','TRUSTED_INSTALLATION_MISSING_OR_DUPLICATE'],
 ['installation not matching tenant',x=>x.installations[0].tenant_id='QA_TENANT_B','STORE_TENANT_SCOPE_NOT_CANONICAL'],
 ['missing trusted installation',x=>x.installations=[],'TRUSTED_INSTALLATION_MISSING_OR_DUPLICATE'],
 ['duplicate installation',x=>x.installations.push({...x.installations[0]}),'TRUSTED_INSTALLATION_MISSING_OR_DUPLICATE'],
 ['revoked install',x=>x.installations[0].binding_status='REVOKED','TRUSTED_INSTALLATION_MISSING_OR_DUPLICATE'],
 ['expired install',x=>x.installations[0].expires_at_ms=NOW-1,'INSTALLATION_UNAUTHORIZED_EXPIRED_OR_NOT_QA_ONLY'],
 ['real owner claim injected',x=>x.installations[0].qa_only=false,'INSTALLATION_UNAUTHORIZED_EXPIRED_OR_NOT_QA_ONLY'],
 ['no read only mode',x=>x.installations[0].read_only=false,'INSTALLATION_UNAUTHORIZED_EXPIRED_OR_NOT_QA_ONLY'],
 ['owner authority claimed',x=>x.profiles[0].owner_authority_verified=true,'PROFILE_NOT_SYNTHETIC_READONLY'],
 ['subscription expired',x=>x.profiles[0].subscription_active=false,'PROFILE_NOT_SYNTHETIC_READONLY'],
 ['paused Store',x=>x.profiles[0].store_paused=true,'PROFILE_NOT_SYNTHETIC_READONLY'],
 ['wrong profile ref',x=>x.profiles[0].installation_ref='QA_BOT_INSTALL_B','BOT_PROFILE_INSTALLATION_REF_MISMATCH'],
 ['cross Store profile',x=>x.profiles[0].store_ref='QA_STORE_B','UNVERIFIED_TENANT_STORE_OR_PROFILE_VERSION_BRIDGE'],
 ['unmatched version',x=>x.profiles[0].bot_version='QA_BOT_OLD','UNVERIFIED_TENANT_STORE_OR_PROFILE_VERSION_BRIDGE']
])test('reject '+name,()=>{const x=join();action(x);const r=inspectProposedQaChannelJoin(x);denied(r);assert.equal(r.reason,reason)});
test('real n8n QA registries currently have mismatched installation naming',()=>{
 const x=join();x.installations[0].installation_ref='QA_BOT_ROUTE_A';
 x.profiles[0].installation_ref='QA_ZALO_BOT_A';
 x.channelRows[0].accountId='QA_BOT_ROUTE_A';
 const r=inspectProposedQaChannelJoin(x);
 assert.equal(r.reason,'BOT_PROFILE_INSTALLATION_REF_MISMATCH');denied(r);
});
test('current release decision is unequivocally NO-GO',()=>denied(currentReleaseDecision()));
