const fold = text => text.normalize('NFD').replace(/\p{M}/gu,'').replaceAll('đ','d');

export function parseInquiry(text) {
  const words=fold(text).replace(/[?!]+$/,'').trim();
  const variant=/^ma (.+?) mau (.+?) size (.+?) (?:gia bao nhieu|con khong)$/.exec(words);
  if (variant) return {kind:'variant',sku:variant[1],color:variant[2],size:variant[3]};
  const available=/^ma (.+?) con size nao$/.exec(words);
  if (available) return {kind:'sizes',sku:available[1]};
  const budget=/^(?:shop oi )?ao duoi (\d{1,7})k(?: con (?:k|khong))?$/.exec(words);
  if (budget) return {kind:'budget',limit:Number(budget[1])*1000};
  const compare=/^so (?:sanh )?mau (.+?) (?:va|voi) (.+)$/.exec(words);
  if (compare) return {kind:'colors',colors:compare.slice(1)};
  const price=/^mau (.+?) (?:gia )?bao nhieu$/.exec(words);
  if (price) return {kind:'colors',colors:[price[1]]};
  const stock=/^mau ([a-z0-9-]+) con (?:khong|k)$/.exec(words);
  if (stock) return {kind:'sku',sku:stock[1].toUpperCase()};
  const qty=/^lay ([1-9]\d{0,5}) (?:cai|chiec) thi sao$/.exec(words);
  if (qty) return {kind:'quote',qty:Number(qty[1])};
  if (/^(?:minh|toi) chi hoi thoi$/.test(words)) return {kind:'browse'};
  if (/^(?:cho minh mon do|minh chua chon mau)$/.test(words)) return {kind:'clarify'};
}

export function answerInquiry(query,rows,previous) {
  const ask={status:'ask_variant',text:'Bạn muốn xem mã mẫu, màu và size nào?'};
  if (query.kind==='clarify') return ask;
  if (query.kind==='browse') return {status:'browsing',text:'Bạn cứ tham khảo nhé.'};
  if (query.kind==='quote') {
    const [sku,color,size]=previous ?? [];
    const row=rows.find(r=>r.sku===sku && r.color===color && r.size===size);
    if (!row) return ask;
    if (row.stock<query.qty) return {status:'reconfirm_stock',text:'Mẫu này hiện còn '+row.stock+' cái.'};
    const total=row.price*query.qty;
    if (!Number.isSafeInteger(total)) return {status:'reconfirm_price'};
    return {status:'estimate',total,text:query.qty+' cái có tổng giá '+total.toLocaleString('vi-VN')+'đ.',rows:[row]};
  }
  let matches;
  if (query.kind==='variant') matches=rows.filter(r=>fold(r.sku.toLowerCase())===query.sku &&
    fold(r.color.toLowerCase())===query.color && fold(r.size.toLowerCase())===query.size);
  if (query.kind==='sizes') matches=rows.filter(r=>fold(r.sku.toLowerCase())===query.sku && r.stock>0);
  if (query.kind==='budget') matches=rows.filter(r=>r.price<query.limit && r.stock>0);
  if (query.kind==='sku') matches=rows.filter(r=>r.sku===query.sku);
  if (query.kind==='colors') matches=rows.filter(r=>query.colors.includes(fold(r.color.toLowerCase())));
  if (!matches?.length) return {status:'no_match',text:'Shop chưa tìm thấy mẫu phù hợp trong danh mục.'};
  const text=matches.map(r=>r.sku+(r.color?' · '+r.color:'')+(r.size?' · size '+r.size:'')+' · '+r.price.toLocaleString('vi-VN')+'đ · còn '+r.stock+' cái').join('\n');
  return {status:'catalog_answer',rows:matches,text};
}
