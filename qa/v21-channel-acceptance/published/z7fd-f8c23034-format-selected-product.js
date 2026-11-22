// Verbatim copy of n8n Z7FdV7uDvApfbURQ "Format selected product" Code node, PUBLISHED f8c23034 (= draft), read 2026-11-21.
// `$('Loop One Message').first(1, idx)` is simplified to `.first()` by the harness.
const current=$('Loop One Message').first(1,$('Loop One Message').context?.currentRunIndex).json;
const sku=current.selectedSku;
const rows=$input.all().map(item=>item.json).filter(row=>row.sku===sku);
let output='Shop chưa xác minh được thông tin mẫu '+sku+'.';
if(rows.length===1){
 const {name,price,stock}=rows[0];
 const valid=n=>typeof n==='number'?Number.isSafeInteger(n)&&n>=0:typeof n==='string'&&/^\d+$/.test(n)&&Number.isSafeInteger(Number(n));
 if(typeof name==='string'&&name.trim()&&valid(price)&&valid(stock)){
  output=sku+' — '+name.trim()+' | '+Number(price).toLocaleString('vi-VN')+'đ/cái. '+(Number(stock)===0?'Mẫu này đã hết hàng.':'Còn '+Number(stock)+' cái.');
 }
}
return [{json:{output}}];
