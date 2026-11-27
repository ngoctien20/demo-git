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
