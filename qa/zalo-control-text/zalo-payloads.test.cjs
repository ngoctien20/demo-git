'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {styledMessage,markdownMessage,numberedMenu,officialSamples}=require('./zalo-payloads.cjs');
const {STYLE_CODES}=require('../sales-lite/v133/rich-text.cjs');
const fs=require('node:fs');
test('official samples build four safe Rich Text/Markdown drafts, never sends',()=>{
 const samples=officialSamples();
 assert.equal(samples.length,4);
 for(const s of samples){
  assert.equal(s.send_enabled,false);assert.equal(s.provider_tested,false);
  assert.ok(s.text.length<=2000&&s.text.length>0);
  assert.equal('chat_id' in s,false);assert.equal('bot_token' in s,false);assert.equal('url' in s,false);
 }
});
test('sample 1 offers fake numbered controls as text only',()=>{
 const a=officialSamples()[0];
 assert.match(a.text,/1\. Xem sản phẩm\n2\. Hỏi giá\n3\. Gửi yêu cầu mua hàng/);
 assert.deepEqual(a.text_styles[0].st,['b','f_18','c_15a85f']);
 assert.equal(a.text.slice(0,a.text_styles[0].len),'TIEN404');
});
test('second line range counts emoji in UTF-16 correctly',()=>{
 const a=officialSamples()[1];
 assert.equal(a.text_styles[1].start,22);
 assert.equal(a.text.slice(a.text_styles[1].start,a.text_styles[1].start+a.text_styles[1].len),'Danh mục thử nghiệm');
});
test('full-text underline and red supported',()=>assert.deepEqual(officialSamples()[2].text_styles[0].st,['u','c_db342e']));
test('Markdown samples omit text_styles and never mix modes',()=>{
 const m=officialSamples()[3];assert.equal(m.parse_mode,'markdown');assert.equal('text_styles' in m,false);
 assert.match(m.text,/\{green\}/);
});
test('all supported fixed style codes validate as entire text spans',()=>{
 for(const st of STYLE_CODES)assert.equal(styledMessage('Tiếng Việt ✅',[{start:0,len:12,st:[st]}]).text_styles[0].st[0],st);
});
test('emoji half-surrogate cannot be highlighted',()=>{
 assert.throws(()=>styledMessage('X🛒Y',[{start:2,len:1,st:['b']}]),/UTF16_RANGE_INVALID/);
});
test('negative offsets, zero length, overshoot rejected',()=>{
 for(const r of [{start:-1,len:1,st:['b']},{start:0,len:0,st:['b']},{start:0,len:100,st:['b']}])
 assert.throws(()=>styledMessage('A',[r]),/UTF16_RANGE_INVALID/);
});
test('arbitrary colors and fabricated button styles are rejected',()=>{
 for(const bad of ['c_ffffff','button','reply_markup','javascript'])assert.throws(()=>styledMessage('A',[{start:0,len:1,st:[bad]}]),/STYLE_NOT_WHITELISTED/);
});
test('empty or overlong message fails Zalo 1..2000 contract',()=>{
 assert.throws(()=>styledMessage('',[]),/TEXT_LENGTH_INVALID/);
 assert.throws(()=>styledMessage('a'.repeat(2001),[]),/TEXT_LENGTH_INVALID/);
});
test('numbered menu keeps action IDs internal, no fake callback transport',()=>{
 const q=numberedMenu({role:'CUSTOMER',heading:'SHOP QA',items:[
   {label:'Xem sản phẩm',action_id:'CUS_CATALOG'},
   {label:'Xem giá',action_id:'CUS_PRICE'},
   {label:'Để lại yêu cầu',action_id:'CUS_ORDER_DRAFT'}
 ]});
 assert.equal(q.native_buttons,false);assert.equal(q.callback_payload,null);
 assert.equal(q.control_map[0].number,'1');assert.equal(q.control_map[0].action_id,'CUS_CATALOG');
 assert.match(q.text,/Trả lời bằng số/);assert.equal(q.external_sends,0);assert.equal(q.write_enabled,false);
});
test('menus forbid fake role and invalid action ID',()=>{
 assert.throws(()=>numberedMenu({role:'GUEST',heading:'MENU',items:[{label:'A',action_id:'CUS_CATALOG'}]}),/MENU_INVALID/);
 assert.throws(()=>numberedMenu({role:'CUSTOMER',heading:'MENU',items:[{label:'A',action_id:'doAnySql()'}]}),/MENU_ITEM_INVALID/);
});
test('numbered text menu limits to 9 entries',()=>{
 assert.throws(()=>numberedMenu({role:'OWNER',heading:'M',items:Array.from({length:10},(_,i)=>({label:'Mục '+i,action_id:'ACT_ITEM_'+i}))}),/MENU_INVALID/);
});
test('control payload has no sender or network function',()=>{
 const src=fs.readFileSync(require.resolve('./zalo-payloads.cjs'),'utf8');
 for(const s of ['axios','node-fetch','fetch(','.post(','executeWorkflow(', 'sendMessage('])assert.equal(src.includes(s),false,s);
});
