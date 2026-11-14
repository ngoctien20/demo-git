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
    ['/tester.html',['id="tp-workspace" class="tp-workspace" hidden','class="tp-friends"','id="tp-more"','id="tp-progress-more"','noindex,nofollow','assets/tester-portal.js','href="tester-request.html"','data-page="practice"']],
    ['/tester-admin.html',['id="ta-protected" hidden','noindex,nofollow','assets/tester-admin.js','id="ta-export"','id="ta-case-readiness"','id="ta-request-list"','id="ta-request-count"','Sheets mẫu']],
    ['/login.html',['id="auth-login"','Supabase']],
    ['/account.html',['account-protected','tester.html','href="tester-request.html"']],
    ['/merchant-portal.html',['id="merchant-protected"','id="merchant-login"']],
    ['/tester-request.html',['id="tr-form" class="tp-admin-form" hidden','noindex,nofollow','assets/tester-request.js']],
    ['/assets/tester-request.js',["from('tien404_tester_requests')",'email_confirmed_at','auth.getUser()']],
    ['/assets/auth-account.js',["verifiedScopeSignature","const check=++verificationSeq","renderGeneration=generation","Date.now()-lastChecked>300000"]],
    ['/assets/merchant-portal.js',["const round=++verificationSeq","Date.now()-lastChecked>300000","Đang kiểm tra quyền trong nền"]],
    ['/assets/tester-portal.js',["renderGuidedSteps(m.module_id)","from './tester-guides.mjs'","getAuthClient()","calculateDemo","renderDemoPractice(pane)","Một trợ lý bán hàng cho những cửa hàng nhỏ", "SHEET-SIM-004", "Đã nhận góp ý!", "state.client.auth.getUser(), "Date.now()-state.lastCheck>300000", "previousSnapshot!==nextSnapshot"]]],
    ['/assets/tester-sandbox.mjs',["LOCAL QA PRACTICE ONLY","DEMO_CATALOG","calculateDemo","out_of_stock"]],
    ['/assets/tester-admin.js',["tien404_tester_staff","getAuthClient()","buildTesterCsv(rows)","reviewRequest(request,decision)","assignSafeSheetsToTester"]],
    ['/assets/tester-report-csv.mjs',["buildTesterCsv","SELF-REPORTED"]],
    ['/assets/tester-guides.mjs',['messenger:', 'telegram:', 'zalo:', 'sheets:', 'ai_sales:', 'commerce:']],
    ['/assets/tester-portal.css',['tp-guide-list','tp-guide-step','.tp-friends .tp-intro','.tp-friends .tp-quick-choices']]
  ];
  for(const [path,needles] of checks){
    const {body}=await read(path);
    for(const needle of needles)assert.ok(body.includes(needle),path+' missing marker '+needle);
    console.log('VERIFIED HTTP 200 '+path+' '+body.length+' bytes');
    if(path==='/tester-admin.html')assert.ok(!body.includes('class="tp-friends"'),'Admin must remain unchanged');
  }
});
test('Private source SQL is not served by Render static preview',async()=>{
  for(const path of ['/qa/tester_portal/supabase_tester_portal_v1_candidate.sql','/qa/tester_portal/V12_2_TESTER_ACCESS_REQUESTS_STAGING.sql','/.env','/docs/ai-handoff/V12_2_PRIVATE_TESTER_PORTAL_STAGING_CHECKPOINT_20261114.md']){
    const r=await fetch(origin+path,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(25000)});
    const body=await r.text();
    assert.notEqual(r.status,200,'private content publicly accessible at '+path);
    assert.ok(!body.includes('CREATE TABLE public.tien404_tester_staff'),'SQL source leaked to web');
    console.log('PRIVATE PATH NOT PUBLIC '+path+' HTTP '+r.status);
  }
});
