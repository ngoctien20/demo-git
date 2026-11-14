/* TIEN404 V12.2 — LOCAL QA PRACTICE ONLY.
 * Synthetic catalog, deterministic calculation, no AI inference or external API.
 * Never interpret these prices as those of a real tenant or use results to place an order.
 */
export const DEMO_CATALOG=Object.freeze([
 Object.freeze({sku:'QA-DEMO-01',name:'Áo thun trắng M (mẫu)',unitPrice:159000,stock:25}),
 Object.freeze({sku:'QA-DEMO-02',name:'Áo thun đen L (mẫu)',unitPrice:159000,stock:18}),
 Object.freeze({sku:'QA-DEMO-03',name:'Túi vải (mẫu)',unitPrice:79000,stock:4})
]);
export const formatVnd=value=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(value)+'đ';
export function parseVnd(value){
 const text=String(value??'').trim();
 if(!/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:[.,]\d{3})+)$/.test(text))return null;
 const n=Number(text.replace(/[.,]/g,''));
 return Number.isSafeInteger(n)?n:null;
}
export function calculateDemo(input){
 const sku=String(input?.sku??'').trim().toUpperCase();
 const item=DEMO_CATALOG.find(p=>p.sku===sku);
 if(!item)return {code:'not_found',message:'Không có SKU này trong catalog mẫu. Không được tự đoán giá.'};
 const rawQty=String(input?.quantity??'').trim();
 if(!/^[1-9]\d{0,5}$/.test(rawQty))return {code:'invalid_quantity',message:'Số lượng phải là số nguyên dương, không có số lẻ, số âm hoặc ký hiệu khác.'};
 const quantity=Number(rawQty);
 if(quantity>item.stock)return {code:'out_of_stock',message:'Mẫu này chỉ còn '+item.stock+' sản phẩm; không được xác nhận vượt tồn.',stock:item.stock};
 const offered=String(input?.offeredPrice??'').trim();
 if(offered){
  const amount=parseVnd(offered);
  if(amount===null)return {code:'invalid_price',message:'Giá đề xuất không hợp lệ. Chỉ nhận tiền VND nguyên, ví dụ 159000 hoặc 159.000.'};
  if(amount!==item.unitPrice)return {code:'price_mismatch',message:'Giá khách đưa khác giá cố định của dữ liệu mẫu ('+formatVnd(item.unitPrice)+'); không tự ý chấp nhận.',unitPrice:item.unitPrice};
 }
 const total=quantity*item.unitPrice;
 return {code:'ok',message:'Báo giá mô phỏng hợp lệ: '+quantity+' × '+formatVnd(item.unitPrice)+' = '+formatVnd(total)+'. KHÔNG tạo đơn hay trừ tồn.',total,unitPrice:item.unitPrice,stock:item.stock};
}
