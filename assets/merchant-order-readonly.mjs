// TIEN404 V13.5 — Customer-facing order summary using EXISTING Supabase RLS.
// Browser guards are defense in depth, NOT permission grants. No writes / PII / payment claims.
export const ORDER_COLUMNS='id,tenant_id,status,total_vnd,created_at';
export const ORDER_LIMIT=30;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES=Object.freeze({
 pending:'Chờ xử lý',confirmed:'Đã xác nhận',paid:'Trạng thái đơn: đã thanh toán',
 cancelled:'Đã hủy',refunded:'Đã hoàn tiền',fulfilled:'Đã giao',requested:'Yêu cầu mới'
});
const fail=(code)=>{const e=new Error(code);e.code=code;throw e;};
export const canReadShopOrders=role=>role==='owner'||role==='manager';
function checkedMoney(v){
 if(typeof v==='number'&&(!Number.isSafeInteger(v)||v<0))fail('AMOUNT_UNVERIFIED');
 if(typeof v!=='number'&&!(typeof v==='string'&&/^\d{1,18}$/.test(v)))fail('AMOUNT_UNVERIFIED');
 const amount=BigInt(v);
 if(amount<0n)fail('AMOUNT_UNVERIFIED');
 return new Intl.NumberFormat('vi-VN').format(amount)+' đ';
}
export function sanitizedOrder(row,tenantId){
 if(!row||!UUID.test(row.id||'')||row.tenant_id!==tenantId||!UUID.test(row.tenant_id||''))
   fail('TENANT_ORDER_SCOPE_DENIED');
 if(typeof row.status!=='string')fail('ORDER_STATUS_INVALID');
 const stamp=Date.parse(row.created_at);
 if(!Number.isFinite(stamp))fail('ORDER_DATE_INVALID');
 return Object.freeze({
  id:row.id,
  statusLabel:STATUSES[row.status]||'Trạng thái khác — cần hỗ trợ xác minh',
  totalLabel:checkedMoney(row.total_vnd),
  createdLabel:new Date(stamp).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),
  // Order status PAID is NOT a verified payment transaction or proof of collected revenue.
  paymentVerified:false
 });
}
export async function loadShopOrders({client,tenantId,role}={}){
 if(!canReadShopOrders(role))fail('ROLE_DENIED');
 if(!UUID.test(tenantId||'')||!client||typeof client.from!=='function')fail('SCOPE_UNVERIFIED');
 const response=await client.from('orders').select(ORDER_COLUMNS)
   .eq('tenant_id',tenantId)
   .order('created_at',{ascending:false})
   .limit(ORDER_LIMIT);
 if(response?.error)fail('DATA_UNAVAILABLE');
 if(!Array.isArray(response?.data)||response.data.length>ORDER_LIMIT)fail('DATA_UNAVAILABLE');
 // Strict fail-closed readback: one crossed row suppresses the complete batch.
 return Object.freeze(response.data.map(row=>sanitizedOrder(row,tenantId)));
}
