// TIEN404 V14.5 LIVE03 — OFFLINE ORDER REQUEST DRY-RUN ONLY.
// This node uses synthetic QA fixtures & temporary JS Map objects.
// Never invokes Google Sheets, DB, HTTP, Meta, AI Agent or credential.
// The request/order code generated below is NOT a saved order ID.
const requested=String($input.first()?.json?.scenario||'ALL').trim().toUpperCase();
const catalog={
 PAGE_QA_A:{tenant:'TENANT_QA_1',store:'SHOP_QA_A',sku:'A002',name:'Áo thun nam trắng basic size M',price:159000,stock:25},
 PAGE_QA_B:{tenant:'TENANT_QA_1',store:'SHOP_QA_B',sku:'A002',name:'Áo thun nam trắng basic size M',price:209000,stock:8}
};
function env(page='PAGE_QA_A'){
 const products=catalog, orders=new Map(),outbox=new Map(),pending=new Map();
 const getShop=()=>products[page];
 const quote=qty=>({sku:getShop().sku,unitPriceVnd:getShop().price,totalVnd:getShop().price*qty,source:'SYNTHETIC_ONLY'});
 const prepare=(sender,qty,expectedTotal,tenant=getShop().tenant)=>{
  const s=getShop(),k=page+'|'+sender;
  if(tenant!==s.tenant)return {ok:false,error:'CROSS_STORE_DENIED'};
  if(!Number.isInteger(qty)||qty<1||qty>10000)return {ok:false,error:'INVALID_QTY'};
  if(qty>s.stock)return {ok:false,error:'INSUFFICIENT_STOCK'};
  if(!Number.isSafeInteger(expectedTotal)||expectedTotal!==qty*s.price)return {ok:false,error:'EXPECTED_TOTAL_MISMATCH'};
  pending.set(k,{qty,total:expectedTotal,requestKey:'QA-KEY-001'});
  return {ok:true,state:'AWAITING_EXPLICIT_CONFIRMATION',noOrderYet:orders.size===0};
 };
 const confirm=(sender,key)=>{
  const s=getShop(),k=page+'|'+sender;
  const x=pending.get(k);
  if(!x)return {ok:false,error:'NO_PENDING_CONFIRMATION'};
  if(key!==x.requestKey)return {ok:false,error:'REQUEST_KEY_MISMATCH'};
  if(x.qty>s.stock||x.total!==x.qty*s.price)return {ok:false,error:'STALE_QUOTE'};
  const id=page+'|'+sender+'|'+key;
  if(!orders.has(id)){
   orders.set(id,{orderCode:'QA-DRYRUN-0001',status:'SIMULATED_NOT_SAVED',sku:s.sku,qty:x.qty,total:x.total});
   outbox.set(id,{event:'QA_ONLY_NO_SEND'});
  }
  return {ok:true,code:'QA-DRYRUN-0001',state:'SIMULATED_NOT_SAVED',replayed:orders.size===1};
 };
 const cancel=sender=>{pending.delete(page+'|'+sender);return {ok:true,state:'CANCELLED_BEFORE_ORDER'}};
 return {quote,prepare,confirm,cancel,summary:()=>({ordersInMemory:orders.size,unsentOutboxEvents:outbox.size,pendingCount:pending.size,onHand:safeStock(),reserved:0})};
 function safeStock(){return getShop().stock;}
}
const scenarios={
 QUOTE_ONLY(){const e=env(),q=e.quote(2),z=e.summary();return {pass:q.totalVnd===318000&&z.ordersInMemory===0&&z.unsentOutboxEvents===0,detail:'Báo giá QA 2 × 159.000đ = 318.000đ; chưa tạo đơn',...z};},
 PREPARE(){const e=env(),r=e.prepare('QA_BUYER',2,318000),z=e.summary();return {pass:r.ok&&r.noOrderYet&&z.pendingCount===1&&z.ordersInMemory===0,detail:'Thu thập và xác nhận tổng tiền; đang chờ khách đồng ý',...z};},
 CONFIRM_MOCK(){const e=env();e.prepare('QA_BUYER',2,318000);const r=e.confirm('QA_BUYER','QA-KEY-001'),z=e.summary();return {pass:r.ok&&z.ordersInMemory===1&&z.unsentOutboxEvents===1&&z.onHand===25&&z.reserved===0,detail:'Tạo mã QA-DRYRUN-0001 TRONG BỘ NHỚ, không lưu đơn thật; outbox không gửi',mockOrderCode:r.code,...z};},
 REPLAY(){const e=env();e.prepare('QA_BUYER',2,318000);e.confirm('QA_BUYER','QA-KEY-001');e.confirm('QA_BUYER','QA-KEY-001');const z=e.summary();return {pass:z.ordersInMemory===1&&z.unsentOutboxEvents===1,detail:'Xác nhận lặp lại không nhân đôi đơn hoặc thông báo giả lập',...z};},
 WRONG_TOTAL(){const e=env();const r=e.prepare('QA_BUYER',2,1000),z=e.summary();return {pass:!r.ok&&r.error==='EXPECTED_TOTAL_MISMATCH'&&z.ordersInMemory===0,detail:'Từ chối tổng giá sai 1.000đ so với 318.000đ',...z};},
 NO_STOCK(){const e=env();const r=e.prepare('QA_BUYER',26,26*159000),z=e.summary();return {pass:!r.ok&&r.error==='INSUFFICIENT_STOCK'&&z.ordersInMemory===0,detail:'26 sản phẩm vượt tồn QA 25; không tạo đơn',...z};},
 CROSS_STORE(){const e=env('PAGE_QA_B');const r=e.prepare('QA_BUYER',1,159000),z=e.summary();return {pass:!r.ok&&r.error==='EXPECTED_TOTAL_MISMATCH'&&z.ordersInMemory===0,detail:'Cùng SKU A002 nhưng Shop B giá 209.000đ, không nhận giá Shop A',...z};},
 CANCEL(){const e=env();e.prepare('QA_BUYER',2,318000);e.cancel('QA_BUYER');const r=e.confirm('QA_BUYER','QA-KEY-001'),z=e.summary();return {pass:!r.ok&&r.error==='NO_PENDING_CONFIRMATION'&&z.ordersInMemory===0,detail:'Khách hủy trước xác nhận: không có yêu cầu đơn',...z};}
};
const selected=requested==='ALL'?Object.keys(scenarios):[requested];
return selected.map(name=>{
 let o;
 try{o=scenarios[name]?scenarios[name]():{pass:false,detail:'Scenario không có. Dùng ALL hoặc QUOTE_ONLY, PREPARE, CONFIRM_MOCK, REPLAY, WRONG_TOTAL, NO_STOCK, CROSS_STORE, CANCEL'};
 }catch(_){o={pass:false,detail:'Lỗi mô phỏng QA, không có tác động bên ngoài'};}
 return {json:{project:'TIEN404 AI',version:'V14.5-LIVE03',testType:'OFFLINE_DRY_RUN',
 scenario:name,status:o.pass?'PASS':'FAIL',detail:o.detail,qaOrderCode:o.mockOrderCode||null,
 memoryOrders:o.ordersInMemory??0,pendingConfirmations:o.pendingCount??0,
 unsentOutbox:o.unsentOutboxEvents??0,physicalStock:o.onHand??25,reserved:o.reserved??0,
 googleSheetsWrites:0,hostedWrites:0,providerSends:0,
 isRealMessengerTest:false,isRealOrder:false,hasRealCustomerPII:false,
 note:'Mã QA-DRYRUN không phải mã đơn đã lưu. Không nhắn tạo đơn vào bot Published trong LIVE03.'}};
});