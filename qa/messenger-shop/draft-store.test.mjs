import test from 'node:test';
import assert from 'node:assert/strict';
import { createQaShopBook } from './draft-store.mjs';

function setup(t) {
  const shops=[{page:'A',owner:'ownerA',publicContact:'Zalo QA A'},{page:'B',owner:'ownerB'}];
  const variants=shops.flatMap(s=>['M','L'].map(size=>({page:s.page,sku:'A001',size,color:'đen',
    price:s.page==='A'?100000:130000,stock:s.page==='A'?2:5})));
  const book=createQaShopBook({shops,variants});
  t.after(()=>book.close());
  let seq=0;
  return {book,send:(page,sender,action,event=String(++seq))=>book.customer({page,sender,event},action)};
}
const select={type:'edit',sku:'A001',size:'M',color:'đen'};
const submit={type:'submit'};
test('đổi size và số lượng, chống lặp tin và lặp duyệt; đúng giá theo Page', t=>{
  const {book,send}=setup(t);
  assert.equal(send('A','khach',{type:'edit',sku:'A001'}).status,'ask_variant');
  assert.equal(send('A','khach',select).price,100000);
  assert.equal(send('A','khach',{type:'edit',size:'L'}).size,'L');
  assert.equal(send('A','khach',{type:'edit',qty:2}).total,200000);
  const {id}=send('A','khach',submit,'midX');
  assert.equal(send('A','khach',submit,'midX').status,'duplicate');
  assert.equal(send('A','khach',submit).id,id);
  assert.equal(send('B','khach',select).price,130000);
  assert.equal(book.inbox('ownerA').length,1);
  assert.equal(book.inbox('ownerB').length,0);
  assert.equal(book.approve('ownerB',id).status,'not_found');
  assert.equal(book.approve('ownerA',id).status,'approved');
  assert.equal(book.approve('ownerA',id).status,'approved');
  assert.equal(send('A','khac',{...select,size:'L'}).status,'reconfirm_stock');
});
test('hai yêu cầu mua cùng hàng; bản cũ không được duyệt sau khi khách sửa',t=>{
  const {book,send}=setup(t);
  send('A','x',select); const old=send('A','x',submit);
  send('A','x',{type:'edit',qty:2}); const current=send('A','x',submit);
  send('A','y',select); const other=send('A','y',submit);
  assert.equal(book.approve('ownerA',old.id).status,'superseded');
  assert.equal(book.approve('ownerA',current.id).status,'approved');
  assert.equal(book.approve('ownerA',other.id).status,'reconfirm_stock');
});
test('liên hệ công khai, tiếp quản từng khách và tạm dừng toàn shop',t=>{
  const {book,send}=setup(t);
  assert.equal(send('A','x',{type:'human'}).text,'Zalo QA A');
  assert.equal(send('B','x',{type:'human'}).text,'Shop chưa công khai liên hệ.');
  book.takeOver('ownerA','x');
  assert.equal(send('A','x',select).status,'silent');
  assert.equal(send('A','y',select).status,'summary');
  book.pause('ownerA',true);
  assert.equal(send('A','y',submit).status,'silent');
  assert.equal(send('B','y',select).status,'summary');
  assert.equal(send('C','y',select).status,'unbound_page');
});
test('hành trình qua payload Messenger và tin nhắn tiếng Việt trên catalog QA',t=>{
  const {book}=setup(t);
  let sequence=0;
  const chat=(message)=>book.customerMessage({page:'A',sender:'guest',event:String(++sequence)},message);
  const catalog=chat({text:'Xem sản phẩm'});
  assert.deepEqual(chat({payload:'T404:M:catalog'}),catalog);
  assert.deepEqual(catalog.rows.map(row=>row.size),['L','M']);
  assert.equal(chat({payload:'TIEN404:VIEW:A001'}).status,'ask_variant');
  assert.equal(chat({text:'màu đen'}).status,'ask_variant');
  assert.equal(chat({text:'size M'}).total,100000);
  assert.equal(chat({text:'đổi sang size L'}).size,'L');
  assert.equal(chat({text:'lấy 2 chiếc'}).total,200000);
  assert.equal(chat({text:'giá có giảm được không?'}).status,'ask_clarification');
  const req=chat({text:'gửi yêu cầu mua'});
  assert.equal(req.status,'pending_owner');
  assert.equal(book.inbox('ownerA')[0].qty,2);
  assert.equal(book.approve('ownerA',req.id).status,'approved');
});
test('báo tổng mới và đợi khách xác nhận lại khi giá đổi trước lúc gửi', t=>{
  const {book,send}=setup(t);
  assert.equal(send('A','x',{...select,qty:2}).total,200000);
  book.changePrice('ownerA',select,110000);
  const quote=send('A','x',submit,'confirm');
  assert.equal(quote.status,'reconfirm_price');
  assert.equal(quote.total,220000);
  assert.equal(send('A','x',submit,'confirm').status,'duplicate');
  assert.equal(book.inbox('ownerA').length,0);
  const draft=send('A','x',submit);
  assert.equal(book.inbox('ownerA')[0].price,110000);
  book.changePrice('ownerA',select,90000);
  assert.equal(book.approve('ownerA',draft.id).status,'reconfirm_price');
  assert.equal(send('A','x',submit).total,180000);
  assert.equal(book.approve('ownerA',draft.id).status,'superseded');
  const updated=send('A','x',submit);
  assert.equal(book.approve('ownerA',updated.id).status,'approved');
  assert.equal(send('B','x',select).price,130000);
});
test('hộp chờ chỉ hiện bản khách vừa chốt, rút lại trước khi chủ duyệt',t=>{
  const {book}=setup(t);
  let seq=0;
  const chat=text=>book.customerMessage({page:'A',sender:'guest',event:String(++seq)},{text});
  chat('Xem sản phẩm');
  book.customerMessage({page:'A',sender:'guest',event:String(++seq)},{payload:'TIEN404:VIEW:A001'});
  chat('màu đen'); chat('size M'); chat('đổi sang size L'); chat('lấy 2 chiếc');
  const first=chat('gửi yêu cầu mua');
  const pending=book.pendingInbox('ownerA');
  assert.deepEqual(pending.map(d=>[d.id,d.sku,d.size,d.qty,d.total]),[[first.id,'A001','L',2,200000]]);
  assert.equal(book.pendingInbox('ownerB').length,0);
  chat('để mình suy nghĩ');
  assert.equal(book.approve('ownerA',first.id).status,'superseded');
  assert.equal(book.pendingInbox('ownerA').length,0);
  chat('chỉ lấy 1 cái');
  const second=chat('gửi yêu cầu mua');
  assert.notEqual(second.id,first.id);
  assert.equal(book.pendingInbox('ownerA')[0].total,100000);
  assert.equal(book.approve('ownerA',second.id).status,'approved');
  assert.equal(book.pendingInbox('ownerA').length,0);
  assert.equal(book.approve('ownerA',second.id).status,'approved');
  assert.equal(chat('Xem sản phẩm').rows.find(row=>row.size==='L').stock,1);
});
test('ước tính giá đọc theo Page và khách, cập nhật khi chủ sửa giá',t=>{
  const {book}=setup(t);
  let mid=0;
  const chat=(page,sender,text)=>book.customerMessage({page,sender,event:String(++mid)},{text});
  // Both sizes are black: a color alone is insufficient to quote a specific variant.
  assert.equal(chat('A','x','Mẫu đen bao nhiêu?').rows.length,2);
  assert.equal(chat('A','x','lấy 2 cái thì sao?').status,'ask_variant');
  const single=createQaShopBook({shops:[{page:'A',owner:'a'},{page:'B',owner:'b'}],
    variants:[{page:'A',sku:'A001',size:'M',color:'đen',price:100000,stock:2},
      {page:'B',sku:'A001',size:'M',color:'đen',price:120000,stock:4}]});
  t.after(()=>single.close());
  const ask=(page,sender,text)=>single.customerMessage({page,sender,event:String(++mid)},{text});
  assert.equal(ask('A','x','Mẫu đen bao nhiêu?').rows[0].price,100000);
  assert.equal(ask('B','x','lấy 2 cái thì sao?').status,'ask_variant');
  assert.equal(ask('A','y','lấy 2 cái thì sao?').status,'ask_variant');
  single.changePrice('a',{sku:'A001',size:'M',color:'đen'},99000);
  assert.equal(ask('A','x','lấy 2 cái thì sao?').total,198000);
  assert.equal(ask('A','x','lấy 3 cái thì sao?').status,'reconfirm_stock');
  assert.equal(ask('B','x','Mẫu đen bao nhiêu?').rows[0].price,120000);
  assert.deepEqual(single.inbox('a'),[]);
});
test('không gửi nhầm mẫu đã chọn từ trước sau lượt tư vấn',t=>{
  const {book,send}=setup(t);
  send('A','x',select);
  book.customerMessage({page:'A',sender:'x',event:'inquiry'},{text:'Mẫu trắng bao nhiêu?'});
  assert.equal(send('A','x',submit).status,'ask_variant');
  assert.equal(send('A','x',{type:'edit',qty:2}).status,'ask_variant');
  assert.deepEqual(book.inbox('ownerA'),[]);
  assert.equal(send('A','x',select).status,'summary');
  assert.equal(send('A','x',submit).status,'pending_owner');
});
test('đổi liên hệ đúng khách và Page, phát lại chỉ sửa một lần, giữ khi đổi số lượng',t=>{
  const book=createQaShopBook({shops:[{page:'A',owner:'a'},{page:'B',owner:'b'}],
    variants:[{page:'A',sku:'T-A',size:'M',color:'đen',price:100,stock:5}]});
  t.after(()=>book.close());
  let seq=0;
  const chat=(text,page='A',sender='guest',event=String(++seq))=>book.customerMessage({page,sender,event},{text});
  for (const text of ['Lấy T-A x1','Tên QA, SĐT 0000000000, địa chỉ 12 Đường Mẫu','đồng ý']) chat(text);
  const request='Đổi tên đơn QA-ORDER-1, số 0000000000, thành Khách Mới';
  assert.equal(chat(request,'B').status,'unverified_order');
  assert.equal(chat(request,'A','other').status,'unverified_order');
  assert.equal(chat(request).status,'change_preview');
  assert.equal(chat('tôi xác nhận','A','guest','confirm').status,'change_saved');
  assert.equal(chat('tôi xác nhận','A','guest','confirm').status,'duplicate');
  assert.equal(book.inbox('a')[0].edit_version,1);
  chat('chỉ lấy 2');chat('đồng ý');
  const current=book.pendingInbox('a')[0];
  assert.equal(current.qty,2);
  assert.match(current.contact,/Khách Mới/);
  assert.equal(chat(request.replace('ORDER-1','ORDER-'+current.id)).status,'change_preview');
  assert.equal(book.approve('a',current.id).status,'approved');
  assert.equal(chat('tôi xác nhận').status,'change_stale');
});
