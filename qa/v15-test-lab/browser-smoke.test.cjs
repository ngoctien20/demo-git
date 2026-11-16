'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)\s*<\/script>/i)?.[1];
function build(){
 const node=()=>({value:'',textContent:'',children:[],listeners:{},append(...children){this.children.push(...children)},appendChild(x){this.children.push(x);return x},replaceChildren(){this.children=[]},addEventListener(e,cb){this.listeners[e]=cb},focus(){},click(){this.clicked=true},remove(){},setAttribute(){},scrollTop:0,scrollHeight:0});
 const ids=['shop','channel','model','role','message','botName','shopName','avatar','productCard','messages','trace','total','passCount','failCount','run','reset','pass','fail','export'];
 const elements=Object.fromEntries(ids.map(id=>[id,node()]));
 Object.assign(elements.shop,{value:'A'});Object.assign(elements.channel,{value:'Messenger'});
 Object.assign(elements.model,{value:'gpt-6-luna'});Object.assign(elements.role,{value:'customer'});
 const samples=[node(),node()];
 samples[0].getAttribute=()=> 'Xin chào';
 const document={getElementById:id=>elements[id],createElement:()=>node(),createTextNode:text=>({type:'text',textContent:text}),querySelectorAll:()=>samples,body:node()};
 let blob=null;
 const context={document,Blob,Intl,Date,setTimeout:()=>0,URL:{createObjectURL:b=>(blob=b,'blob:qa-test'),revokeObjectURL:()=>{}}};
 vm.createContext(context);new vm.Script(script).runInContext(context,{timeout:1000});
 return {elements,samples,getBlob:()=>blob};
}
test('inline Test Lab JS syntax parses in VM',()=>assert.doesNotThrow(()=>new vm.Script(script)));
test('initial Shop A greeting contains V14.7 Bot Profile',()=>{const x=build();assert.equal(x.elements.botName.textContent,'An AI');assert.match(x.elements.productCard.textContent,/Gạo thơm túi 5kg/);assert.equal(x.elements.messages.children.length,1)});
test('click run greeting produces QA log and does not send real message',()=>{const x=build();x.elements.message.value='Xin chào';x.elements.run.listeners.click();assert.equal(x.elements.total.textContent,'1');assert.match(x.elements.trace.textContent,/API model: CHƯA GỌI/);assert.match(x.elements.trace.textContent,/Đơn \/ Gửi tin thật: 0 \/ 0/);});
test('Shop B selector changes product not Shop A',()=>{const x=build();x.elements.shop.value='B';x.elements.shop.listeners.change();assert.equal(x.elements.botName.textContent,'Bình Stylist');assert.match(x.elements.productCard.textContent,/209.000đ/);assert.ok(!x.elements.productCard.textContent.includes('Gạo thơm'));});
test('missing SKU on Shop C does not quote another fixture',()=>{const x=build();x.elements.shop.value='C';x.elements.shop.listeners.change();x.elements.message.value='A002 giá bao nhiêu';x.elements.run.listeners.click();const b=x.elements.messages.children.at(-1);assert.match(b.children.at(-1).textContent,/Không tìm thấy/);});
test('customer revenue report is blocked, not a real owner right',()=>{const x=build();x.elements.message.value='doanh thu hôm nay';x.elements.run.listeners.click();assert.match(x.elements.trace.textContent,/TRẠNG THÁI: BLOCKED/);});
test('simulated owner is never authenticated as a real Owner',()=>{const x=build();x.elements.role.value='owner';x.elements.message.value='doanh thu hôm nay';x.elements.run.listeners.click();assert.match(x.elements.messages.children.at(-1).children.at(-1).textContent,/chỉ là vai trò giả lập/);});
test('QA pass/fail manual actions work without server sync',()=>{const x=build();x.elements.message.value='Xin chào';x.elements.run.listeners.click();x.elements.pass.listeners.click();assert.equal(x.elements.passCount.textContent,'1');x.elements.fail.listeners.click();assert.equal(x.elements.failCount.textContent,'1');assert.equal(x.elements.passCount.textContent,'0');});
test('UAT JSON exported locally with all no-send claims',async()=>{const x=build();x.elements.message.value='Xin chào';x.elements.run.listeners.click();x.elements.export.listeners.click();const blob=x.getBlob();assert.ok(blob);const j=JSON.parse(await blob.text());assert.equal(j.provider_tested,false);assert.equal(j.reviewer_auth_verified,false);assert.equal(j.cases.length,1);assert.equal(j.cases[0].model_called,false);assert.equal(j.cases[0].can_send,false);});
test('untrusted HTML in user text is DOM text, never HTML injection',()=>{const x=build();x.elements.message.value='<script>alert(1)</script>';x.elements.run.listeners.click();const sent=x.elements.messages.children.at(-2);assert.equal(sent.children.at(-1).textContent,'<script>alert(1)</script>');});
