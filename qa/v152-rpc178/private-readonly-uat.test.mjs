import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePrivateReadOnlyUat,realHostedAcceptance} from './private-readonly-uat.mjs';

const tenant='11111111-1111-4111-8111-111111111111';
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',b='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const sa='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',sb='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const pa='cccccccc-cccc-4ccc-8ccc-ccccccccccc1',pb='cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
const fixture={tenant_id:tenant,user_a:a,user_b:b,store_a:sa,store_b:sb,product_a:pa,product_b:pb};
const tokenA='TEST_FAKE_PRIVATE_TOKEN_A_NOT_REAL_JWT',tokenB='TEST_FAKE_PRIVATE_TOKEN_B_NOT_REAL_JWT';
function mk(overrides={}){
 const requests=[];
 const mock=async (input,options)=>{
   requests.push({url:input,method:options.method,redirect:options.redirect,cache:options.cache,select:options.headers['Accept-Profile']});
   const actor=options.headers.Authorization.endsWith(tokenA)?'A':'B';
   const url=new URL(input);
   if(url.pathname==='/auth/v1/user')return {status:200,json:async()=>({id:actor==='A'?a:b})};
   const id=url.searchParams.get('id')?.slice(3);
   const isOwn=(actor==='A'&&id===pa)||(actor==='B'&&id===pb);
   if(overrides.leak&&actor==='A'&&id===pb)return {status:200,json:async()=>[{id:pb,store_id:sb,tenant_id:tenant}]};
   if(overrides.unauthorized)return {status:401,json:async()=>({})};
   if(overrides.badRow&&isOwn)return {status:200,json:async()=>[{id,store_id:sb,tenant_id:tenant}]};
   return {status:200,json:async()=>isOwn?[{id,store_id:actor==='A'?sa:sb,tenant_id:tenant}]:[]};
 };
 return {requests,args:{fetchImpl:mock,apiBase:'https://ifxlvrhyjhbzbrkdsida.supabase.co/',publishableKey:'sb_publishable_test_qa_only',tokenA,tokenB,fixture,operatorGate:{explicitPrivateNoSendMode:'DISPOSABLE_DIAGNOSTIC_ONLY',independentApprovalReceiptPresent:true}}};
}
const denied=r=>{assert.equal(r.can_release,false);assert.equal(r.can_migrate,false);assert.equal(r.can_upload,false);assert.equal(r.can_send,false);assert.equal(r.can_open_access,false)};
test('mock successful A/B read only is never release acceptance',async()=>{const x=mk();const r=await evaluatePrivateReadOnlyUat(x.args);assert.equal(r.status,'DIAGNOSTIC_PASSED_HUMAN_REVIEW_REQUIRED');assert.equal(r.checks.length,4);denied(r);assert.equal(x.requests.length,6);assert.ok(x.requests.every(t=>t.method==='GET'&&t.redirect==='error'&&t.cache==='no-store'))});
test('fail closed without real private operator receipt',async()=>{const x=mk();delete x.args.operatorGate;const r=await evaluatePrivateReadOnlyUat(x.args);assert.equal(r.status,'BLOCKED');assert.equal(x.requests.length,0);denied(r)});
test('reject unauthorized public URL',async()=>{const x=mk();x.args.apiBase='https://evil.example/';assert.equal((await evaluatePrivateReadOnlyUat(x.args)).reason,'PROJECT_NOT_ALLOWLISTED');assert.equal(x.requests.length,0)});
test('reject https lookalike project domain',async()=>{const x=mk();x.args.apiBase='https://ifxlvrhyjhbzbrkdsida.supabase.co.evil.example/';assert.equal((await evaluatePrivateReadOnlyUat(x.args)).status,'BLOCKED')});
test('reject HTTP downgrade',async()=>{const x=mk();x.args.apiBase='http://ifxlvrhyjhbzbrkdsida.supabase.co/';assert.equal((await evaluatePrivateReadOnlyUat(x.args)).status,'BLOCKED')});
test('reject service-role-like API key',async()=>{const x=mk();x.args.publishableKey='service_role_secret';assert.equal((await evaluatePrivateReadOnlyUat(x.args)).reason,'PUBLISHABLE_KEY_REQUIRED')});
test('reject same token reused for both users',async()=>{const x=mk();x.args.tokenB=tokenA;assert.equal((await evaluatePrivateReadOnlyUat(x.args)).reason,'IDENTICAL_TOKENS')});
test('reject duplicated Store IDs',async()=>{const x=mk();x.args.fixture={...fixture,store_b:sa};assert.equal((await evaluatePrivateReadOnlyUat(x.args)).reason,'MISSING_QA_FIXTURE')});
test('reject missing fixture',async()=>{const x=mk();delete x.args.fixture;assert.equal((await evaluatePrivateReadOnlyUat(x.args)).status,'BLOCKED')});
test('reject fake Auth endpoint identity mismatch',async()=>{const x=mk();x.args.fixture={...fixture,user_b:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'};assert.equal((await evaluatePrivateReadOnlyUat(x.args)).reason,'AUTH_USER_ENDPOINT_MISMATCH')});
test('reject cross-store product leak',async()=>{const x=mk({leak:true});assert.equal((await evaluatePrivateReadOnlyUat(x.args)).reason,'CROSS_STORE_DISCLOSURE')});
test('reject own Store wrong ownership',async()=>{const x=mk({badRow:true});assert.equal((await evaluatePrivateReadOnlyUat(x.args)).reason,'OWN_STORE_READ_FAILED')});
test('reject 401 token or unexposed QA schema',async()=>{const x=mk({unauthorized:true});assert.equal((await evaluatePrivateReadOnlyUat(x.args)).status,'BLOCKED')});
test('reject network failure without leaking secrets',async()=>{const x=mk();x.args.fetchImpl=async()=>{throw Error('token='+tokenA)};const r=await evaluatePrivateReadOnlyUat(x.args);assert.equal(r.reason,'PRIVATE_RUNNER_FAILED_CLOSED');assert.equal(JSON.stringify(r).includes(tokenA),false)});
test('reject null input',async()=>{const r=await evaluatePrivateReadOnlyUat(null);assert.equal(r.status,'BLOCKED');denied(r)});
test('independent hosted acceptance cannot be granted from diagnostic',()=>denied(realHostedAcceptance()));
