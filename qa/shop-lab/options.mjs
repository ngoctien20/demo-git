export function draftRule(sentence) {
  const s=sentence.trim().toLocaleLowerCase('vi');
  if (!/(?:ba|3) áo/.test(s)||!s.includes('cùng mẫu')) return null;
  if (/^(?:đủ )?(?:ba|3) áo cùng mẫu[, ]+(?:thì tính sỉ[, ]+)?được trộn màu[.!]?$/.test(s)) return {mixed:true,sentence};
  if (/^(?:đủ )?(?:ba|3) áo cùng mẫu[, ]+(?:phải )?cùng màu(?: thì tính sỉ)?[.!]?$/.test(s)) return {mixed:false,sentence};
  return null;
}
export function wholesale(rule,items) {
  if (!rule) return 'Chưa có quy tắc đã duyệt.';
  if (items.some(x=>!x.sku || (!rule.mixed && !x.color))) return 'Bạn cho shop biết rõ mã mẫu và màu nhé.';
  const counts=new Map();
  for(const item of items) {
    const key=JSON.stringify([item.sku,rule.mixed?null:item.color]);
    counts.set(key,(counts.get(key)??0)+1);
  }
  return Math.max(0,...counts.values())>=3 ? 'Đủ điều kiện tính sỉ. Shop cần xác nhận giá sỉ.' : 'Chưa đủ điều kiện tính sỉ.';
}
export function alternatives(rows,original,priority,budget) {
  if (!['color','style'].includes(priority)) return [];
  return rows.filter(r=>r!==original && r.size===original.size && r.stock>0 && r.price<budget &&
    original[priority] && r[priority]===original[priority])
    .sort((a,b)=>a.price-b.price || a.sku.localeCompare(b.sku)).slice(0,2);
}

export function confirmAlternative(rows,original,priority,budget,selected) {
  if (!selected || !original || original.stock!==0) return null;
  const fresh=alternatives(rows,original,priority,budget).find(r=>
    r.sku===selected.sku && r.size===selected.size && r.color===selected.color);
  if (!fresh || fresh.price!==selected.price) return null;
  return {sku:fresh.sku,size:fresh.size,color:fresh.color,qty:1,total:fresh.price};
}
