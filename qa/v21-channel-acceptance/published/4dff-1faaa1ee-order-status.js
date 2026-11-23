// Verbatim copy of n8n 4DFFCk60exrzaIl6 "Verify Owner and Return Status" Code node, PUBLISHED 1faaa1ee (= draft), read 2026-11-21.
const input=$('Order Status Input').first().json;
const id=String(input.order_id??'').trim();
const norm=(v)=>{let s=String(v??'').replace(/\D/g,'');if(s.startsWith('84')&&s.length===11)s='0'+s.slice(2);if(s.length===9)s='0'+s;return s;};
const phone=norm(input.phone);
const reject=(reason)=>[{json:{success:false,status:'rejected',reason,message:'Không tìm thấy đơn khớp với mã đơn và số điện thoại đã cung cấp. Hãy kiểm tra lại hoặc liên hệ nhân viên.'}}];
if(!id||!/^0\d{9}$/.test(phone))return reject('invalid_or_missing_credentials');
const rows=$input.all().map(x=>x.json).filter(r=>r&&String(r.order_id??'').trim()===id);
if(rows.length!==1||norm(rows[0].phone)!==phone)return reject('order_not_matched');
const r=rows[0];const allowed=['pending','paid','processing','confirmed','shipping','shipped','delivered','completed','cancelled','canceled','refunded','failed'];
const state=String(r.status??'').trim().toLowerCase();
if(!allowed.includes(state))return [{json:{success:false,status:'unverified',reason:'unknown_status',message:'Shop chưa xác minh được trạng thái đơn. Vui lòng liên hệ nhân viên.'}}];
return [{json:{success:true,status:'found',order:{order_id:String(r.order_id),status:state,sku:String(r.sku??''),quantity:r.quantity,total:r.total,created_at:r.created_at??'',stock_state:r.stock_state??''},message:'Đã xác minh bằng mã đơn và số điện thoại.'}}];
