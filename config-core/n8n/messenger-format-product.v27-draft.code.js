const current=$('Loop One Message').first(1,$('Loop One Message').context.currentRunIndex).json;
const sku=current.selectedSku;
const rows=$input.all().map(item=>item.json).filter(row=>row.sku===sku);
let detailImage=null;
let output='Shop chưa xác minh được thông tin mẫu '+sku+', mình chờ shop kiểm tra lại nhé.';
if(rows.length===0){
 output='Dạ shop chưa tìm thấy mẫu '+sku+' ạ. Mình muốn shop gợi ý mẫu tương tự không?';
} else if(rows.length===1){
 const {name,price,stock,image_url}=rows[0];
 // V27.6: verified product photo (https + allowlist) shown above the detail text.
 if(typeof image_url==='string'&&image_url.length<=1000&&/^https:\/\/(lh3\.googleusercontent\.com|i\.imgur\.com|ngoctien20\.github\.io)\/[^\s"'<>]+$/.test(image_url.trim()))detailImage=image_url.trim();
 const valid=n=>typeof n==='number'?Number.isSafeInteger(n)&&n>=0:typeof n==='string'&&/^\d+$/.test(n)&&Number.isSafeInteger(Number(n));
 if(typeof name==='string'&&name.trim()&&valid(price)&&valid(stock)){
  output=sku+' — '+name.trim()+' | '+Number(price).toLocaleString('vi-VN')+'đ/cái. '+(Number(stock)===0?'Mẫu này đã hết hàng.':'Còn '+Number(stock)+' cái.');
 }
}
return [{json:{output,detailImage:output.startsWith(sku+' — ')?detailImage:null}}];
