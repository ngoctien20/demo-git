'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const fs=require('./menu-registry.json');
const html=readFileSync(join(__dirname,'mock','index.html'),'utf8');
test('MOCK-01 real HTML document is responsive in Vietnamese',()=>{
 assert.match(html,/<html lang="vi">/);assert.match(html,/name="viewport"/);
 assert.match(html,/@media\(max-width:760px\)/);
});
test('MOCK-02 client-side prototype fetches the shared registry only',()=>{
 assert.match(html,/fetch\('\.\.\/menu-registry.json'/);
 assert.match(html,/registry=j;reset\(\)/);
 assert.doesNotMatch(html,/sendMessage\(|fetch\(['"]https?:\/\/|XMLHttpRequest|WebSocket|navigator\.sendBeacon/);
});
test('MOCK-03 no customer Orders or Supabase writes in mock code',()=>{
 assert.doesNotMatch(html,/\.from\(['"]orders|\.insert\(|\.update\(|\.delete\(|localStorage|sessionStorage/);
});
test('MOCK-04 fixture price is clearly labeled QA-only and not live',()=>{
 assert.match(html,/chỉ là dữ liệu QA cũ/i);assert.match(html,/không phải báo giá thời gian thực/i);
});
test('MOCK-05 switching UI roles is explicitly marked as insecure demo',()=>{
 assert.match(html,/Quyền ở đây thay đổi được bằng nút chọn/);
 assert.match(html,/Quyền của hệ thống thật phải lấy từ backend/);
});
test('MOCK-06 native quick reply is disabled',()=>{
 assert.match(html,/<button disabled>Nút quick reply/);
 assert.match(html,/chưa xác minh API/);
});
test('MOCK-07 controls are actual interactive elements',()=>{
 for(const id of ['role','shop','menu','chat','typeform','text'])
  assert.match(html,new RegExp('id="'+id+'"'));
});
test('MOCK-08 no external CSS/JS tracking or unsafe CDN',()=>{
 assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=|gtag|facebook\.com|cdn\.|google-analytics/);
});
test('MOCK-09 registry actions have a stable unique ID',()=>{
 const list=fs.menus.flatMap(m=>m.actions);
 assert.equal(new Set(list.map(a=>a.action_id)).size,list.length);
});
test('MOCK-10 no secrets, tokens or credentials embedded in HTML',()=>{
 assert.doesNotMatch(html,/ifxlvrhyjhbzbrkdsida|postgres\.|sk-[A-Za-z0-9]+|BOT_TOKEN|SUPABASE_SERVICE_ROLE|api_key\s*=/);
});
