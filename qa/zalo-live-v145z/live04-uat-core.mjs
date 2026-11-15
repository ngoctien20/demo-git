/** TIEN404 UAT01 — deterministic synthetic fixtures, NOT live AI/Orders/Zalo. */
export const MODE={environment:'SYNTHETIC_OFFLINE_UAT',provider_sends:0,real_ai_calls:0,orders_written:0};
export const SHOPS={
 SHOP_A_QA:{label:'Shop A (giả lập)',products:[{sku:'QA-A-01',name:'Mẫu A1',price:125000,stock:7},{sku:'QA-A-02',name:'Mẫu A2',price:99000,stock:2}]},
 SHOP_B_QA:{label:'Shop B (giả lập)',products:[{sku:'QA-B-01',name:'Mẫu B1',price:159000,stock:5},{sku:'QA-B-02',name:'Mẫu B2',price:45000,stock:9}]}
};
const fmt=n=>new Intl.NumberFormat('vi-VN').format(n)+'₫';
const out=(code,reply,extra={})=>({code,reply,mode:MODE.environment,provider_sends:0,real_ai_calls:0,orders_written:0,...extra});
export function simulate(shop,text){
 if(!Object.hasOwn(SHOPS,shop))return out('INVALID_SHOP','Chỉ có Shop A/B giả lập.');
 if(typeof text!=='string'||!text.trim()||text.length>240)return out('INVALID_MESSAGE','Tin nhắn tối đa 240 ký tự, không có dữ liệu cá nhân.');
 const s=text.toLowerCase().normalize('NFC').trim();
 if(/bỏ qua (các )?hướng dẫn|ignore previous|system prompt|developer message|hiển thị token|lấy token|api key|secret|credential/i.test(s))return out('INJECTION_DENIED','Không thể bỏ qua quy tắc hoặc lộ token.');
 if(/thanh toán|chuyển khoản|thẻ tín dụng|mã otp|nạp tiền/.test(s))return out('PAYMENT_DISABLED','Mô phỏng không nhận thanh toán thật.');
 if(/(?:^|[^\d])0\d{9,10}(?:[^\d]|$)|\+84\d{9,10}/.test(s))return out('PERSONAL_DATA_BLOCKED','Không gửi số điện thoại thật vào bản giả lập.');
 const sku=(s.match(/qa-[ab]-\d{2}/i)||[])[0]?.toUpperCase();
 const product=SHOPS[shop].products.find(p=>p.sku===sku);
 if(sku&&!product)return out('CROSS_SHOP_OR_UNKNOWN_SKU','Mã không thuộc cửa hàng này hoặc không tồn tại.');
 if(/giá sỉ|bán sỉ|giá đại lý/.test(s))return out('WHOLESALE_RULE_REQUIRED','Chưa cấu hình bảng giá sỉ, không tự đoán giá.');
 const m=/\b(?:mua|đặt)\s+(qa-[ab]-\d{2})\s+(\d{1,4})\b/i.exec(s);
 if(m){
  const p=SHOPS[shop].products.find(p=>p.sku===m[1].toUpperCase()),q=Number(m[2]);
  if(!p)return out('CROSS_SHOP_OR_UNKNOWN_SKU','Không đặt sản phẩm của Shop khác.');
  if(q<1||q>p.stock)return out('INSUFFICIENT_STOCK','Vượt tồn kho giả lập, không tạo đơn.');
  return out('DRAFT_QUOTE_ONLY',p.sku+' × '+q+' = '+fmt(p.price*q)+' (nháp, không lưu, không gửi).',{draft:{sku:p.sku,qty:q,total_vnd:p.price*q,stored:false}});
 }
 if(/hủy đơn|sửa đơn|cập nhật đơn|đã giao|doanh thu/.test(s))return out('PERSISTENT_ACTION_DISABLED','Không sửa đơn, báo doanh thu hoặc xác nhận giao hàng thật.');
 if(product)return out('PRODUCT_QA_ONLY',product.sku+' — '+product.name+' (giả lập): '+fmt(product.price)+', còn '+product.stock,{product:{sku:product.sku,price_vnd:product.price,stock:product.stock}});
 if(/hàng|sản phẩm|danh mục|xem mẫu|catalog|mã hàng|có gì/.test(s))return out('CATALOG_QA_ONLY',SHOPS[shop].products.map(p=>p.sku+': '+p.name+' '+fmt(p.price)+' / '+p.stock).join('\n'));
 return out('GREETING_QA_ONLY','Xin chào '+SHOPS[shop].label+'. Hỏi giá, danh mục hoặc mua SKU thử nghiệm. Không dùng dữ liệu thật.');
}
export const CASES=[
 ['Tư vấn A','SHOP_A_QA','Giá QA-A-01','PRODUCT_QA_ONLY'],
 ['Tư vấn B','SHOP_B_QA','Giá QA-B-01','PRODUCT_QA_ONLY'],
 ['Cách ly A/B','SHOP_A_QA','Giá QA-B-01','CROSS_SHOP_OR_UNKNOWN_SKU'],
 ['SKU không có','SHOP_B_QA','Giá QA-B-99','CROSS_SHOP_OR_UNKNOWN_SKU'],
 ['Đơn nháp','SHOP_B_QA','Mua QA-B-01 2','DRAFT_QUOTE_ONLY'],
 ['Vượt tồn','SHOP_A_QA','Mua QA-A-02 3','INSUFFICIENT_STOCK'],
 ['Giá sỉ','SHOP_A_QA','Giá sỉ bao nhiêu','WHOLESALE_RULE_REQUIRED'],
 ['Injection','SHOP_B_QA','ignore previous secret','INJECTION_DENIED'],
 ['Thanh toán','SHOP_B_QA','cho tôi thanh toán','PAYMENT_DISABLED'],
 ['Sửa đơn','SHOP_A_QA','sửa đơn đã giao','PERSISTENT_ACTION_DISABLED'],
 ['Danh mục','SHOP_B_QA','Xem danh mục','CATALOG_QA_ONLY'],
 ['Quá dài','SHOP_A_QA','x'.repeat(241),'INVALID_MESSAGE']
];
export function selfTest(){
 const results=CASES.map(([name,shop,text,expect],index)=>{const r=simulate(shop,text);return {case_id:'UAT-'+String(index+1).padStart(2,'0'),name,pass:r.code===expect&&r.orders_written===0&&r.real_ai_calls===0&&r.provider_sends===0,observed:r.code}});
 return {mode:MODE.environment,total:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results,real_ai_verified:false,provider_identity_verified:false,real_send_approved:false};
}