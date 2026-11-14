import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PRIORITY_CHECKS,AI_REVIEW_CASE_ID,runPriorityChecks,reviewPrompt,reportText,containsSensitive} from '../assets/tester-qa-pack.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Risk-first suite runs exactly eight deterministic high-value synthetic checks',()=>{
 assert.equal(PRIORITY_CHECKS.length,8);
 assert.equal(new Set(PRIORITY_CHECKS.map(c=>c.caseId)).size,8);
 assert.equal(PRIORITY_CHECKS.filter(c=>c.risk==='P0').length,2);
 const results=runPriorityChecks(PRIORITY_CHECKS.map(c=>c.caseId));
 assert.equal(results.length,8);
 assert.equal(results.filter(c=>c.ok).length,8);
 assert.deepEqual(results.map(c=>c.observed),['ok','ok','out_of_stock','not_found','invalid_quantity','price_mismatch','ok','invalid_price']);
 assert.equal(results[0].observedTotal,318000);
 assert.equal(results[1].observedTotal,3975000);
 assert.deepEqual(runPriorityChecks(['SHEET-SIM-002']).map(x=>x.caseId),['SHEET-SIM-002']);
});
test('External AI prompt is bounded to synthetic evidence and explicitly forbids live calls',()=>{
 const prompt=reviewPrompt(runPriorityChecks(PRIORITY_CHECKS.map(x=>x.caseId)));
 for(const text of ['CHƯA XÁC MINH','KHÔNG PHẢI phản hồi LLM','Messenger','Zalo','không đòi token','KHÔNG nghiệm thu AI thật','SHEET-SIM-004','observedCode'])
  assert.ok(prompt.includes(text),text);
 assert.ok(!prompt.includes('tienmobi208@'));
 assert.ok(!prompt.includes('sb_secret_'));
 assert.ok(!prompt.includes('ngoctien20.app.n8n.cloud/webhook'));
 assert.throws(()=>reviewPrompt([]));
});
test('Human review must explicitly choose priority, verdict, and provide meaningful notes',()=>{
 const results=runPriorityChecks(PRIORITY_CHECKS.map(c=>c.caseId));
 const args={results,stamp:'2026-11-15T00:00:00Z',notes:'Bài mô phỏng đúng nhưng chưa kiểm thử bot thật.',severity:'P1',verdict:'needs_review'};
 const report=reportText(args);
 for(const expected of ['QA-STUDIO/v1','8/8','Severity P1','Human verdict needs_review','UNVERIFIED'])
   assert.ok(report.includes(expected));
 assert.throws(()=>reportText({...args,notes:'ngắn'}));
 assert.throws(()=>reportText({...args,severity:'P9'}));
 assert.throws(()=>reportText({...args,verdict:'approved'}));
 assert.equal(containsSensitive('Bearer abcdefghijklmnopqrst'),true);
 assert.equal(containsSensitive('sb_secret_fakevalue'),true);
 assert.equal(containsSensitive('sk-examplelong123456789012345'),true);
 assert.equal(containsSensitive('Chỉ dữ liệu giả lập: 159.000đ'),false);
});
test('Studio never sends content to external AI automatically or trusts AI outcome as verified',()=>{
 const ui=read('assets/tester-ai-studio.mjs');
 const portal=read('assets/tester-portal.js');
 for(const item of [
  "mountQaStudio(pane,{state,onSaved:()=>progress()})",
  "from('tien404_tester_runs').insert(", "auth.getUser()",
  ".select('run_id').single()",".eq('run_id',inserted.data.run_id)",
  "self_reported:true","AI_REVIEW_CASE_ID","containsSensitive(notes.value)",
  "navigator.clipboard.writeText(prompt)","attest.checked"
 ])assert.ok((ui+portal).includes(item),item);
 for(const suspicious of ['fetch(', '/webhook/', 'signUp(', 'supabase.auth.admin', 'innerHTML'])
  assert.ok(!ui.includes(suspicious),suspicious);
 assert.ok(portal.includes('tp-quick-details'));
 assert.ok(ui.includes('Không gửi dữ liệu tới bên thứ ba tự động.'));
 assert.ok(ui.includes('UNVERIFIED')||ui.includes('không tự động chuyển bài thành PASS'));
});
test('RLS assignment remains the gate; one new ready report case, no new role or live permissions',()=>{
 const sql=read('qa/tester_portal/V12_3_AI_REVIEW_SHEETS_CASE_STAGING.sql');
 assert.ok(sql.includes("'SHEET-AI-REVIEW-001'"));
 assert.ok(sql.includes("'sheets'"));
 assert.ok(sql.includes('ON CONFLICT(case_id) DO NOTHING'));
 assert.ok(!sql.includes('SECURITY DEFINER'));
 assert.ok(!sql.includes('GRANT'));
 assert.equal(AI_REVIEW_CASE_ID,'SHEET-AI-REVIEW-001');
});
test('Strict public build includes reviewed modules, excludes fixture SQL',()=>{
 const build=read('scripts/build-auth-preview.mjs');
 assert.ok(build.includes("'assets/tester-qa-pack.mjs'"));
 assert.ok(build.includes("'assets/tester-ai-studio.mjs'"));
 const out=new URL('../auth-preview-dist/',import.meta.url);
 if(fs.existsSync(out)){
  assert.ok(fs.existsSync(new URL('assets/tester-qa-pack.mjs',out)));
  assert.ok(fs.existsSync(new URL('assets/tester-ai-studio.mjs',out)));
  assert.ok(!fs.existsSync(new URL('qa/tester_portal/V12_3_AI_REVIEW_SHEETS_CASE_STAGING.sql',out)));
 }
});
