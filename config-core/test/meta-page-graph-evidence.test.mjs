import test from 'node:test';
import assert from 'node:assert/strict';
import { assessMetaPageGraphReadOnlyEvidence as check, META_GRAPH_EVIDENCE_VERSION } from '../lib/meta-page-graph-evidence.mjs';

const now=1795346000;
const expected={appId:'999888777666',metaPageId:'123456789012345',metaActorId:'12345000111111'};
const evidence=()=>({
  tokenDebug:{data:{
    app_id:expected.appId,is_valid:true,type:'USER',user_id:expected.metaActorId,
    expires_at:now+3600,data_access_expires_at:now+7200,
    scopes:['pages_messaging','pages_manage_metadata','pages_show_list'],
    granular_scopes:[
      {scope:'pages_messaging',target_ids:[expected.metaPageId]},
      {scope:'pages_manage_metadata',target_ids:[expected.metaPageId]},
      {scope:'pages_show_list',target_ids:[expected.metaPageId]}
    ]
  }},
  pageAccounts:{data:[{id:expected.metaPageId,tasks:['MESSAGING','CREATE_CONTENT']}]},
  pageSubscribedApps:{data:[{id:expected.appId,subscribed_fields:['messages','messaging_postbacks']}]},
});
const result=(change={},ctx=expected)=>check({...evidence(),...change},ctx,now);
const bad=(label,change,reason)=>test(label,()=>assert.equal(result(change).reason,reason));

test('contract never sends and cannot be interpreted as issuer consent',()=>{
  assert.equal(META_GRAPH_EVIDENCE_VERSION,'t404.meta-page-graph-evidence.v1');
  const r=result();
  assert.equal(r.status,'attestable_candidate');
  assert.equal(r.sendAllowed,false);
  assert.equal(r.requiresSignedReceipt,true);
  assert.equal(r.requiresValidOAuthStateAndOneTimeNonce,true);
  assert.equal(r.requiresOwnerStoreBinding,true);
  assert.equal(r.requiresIndependentOwnerConsent,true);
  assert.equal('access_token' in r,false);
});
test('Graph replies alone cannot establish trusted server context',()=>{
  assert.equal(check(evidence(),null,now).reason,'untrusted_expected_meta_context');
  assert.equal(check(evidence(),{...expected,appId:'other'},now).reason,'untrusted_expected_meta_context');
  assert.equal(check(evidence(),expected,0).reason,'untrusted_expected_meta_context');
  assert.equal(check(null,expected,now).reason,'graph_evidence_missing');
});
test('mismatched Meta Page ID cannot be used even with a valid app/user token',()=>{
  const other={...expected,metaPageId:'123456789012346'};
  assert.equal(check(evidence(),other,now).reason,'meta_page_not_in_granular_scope');
});
bad('invalid token', {tokenDebug:{data:{...evidence().tokenDebug.data,is_valid:false}}},'meta_user_token_invalid_or_wrong_app');
bad('wrong app ID in OAuth token', {tokenDebug:{data:{...evidence().tokenDebug.data,app_id:'111111111111'}}},'meta_user_token_invalid_or_wrong_app');
bad('wrong Meta actor', {tokenDebug:{data:{...evidence().tokenDebug.data,user_id:'122222222222'}}},'meta_user_token_invalid_or_wrong_app');
bad('Page token is not a user OAuth token', {tokenDebug:{data:{...evidence().tokenDebug.data,type:'PAGE'}}},'meta_user_token_invalid_or_wrong_app');
bad('expired token', {tokenDebug:{data:{...evidence().tokenDebug.data,expires_at:now-1}}},'meta_user_token_invalid_or_wrong_app');
bad('expired data access', {tokenDebug:{data:{...evidence().tokenDebug.data,data_access_expires_at:now-1}}},'meta_user_token_invalid_or_wrong_app');
bad('missing pages messaging scope', {tokenDebug:{data:{...evidence().tokenDebug.data,scopes:['pages_manage_metadata','pages_show_list']}}},'meta_oauth_scopes_missing');
bad('invalid scope array', {tokenDebug:{data:{...evidence().tokenDebug.data,scopes:'pages_messaging'}}},'meta_oauth_scopes_missing');
bad('granular Meta scope excludes this Page', {tokenDebug:{data:{...evidence().tokenDebug.data,granular_scopes:[
 {scope:'pages_messaging',target_ids:['11111111111']},
 {scope:'pages_manage_metadata',target_ids:[expected.metaPageId]},
 {scope:'pages_show_list',target_ids:[expected.metaPageId]}
 ]}}},'meta_page_not_in_granular_scope');
