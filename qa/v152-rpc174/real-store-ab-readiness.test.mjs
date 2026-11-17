import test from 'node:test';
import assert from 'node:assert/strict';
import {REQUIRED,inspectRealStoreAbReadiness,safeUatTrace,noSendCanaryDecision} from './real-store-ab-readiness.mjs';
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777'];
const session={tenant_id:ids[0],user_A:ids[1],user_B:ids[2],store_A:ids[3],store_B:ids[4],session_A:ids[5],session_B:ids[6]};
const policy={workers_dev:false,preview_urls:false,allow_policy_count:0,real_file_upload:false,outbound_send:false};
const all=Object.fromEntries(REQUIRED.map(k=>[k,true]));
const check=(r)=>{assert.equal(r.status,'BLOCKED_PRIVATE_UAT_NOT_AUTHORIZED');for(const x of ['can_upload','can_send','can_open_access','can_deploy','can_assert_real_store_ab_pass'])assert.equal(r[x],false)};
test('no proof blocks all permissions',()=>{const r=inspectRealStoreAbReadiness();check(r);assert.ok(r.missing.includes('store_A_membership_verified_db'))});
for(const key of REQUIRED)test('missing '+key+' blocks',()=>{const e={...all};delete e[key];const r=inspectRealStoreAbReadiness(e,session,policy);check(r);assert.ok(r.missing.includes(key))});
test('all synthetic checkboxes still cannot assert real hosted UAT',()=>{const r=inspectRealStoreAbReadiness(all,session,policy);check(r);assert.deepEqual(r.missing,['independent_hosted_acceptance_required'])});
for(const [label,patch,reason] of [
 ['same user',{user_B:session.user_A},'distinct_auth_users_absent'],
 ['same store',{store_B:session.store_A},'distinct_store_ids_absent'],
 ['same session',{session_B:session.session_A},'distinct_sessions_absent'],
 ['bad tenant',{tenant_id:'wrong'},'tenant_id_not_verified'],
 ['raw jwt',{raw_jwt:'fake-token'},'secret_or_untrusted_claim_present'],
 ['user controlled metadata',{user_metadata:{store_id:session.store_A}},'secret_or_untrusted_claim_present'],
 ['service role leak',{service_role:'secret-value'},'secret_or_untrusted_claim_present'],
 ['access token leak',{access_token:'secret-value'},'secret_or_untrusted_claim_present']
])test('reject '+label,()=>{const r=inspectRealStoreAbReadiness(all,{...session,...patch},policy);check(r);assert.ok(r.missing.includes(reason))});
for(const [label,patch] of [
 ['public subdomain',{workers_dev:true}],['preview links',{preview_urls:true}],['Access allow',{allow_policy_count:1}],
 ['real upload',{real_file_upload:true}],['outbound send',{outbound_send:true}]
])test('reject unsafe policy '+label,()=>{const r=inspectRealStoreAbReadiness(all,session,{...policy,...patch});check(r);assert.ok(r.missing.length>0)});
test('strings cannot spoof independent verifications',()=>{const e=Object.fromEntries(REQUIRED.map(k=>[k,'true']));const r=inspectRealStoreAbReadiness(e,session,policy);check(r);assert.ok(r.missing.length>=REQUIRED.length)});
test('null input fails closed',()=>check(inspectRealStoreAbReadiness(null,null,null)));
test('safe trace strips secrets and private URLs',()=>{const t=safeUatTrace({case_id:'AB_01',stage:'AUTH',result:'BLOCKED',access_token:'secret-value',merchant_name:'private',raw_jwt:'ey...',reason:'MISSING_PROOF'});assert.deepEqual(t,{case_id:'AB_01',stage:'AUTH',result:'BLOCKED',reason:'MISSING_PROOF'})});
test('unsafe trace values stripped',()=>{const t=safeUatTrace({case_id:'AB_02',stage:'https://example.com/?token=abc',result:'BLOCKED'});assert.equal(t.stage,undefined)});
test('all hosted canary actions deny by default',()=>{const r=noSendCanaryDecision();assert.equal(r.status,'NO_GO');for(const key of ['can_upload','can_send','can_open_access','can_deploy'])assert.equal(r[key],false)});
