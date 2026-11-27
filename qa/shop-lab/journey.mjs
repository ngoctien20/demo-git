import assert from 'node:assert/strict';
import {createQaShopBook} from '../messenger-shop/draft-store.mjs';
import {catalog} from './fixtures.mjs';
const book=createQaShopBook({shops:['A','B'].map(page=>({page,owner:page,publicContact:'Liên hệ QA'})),
  variants:['A','B'].flatMap(page=>catalog(page).map(v=>({...v,page})))});
let n=0;const trace=[];
function send(text,event=String(++n),message={text}) {
  const reply=book.customerMessage({page:'A',sender:'khách QA',event},message);
  trace.push({input:text,status:reply.status,reply:reply.text??(reply.total ? [reply.sku,reply.color,reply.size,'× '+reply.qty,reply.total.toLocaleString('vi-VN')+'đ'].join(' · ') : reply.status)});
  return reply;
}
send('Xem sản phẩm');send('Chọn A001',undefined,{payload:'TIEN404:VIEW:A001'});
assert.equal(send('lấy áo đen size M').size,'M');
assert.equal(send('à đổi sang L').size,'L');
assert.equal(send('lấy thêm hai cái').status,'ask_quantity');
assert.equal(send('xác nhận yêu cầu mua').status,'ask_quantity');
assert.equal(send('thôi lấy 2 cái').total,318000);
const draft=send('xác nhận yêu cầu mua','confirm');
assert.equal(send('xác nhận yêu cầu mua','confirm').status,'duplicate');
const [owner]=book.pendingInbox('A');assert.equal(owner.id,draft.id);assert.equal(owner.total,318000);
assert.equal(book.pendingInbox('B').length,0);
book.changeStock('A',owner,1);assert.equal(book.approve('A',owner.id).status,'reconfirm_stock');
send('để mình suy nghĩ');assert.equal(book.approve('A',owner.id).status,'superseded');
book.changeStock('A',owner,2);send('thôi lấy 2 cái');const next=send('xác nhận yêu cầu mua');
for(let i=0;i<2;i++) assert.equal(book.approve('A',next.id).status,'approved');
assert.equal(send('Xem sản phẩm').rows.find(r=>r.sku==='A001'&&r.size==='L').stock,0);
assert.equal(send('gặp nhân viên').status,'contact');assert.equal(book.supportInbox('A').length,0);
assert.equal(send('gửi yêu cầu hỗ trợ').status,'staff_requested');assert.equal(book.supportInbox('A')[0].accepted,0);
book.takeOver('A','khách QA');assert.equal(book.supportInbox('A')[0].accepted,1);
assert.equal(send('Xem sản phẩm').status,'silent');
console.log(JSON.stringify({trace,owner:{sku:owner.sku,color:owner.color,size:owner.size,qty:owner.qty,total:owner.total},shopBPending:0},null,2));
book.close();
