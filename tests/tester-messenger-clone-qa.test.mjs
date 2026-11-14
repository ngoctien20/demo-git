import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {QA_RANDOM_CASES} from '../assets/tester-random-qa-cases.mjs';
import {MESSENGER_QA_REPORT_CASE,MESSENGER_QA_CLONE_ID,reviewSummary} from '../assets/tester-messenger-clone-qa.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Messenger Clone QA case is exactly the confirmed isolated n8n workflow',()=>{
 assert.equal(MESSENGER_QA_REPORT_CASE,'SHEET-MESSENGER-CLONE-001');
 assert.equal(MESSENGER_QA_CLONE_ID,'5Sw0ZDFRvrRjEfUZ');
 assert.equal(new Set(QA_RANDOM_CASES.map(c=>c.id)).size,96);
});
test('Manual evidence requires observed response, notes, source and valid n8n execution number',()=>{
 const input={caseItem:QA_RANDOM_CASES[0],source:'n8n_private',executionId:'4110',
  response:'Shop đã đọc sản phẩm QA, giá 159.000đ và tồn kho 25.',notes:'Tôi đã kiểm tra kết quả, cần xem tool có được gọi không.',outcome:'needs_review'};
 const report=reviewSummary(input);
 for(const token of ['MESSENGER_CLONE_QA/v1','UNVERIFIED','SELF_REPORTED','execution #4110','Case QA01','NOT independently verified'])
  assert.ok(report.includes(token),token);
 for(const change of [{executionId:''},{executionId:'1;DROP'},{source:'test'},{outcome:'approved'},{response:'ngắn'},{notes:'ngắn'}]){
  assert.throws(()=>reviewSummary({...input,...change}));
 }
 assert.match(reviewSummary({...input,source:'external_manual',executionId:''}),/external_manual/);
});
test('Common credentials, phone numbers and bearer secrets are blocked before reporting',()=>{
 const input={caseItem:QA_RANDOM_CASES[0],source:'external_manual',executionId:'',
  response:'AI đã trả một câu đầy đủ theo giá sản phẩm QA.',notes:'Đây là nhận xét mẫu từ bộ câu hỏi của tester.',outcome:'needs_review'};
 for(const txt of ['Bearer abcdefghijklmnopqrst','sk-abcxyzxyzxyzxyzxyzxyz','SĐT 0912345678','số +84912345678']){
  assert.throws(()=>reviewSummary({...input,notes:txt+' báo cáo chưa kiểm tra'}),txt);
 }
 assert.ok(reviewSummary(input).includes('UNVERIFIED'));
});
test('Tester clone UI never calls n8n, Meta or another LLM from public browser',()=>{
 const src=read('assets/tester-messenger-clone-qa.mjs');
 const studio=read('assets/tester-ai-studio.mjs');
 const build=read('scripts/build-auth-preview.mjs');
 for(const required of [
 "state.access?.access_status==='approved'","state.modules.some(x=>x.module_id==='sheets')",
 "auth.getUser()","from('tien404_tester_runs').insert","self_reported:true",
 ".select('run_id').single()",".eq('run_id',result.data.run_id)",
 "containsSensitive","tp-messenger-clone-attest","state.epoch"
 ]) assert.ok(src.includes(required),required);
 assert.ok(studio.includes('mountMessengerCloneQa(root,{state,onSaved})'));
 assert.ok(build.includes("'assets/tester-messenger-clone-qa.mjs'"));
 for(const forbidden of ['fetch(','/webhook/','openai.com/v1','graph.facebook.com','service_role','supabase.auth.admin','innerHTML'])assert.ok(!src.includes(forbidden),forbidden);
 assert.ok(src.includes('CANDIDATE chưa mở cho website gọi trực tiếp'));
});
test('One ready staging report case, no new roles or permissions',()=>{
 const sql=read('qa/tester_portal/V12_5_MESSENGER_CLONE_SELF_REPORT_CASE_STAGING.sql');
 assert.ok(sql.includes("'SHEET-MESSENGER-CLONE-001'"));
 assert.ok(sql.includes("'sheets'"));
 assert.ok(sql.includes('ON CONFLICT(case_id) DO NOTHING'));
 for(const forbidden of ['GRANT ','SECURITY DEFINER','ALTER POLICY','CREATE ROLE'])assert.ok(!sql.includes(forbidden));
 const out=new URL('../auth-preview-dist/',import.meta.url);
 if(fs.existsSync(out)){
  assert.ok(fs.existsSync(new URL('assets/tester-messenger-clone-qa.mjs',out)));
  assert.ok(!fs.existsSync(new URL('qa/tester_portal/V12_5_MESSENGER_CLONE_SELF_REPORT_CASE_STAGING.sql',out)));
 }
});
