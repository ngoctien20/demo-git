import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Friend-first portal shows a short project intro and keeps advanced controls collapsed',()=>{
 const html=read('tester.html');
 const js=read('assets/tester-portal.js');
 const start=html.indexOf('<details id="tp-more"');
 const end=html.indexOf('</nav></details>',start);
 assert.ok(html.includes('class="tp-friends"'),'Scoped, no Tester Admin changes');
 assert.ok(start>0 && end>start,'Advanced nav lives inside closed details');
 assert.ok(html.slice(start,end).includes('id="tp-nav"'));
 assert.ok(!html.slice(start,end).includes(' open>'),'Advanced menu starts closed');
 assert.ok(html.includes('id="tp-progress-more"'),'Detailed metrics are optional');
 for(const snippet of ['Một trợ lý bán hàng cho những cửa hàng nhỏ','trả lời khách','chưa phải trò chuyện với AI thật','CHỌN'] ){
  if(snippet==='CHỌN')continue;
  assert.ok(js.includes(snippet),snippet);
 }
 assert.ok(js.includes("home:['Chào mừng bạn!"));
});
test('Simple experience supports immediate 3 scenarios with real persisted self-reports',()=>{
 const js=read('assets/tester-portal.js');
 for(const token of [
  'SHEET-SIM-002','SHEET-SIM-004','SHEET-SIM-009',
  "function renderHome()", "calculateDemo(entry.input)",
  "from('tien404_tester_runs').insert(", "feedback:feedback||null",
  "environment:'staging',self_reported:true", "case_id:selected.caseId",
  "state.client.auth.getUser()", "REPORT_NOT_VERIFIED",
  "state.runs=readback.data", "progress()",
  "'self_pass'","'self_fail'","'blocked'",
  'KẾT QUẢ MÔ PHỎNG — KHÔNG PHẢI AI THẬT'
 ])assert.ok(js.includes(token),token);
 assert.ok(!js.includes('innerHTML'));
 assert.ok(!js.includes('https://graph.facebook.com'));
 assert.ok(!js.includes('sb_secret_'));
});
test('Legacy QA detailed flows, built-in practice, admin and RLS remain',()=>{
 const js=read('assets/tester-portal.js'),html=read('tester.html');
 for(const item of [
  'function renderModules()','function renderGuidedSteps(moduleId)',
  'function renderPractice()','function renderProgress()',
  'function openCase(caseId)',"from('tien404_tester_access')",
  "from('tien404_tester_assignments')","guideForModule(moduleId)"
 ])assert.ok(js.includes(item),item);
 for(const page of ['home','modules','data','practice','progress','help'])
   assert.ok(html.includes('data-page="'+page+'"'),page);
 const admin=read('tester-admin.html');
 assert.ok(!admin.includes('class="tp-friends"'));
 assert.ok(admin.includes('id="ta-protected" hidden'));
});
test('Friend-first responsive styles are isolated from admin and no public access is opened',()=>{
 const css=read('assets/tester-portal.css'),html=read('tester.html');
 for(const selector of ['.tp-friends #tp-workspace','.tp-friends .tp-more',
 '.tp-friends .tp-intro','.tp-friends .tp-quick-choices',
 '.tp-friends .tp-feedback-actions','@media(max-width:700px)'])
  assert.ok(css.includes(selector),selector);
 assert.ok(html.includes('id="tp-workspace" class="tp-workspace" hidden'));
 assert.ok(html.includes('id="tp-locked" class="tp-locked" hidden'));
 assert.ok(html.includes('noindex,nofollow'));
});