bad('no Page accounts response', {pageAccounts:{not_data:[]}},'meta_page_accounts_missing');
bad('Page belongs to someone else', {pageAccounts:{data:[{id:'111111111111',tasks:['MESSAGING']}]}},'meta_messaging_task_missing_or_wrong_page');
bad('Meta actor has no MESSAGING task', {pageAccounts:{data:[{id:expected.metaPageId,tasks:['ANALYZE']}]}},'meta_messaging_task_missing_or_wrong_page');
bad('same Page duplicated in Meta response', {pageAccounts:{data:[{id:expected.metaPageId,tasks:['MESSAGING']},{id:expected.metaPageId,tasks:['MESSAGING']}]}},'meta_messaging_task_missing_or_wrong_page');
bad('no subscribed apps response', {pageSubscribedApps:{}},'meta_subscribed_apps_unavailable');
bad('TIEN404 app not subscribed to this Page', {pageSubscribedApps:{data:[{id:'55555555555',subscribed_fields:['messages']}]}},'meta_app_not_subscribed_on_page');
bad('correct app but messages webhook field not subscribed', {pageSubscribedApps:{data:[{id:expected.appId,subscribed_fields:['messaging_postbacks']}]}},'meta_message_webhook_not_subscribed');
bad('correct app but subscribed fields missing', {pageSubscribedApps:{data:[{id:expected.appId}]}},'meta_message_webhook_not_subscribed');
bad('duplicate apps in subscribed_apps output', {pageSubscribedApps:{data:[{id:expected.appId,subscribed_fields:['messages']},{id:expected.appId,subscribed_fields:['messages']}]}},'meta_app_not_subscribed_on_page');
test('no bearer credential persists in result even if transport includes an access token',()=>{
 const e=evidence();e.pageAccounts.data[0].access_token='SYNTHETIC_NEVER_PERSIST';
 const r=check(e,expected,now);
 assert.equal(r.status,'attestable_candidate');
 assert.equal(JSON.stringify(r).includes('SYNTHETIC_NEVER_PERSIST'),false);
});
test('positive check never uses a fallback from chat or owner profile',()=>{
 const r=result();
 assert.equal(Object.hasOwn(r,'ownerConsent'),false);
 assert.equal(Object.hasOwn(r,'publishAllowed'),false);
});

test('explicit Meta global granular permissions with no target_ids are accepted only with verified Page task/subscription',()=>{
 const e=evidence();
 e.tokenDebug.data.granular_scopes=[
   {scope:'pages_messaging'},
   {scope:'pages_manage_metadata'},
   {scope:'pages_show_list'}
 ];
 const r=check(e,expected,now);
 assert.equal(r.status,'attestable_candidate');
 assert.equal(r.sendAllowed,false);
});
test('missing required granular entry is not interpreted as a global grant',()=>{
 const e=evidence();
 e.tokenDebug.data.granular_scopes=e.tokenDebug.data.granular_scopes.filter(p=>p.scope!=='pages_messaging');
 assert.equal(check(e,expected,now).reason,'meta_granular_scope_missing_or_ambiguous');
});
test('conflicting duplicate granular permission entries are rejected even if one includes the Page',()=>{
 const e=evidence();
 e.tokenDebug.data.granular_scopes.push({scope:'pages_messaging',target_ids:['11111111111']});
 assert.equal(check(e,expected,now).reason,'meta_granular_scope_missing_or_ambiguous');
});
test('explicit empty granular target list is ambiguous rather than all Pages',()=>{
 const e=evidence();
 e.tokenDebug.data.granular_scopes[0].target_ids=[];
 assert.equal(check(e,expected,now).reason,'invalid_granular_target_ids');
});
test('numeric Page target_ids risk precision loss and cannot attest Page identity',()=>{
 const e=evidence();
 e.tokenDebug.data.granular_scopes[0].target_ids=[Number(expected.metaPageId)];
 assert.equal(check(e,expected,now).reason,'invalid_granular_target_ids');
});
test('malformed granular target_ids object is rejected before permissions are admitted',()=>{
 const e=evidence();
 e.tokenDebug.data.granular_scopes[0].target_ids={0:expected.metaPageId};
 assert.equal(check(e,expected,now).reason,'invalid_granular_target_ids');
});

test('Meta user token without granular scopes cannot grant Page authority',()=>{
 const e=evidence();
 delete e.tokenDebug.data.granular_scopes;
 assert.equal(check(e,expected,now).reason,'meta_granular_scopes_not_attested');
});
test('granular_scopes not an array never grants Page authority',()=>{
 const e=evidence();
 e.tokenDebug.data.granular_scopes='pages_messaging,pages_manage_metadata,pages_show_list';
 assert.equal(check(e,expected,now).reason,'meta_granular_scopes_not_attested');
});
