import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('./ui/unified-inbox-qa.js', import.meta.url),'utf8');
const html = readFileSync(new URL('./ui/index.html',import.meta.url),'utf8');
class Element {
 constructor(tag='div',id=null){this.tag=tag;this.id=id;this.children=[];this.textContent='';
   this.listeners={};this.disabled=false;this.value='';this.attributes={};this.className='';}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 fire(name){for(const fn of this.listeners[name]??[])fn({type:name,target:this});}
 setAttribute(key,value){this.attributes[key]=value;}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=[...children];}
}
function setup(){
 const map=new Map();
 for(const id of ['store','channel','state','search','counts','storeName','threads',
   'messages','title','channelLabel','status','audit',
   'request','ack','resume','ackResume'])map.set(id,new Element('div',id));
 map.get('store').value='store-A';map.get('channel').value='all';
 map.get('state').value='all';
 const document={
   getElementById:id=>{assert.ok(map.has(id),'unknown UI element '+id);return map.get(id);},
   createElement:tag=>new Element(tag),
   createTextNode:text=>({tag:'#text',textContent:String(text)})
 };
 // No fetch, WebSocket, XMLHttpRequest, storage, timers or network globals
 // exist in this sandbox; any accidental side effect fails.
 runInNewContext(script,{document}, {timeout:1000});
 const el=id=>map.get(id);
 return {el,document};
}
test('UI initially displays four Store A synthetic conversations only',()=>{
 const {el}=setup();
 assert.equal(el('threads').children.length,4);
 assert.match(el('title').textContent,/QA-A-01/);
 assert.match(el('audit').textContent,/0 tin gửi thật/);
});
test('Store switch does not mix conversations across Store A/B',()=>{
 const {el}=setup();
 el('store').value='store-B';el('store').fire('change');
 assert.equal(el('threads').children.length,4);
 assert.match(el('title').textContent,/QA-B-01/);
 assert.equal(el('threads').children.some(n=>n.children.some(z=>
   String(z.textContent).includes('QA-A-01'))),false);
});
test('Zalo OA channel filter restricts to one QA row per Store',()=>{
 const {el}=setup();
 el('channel').value='zalo_oa';el('channel').fire('change');
 assert.equal(el('threads').children.length,1);
 assert.match(el('title').textContent,/QA-A-02/);
});
test('waiting staff suppresses direct bot resume, mock ACK transitions',()=>{
 const {el}=setup();
 assert.equal(el('ack').disabled,false);
 assert.equal(el('resume').disabled,true);
 el('ack').fire('click');
 assert.match(el('status').textContent,/Nhân viên tiếp quản/);
 assert.equal(el('ack').disabled,true);
 assert.equal(el('resume').disabled,false);
 el('resume').fire('click');
 assert.match(el('status').textContent,/Chờ trả AI/);
 assert.equal(el('ackResume').disabled,false);
 el('ackResume').fire('click');
 assert.match(el('status').textContent,/AI đang xử lý/);
 assert.equal(el('request').disabled,false);
 assert.match(el('audit').textContent,/0 Meta\/Zalo API call/);
});
test('no controls grant real permission or show real customer claims',()=>{
 const {el}=setup();
 assert.equal(el('title').textContent.includes('QA'),true);
 assert.equal(el('audit').textContent.includes('0 tin gửi thật'),true);
 assert.match(html,/Chỉ dành cho kiểm thử giao diện/);
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/form-action 'none'/);
});
test('unknown text search yields no conversations; safely uses text nodes',()=>{
 const {el}=setup();
 el('search').value='<svg onload=alert(1)>';el('search').fire('input');
 assert.equal(el('threads').children.length,1); // empty-state text element only
 assert.match(el('title').textContent,/Không có hội thoại/);
 assert.equal(script.includes('innerHTML'),false);
 assert.equal(script.includes('eval('),false);
});
test('no network or persistent user data surfaces in source',()=>{
 for(const forbidden of [/\bfetch\s*\(/,/\bWebSocket\s*\(/,/\bXMLHttpRequest\s*\(/,
   /\blocalStorage\b/,/\bsessionStorage\b/,/\bnavigator\.sendBeacon/,/\bpostMessage\s*\(/]){
   assert.equal(forbidden.test(script),false,String(forbidden));
 }
 assert.equal(html.includes('https://'),false);
 assert.equal(html.includes('http://'),false);
 assert.equal(html.includes('<iframe'),false);
});
