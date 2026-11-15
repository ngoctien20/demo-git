'use strict';
// V14.4.8 synthetic four-flow Messenger QA. NO NETWORK, META, DB OR CREDENTIAL.
const PAGES=Object.freeze({
 PAGE_QA_A:{tenant:'T1',store:'A',sku:'A001',name:'Áo thun trắng M',price:159000,stock:3},
 PAGE_QA_B:{tenant:'T1',store:'B',sku:'A001',name:'Áo thun trắng M',price:209000,stock:8},
 PAGE_QA_C:{tenant:'T2',store:'C',sku:'A001',name:'Áo thun trắng M',price:259000,stock:2}
});
const norm=x=>String(x||'').toLowerCase().normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim();
const vnd=n=>new Intl.NumberFormat('vi-VN').format(n)+'đ';
function createMessengerQaLab(){
 const branded=new WeakSet(),requests=new Map(),outbox=new Map(),pending=new Map(),seen=new Map();
 let seq=0;
 const gateway=Object.freeze({fixtureEnvelope({pageId,senderId,text,mid}={}){
  if(!Object.hasOwn(PAGES,pageId)||!/^QA_USER_[A-Z0-9_]{1,30}$/.test(senderId||'')||
   !/^QA_MID_[A-Z0-9_-]{3,70}$/.test(mid||'')||typeof text!=='string'||
   !text.trim()||text.length>800)throw Error('BAD_SYNTHETIC_ENVELOPE');
  const e=Object.freeze({pageId,senderId,text,mid});branded.add(e);return e;
 }});
 function reply(e,flow,message,other={}){
  return Object.freeze({level:'LEVEL1_OFFLINE_FIXTURE',flow,message,page:e.pageId,
   store:PAGES[e.pageId].store,writes:0,providerSends:0,
   richUi:'TEXT_FALLBACK_ONLY',...other});
 }
 function handle(e){
  if(!branded.has(e))throw Error('TRUSTED_FIXTURE_GATE_REQUIRED');
  const ek=e.pageId+'|'+e.mid;
  if(seen.has(ek))return Object.freeze({...seen.get(ek),replayed:true});
  const p=PAGES[e.pageId],n=norm(e.text),owner=e.pageId+'|'+e.senderId;
  const s=pending.get(owner);let r;
  if((n==='xac nhan'||n==='dong y')&&s){
   pending.delete(owner);
   if(s.expected!==p.price*s.qty || s.qty>p.stock)
    r=reply(e,'ORDER','Giá hoặc tồn kho QA đã đổi. Cần xác nhận lại.',{orderCreated:false});
   else{
    const k=owner+'|'+s.mid;let order=requests.get(k);
    if(!order){
     order=Object.freeze({code:'QA-REQ-'+String(++seq).padStart(4,'0'),
      tenant:p.tenant,store:p.store,sender:e.senderId,page:e.pageId,
      qty:s.qty,sku:p.sku,total:p.price*s.qty,status:'requested'});
     requests.set(k,order);
     outbox.set(k,{code:order.code,tenant:p.tenant,store:p.store,
       status:'READY_OFFLINE_NOT_SENT'});
    }
    r=reply(e,'ORDER','Đã lưu yêu cầu thử nghiệm '+order.code+
     ' / '+s.qty+' sản phẩm / '+vnd(order.total)+'. Chưa giữ kho.',{
      requestCode:order.code,outboxStatus:'READY_OFFLINE_NOT_SENT'});
   }
  }else if(n==='huy xac nhan'){
   pending.delete(owner);r=reply(e,'ORDER','Đã hủy bước xác nhận. Chưa lưu đơn.');
  }else if(/don cua toi|tra cuu don|kiem tra don|ma don/.test(n)){
   const matches=[...requests.values()].filter(x=>x.page===e.pageId&&x.sender===e.senderId);
   const last=matches.at(-1);
   r=reply(e,'ORDER_SUPPORT',last?
    'Yêu cầu '+last.code+' đang ở trạng thái '+last.status+' (dữ liệu giả lập).':
    'Chưa có yêu cầu QA thuộc tài khoản và cửa hàng này.',{requestCode:last?.code||null});
  }else if(/huy don|sua don|doi dia chi|doi so luong/.test(n)){
   r=reply(e,'ORDER_SUPPORT','Thao tác sửa/hủy cần xác minh chủ sở hữu, trạng thái và chính sách. Chưa ghi thay đổi.');
  }else if(/ho tro|nhan vien|gap chu shop|khieu nai/.test(n)){
   r=reply(e,'ORDER_SUPPORT','Đã ghi nhận ý định hỗ trợ trong hội thoại QA, chưa gửi tin chủ shop.');
  }else if(/gia si|giam gia|gia 100|mac ca/.test(n)){
   r=reply(e,'QUOTE','Giá niêm yết QA '+vnd(p.price)+'. Không có chính sách giá sỉ/giảm giá được xác minh.');
  }else if(/dat|lay|mua/.test(n)&&/\b\d+\b/.test(n)){
   const m=n.match(/\b(\d{1,5})\b/),q=m?Number(m[1]):0;
   if(!q||q>10000)r=reply(e,'ORDER','Số lượng không hợp lệ.');
   else if(!/a001|ao|thun/.test(n))r=reply(e,'ORDER','Cần tên hoặc SKU sản phẩm trong catalog QA.');
   else if(q>p.stock)r=reply(e,'ORDER','Không đủ tồn QA. Còn '+p.stock+' sản phẩm.',{orderCreated:false});
   else{
    pending.set(owner,{mid:e.mid,qty:q,expected:p.price*q});
    r=reply(e,'ORDER','Xác nhận '+q+' × '+p.name+' = '+vnd(p.price*q)+
     '? Nhắn "xác nhận" để lưu yêu cầu QA, hoặc "hủy xác nhận".',
     {awaitingConfirmation:true,orderCreated:false});
   }
  }else if(/bao nhieu|bao gia|gia|ton kho|con hang/.test(n)){
   const m=n.match(/\b(\d{1,5})\s*(cai|chiec|san pham)\b/);
   const qty=m?Number(m[1]):1;
   r=reply(e,'QUOTE',p.name+' '+p.sku+' có giá '+vnd(p.price)+
    ', tồn QA '+p.stock+'. Tổng '+qty+' = '+vnd(p.price*qty)+
    '. Chưa tạo đơn.',{unitPriceVnd:p.price,totalVnd:p.price*qty,orderCreated:false});
  }else if(/tu van|shop|san pham|goi y|ao/.test(n)){
   r=reply(e,'CONSULT','Cửa hàng '+p.store+' có '+p.name+' ('+p.sku+
    ') trong catalog QA. Hãy hỏi giá hoặc đặt thử.',{sku:p.sku});
  }else{
   r=reply(e,'CONSULT','Tôi là bot QA mô phỏng. Bạn có thể hỏi tư vấn, báo giá, đặt hàng hoặc tra cứu đơn.');
  }
  seen.set(ek,r);return r;
 }
 return Object.freeze({gateway,handle,inspect:()=>Object.freeze({
  mode:'OFFLINE_JS_FIXTURE',requests:requests.size,unsentOutbox:outbox.size,
  pending:pending.size,events:seen.size,hostedWrites:0,metaSends:0,
  realAiAgent:false,realMetaHmacVerified:false,realRlsVerified:false,
  canPublish:false
 })});
}
module.exports={createMessengerQaLab,PAGES};
