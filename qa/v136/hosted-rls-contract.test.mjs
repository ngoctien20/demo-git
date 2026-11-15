import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkConfig,checkUserEvidence,checkAnonymousEvidence,RENDER_AUTH_ORIGIN} from './hosted-rls-contract.mjs';
const A='10000000-0000-4000-8000-000000000001',B='20000000-0000-4000-8000-000000000002';
const cfg={origin:RENDER_AUTH_ORIGIN,tenantA:A,tenantB:B,stateA:'C:\\Private\\shop-a.json',stateB:'C:\\Private\\shop-b.json'};
const valid={authenticated:true,userIdentityVerified:true,memberOfOwn:true,memberOfOther:false,
 selfOrdersError:false,otherOrdersError:false,selfOrderCount:1,otherOrderCount:0,
 otherTenantVisible:false,uiProtectedVisible:true,mutatingRestRequests:0};
test('only exact Render Auth staging host accepted',()=>{
 assert.equal(checkConfig(cfg).origin,RENDER_AUTH_ORIGIN);
 assert.throws(()=>checkConfig({...cfg,origin:'https://ngoctien20.github.io'}),/WRONG_HOST/);
 assert.throws(()=>checkConfig({...cfg,origin:'http://tien404-auth-staging.onrender.com'}),/WRONG_HOST/);
});
test('same or malformed tenant identity rejected',()=>{
 assert.throws(()=>checkConfig({...cfg,tenantB:A}),/TENANT_IDS_INVALID/);
 assert.throws(()=>checkConfig({...cfg,tenantA:'client-tenant'}),/TENANT_IDS_INVALID/);
});
test('two separate valid state file paths required',()=>{
 assert.throws(()=>checkConfig({...cfg,stateB:cfg.stateA}),/ISOLATED_STATE_FILES_REQUIRED/);
 assert.throws(()=>checkConfig({...cfg,stateA:''}),/ISOLATED_STATE_FILES_REQUIRED/);
});
test('proper A and B verified evidence can pass without user identifiers',()=>{
 assert.equal(checkUserEvidence(valid,'SHOP_A').passed,true);
 assert.equal(checkUserEvidence(valid,'SHOP_B').passed,true);
});
test('absent verified Auth session denied',()=>assert.throws(()=>checkUserEvidence({...valid,authenticated:false},'SHOP_A'),/AUTH_UNVERIFIED/));
test('own membership must be present',()=>assert.throws(()=>checkUserEvidence({...valid,memberOfOwn:false},'SHOP_A'),/MEMBERSHIP_SCOPE_DENIED/));
test('foreign membership must not be visible',()=>assert.throws(()=>checkUserEvidence({...valid,memberOfOther:true},'SHOP_A'),/MEMBERSHIP_SCOPE_DENIED/));
test('positive existing order fixture necessary for meaningful negative test',()=>assert.throws(()=>checkUserEvidence({...valid,selfOrderCount:0},'SHOP_A'),/POSITIVE_FIXTURE_MISSING/));
test('cross-shop Orders exposure rejected',()=>assert.throws(()=>checkUserEvidence({...valid,otherOrderCount:1},'SHOP_A'),/CROSS_TENANT_LEAK/));
test('cross-shop Tenant details exposure rejected',()=>assert.throws(()=>checkUserEvidence({...valid,otherTenantVisible:true},'SHOP_A'),/CROSS_TENANT_LEAK/));
test('remote query errors cannot count as passing',()=>assert.throws(()=>checkUserEvidence({...valid,otherOrdersError:true},'SHOP_A'),/QUERY_UNVERIFIED/));
test('logged-in UI must actually be visible',()=>assert.throws(()=>checkUserEvidence({...valid,uiProtectedVisible:false},'SHOP_A'),/PORTAL_NOT_AUTHENTICATED/));
test('real writes must be zero',()=>assert.throws(()=>checkUserEvidence({...valid,mutatingRestRequests:1},'SHOP_A'),/UNEXPECTED_WRITE/));
test('anonymous must remain locked and see 0 records',()=>{
 assert.equal(checkAnonymousEvidence({uiProtectedVisible:false,orderRowsVisible:0,mutatingRestRequests:0}).passed,true);
 assert.throws(()=>checkAnonymousEvidence({uiProtectedVisible:false,orderRowsVisible:1,mutatingRestRequests:0}),/ANON_ACCESS_RISK/);
});
test('the real runner does NOT embed credentials, keys, or hard-coded user ids',()=>{
 const code=readFileSync(new URL('./hosted-rls-browser.mjs',import.meta.url),'utf8');
 assert.match(code,/QA_SHOP_A_STORAGE_STATE/);
 assert.match(code,/QA_SHOP_B_STORAGE_STATE/);
 assert.match(code,/auth\.getUser\(\)/);
 assert.doesNotMatch(code,/process\.env\.(?:SERVICE_ROLE|BOT_TOKEN)|console\.log\(.*(?:userId|session|token)|service_role_key\s*:/i);
 assert.match(code,/QA_IDENTITIES_MUST_BE_DIFFERENT/);
});
