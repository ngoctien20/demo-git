import test from 'node:test';
import assert from 'node:assert/strict';

const origin = 'https://tien404-auth-staging.onrender.com';
async function read(relative, expected=200) {
  const response = await fetch(origin+relative,{redirect:'follow',cache:'no-store',signal:AbortSignal.timeout(25000)});
  const body=await response.text();
  assert.equal(response.status,expected,relative+' HTTP '+response.status);
  assert.ok(body.length>40,relative+' empty response');
  return {body,headers:response.headers};
}
test('Render HTTPS delivers the actual deployed Tester pages',async()=>{
  const checks=[
    ['/tester.html',['id="tp-workspace" class="tp-workspace" hidden','noindex,nofollow','assets/tester-portal.js']],
    ['/tester-admin.html',['id="ta-protected" hidden','noindex,nofollow','assets/tester-admin.js']],
    ['/login.html',['id="auth-login"','Supabase']],
    ['/account.html',['account-protected','tester.html']],
    ['/merchant-portal.html',['id="merchant-protected"','id="merchant-login"']],
    ['/assets/tester-portal.js',["renderGuidedSteps(m.module_id)","from './tester-guides.mjs'","getAuthClient()"]],
    ['/assets/tester-admin.js',["tien404_tester_staff","getAuthClient()"]],
    ['/assets/tester-guides.mjs',['messenger:', 'telegram:', 'zalo:', 'sheets:', 'ai_sales:', 'commerce:']],
    ['/assets/tester-portal.css',['tp-guide-list','tp-guide-step']]
  ];
  for(const [path,needles] of checks){
    const {body}=await read(path);
    for(const needle of needles)assert.ok(body.includes(needle),path+' missing marker '+needle);
    console.log('VERIFIED HTTP 200 '+path+' '+body.length+' bytes');
  }
});
test('Private source SQL is not served by Render static preview',async()=>{
  for(const path of ['/qa/tester_portal/supabase_tester_portal_v1_candidate.sql','/.env','/docs/ai-handoff/V12_2_PRIVATE_TESTER_PORTAL_STAGING_CHECKPOINT_20261114.md']){
    const r=await fetch(origin+path,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(25000)});
    const body=await r.text();
    assert.notEqual(r.status,200,'private content publicly accessible at '+path);
    assert.ok(!body.includes('CREATE TABLE public.tien404_tester_staff'),'SQL source leaked to web');
    console.log('PRIVATE PATH NOT PUBLIC '+path+' HTTP '+r.status);
  }
});
