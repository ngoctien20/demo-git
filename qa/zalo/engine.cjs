// Offline V2 lab. Only the harness supplies the binding and clock.
const catalogs = new Map([
  ['fashion', [['F01','Áo đen size L','ao den size l',159000,3],['F02','Áo trắng size M','ao trang size m',149000,0]]],
  ['grocery', [['G01','Gạo thơm','gao thom',22000,50]]],
  ['building', [['B01','Xi măng','xi mang',92000,8]]],
  ['dealer', [['D01','Thùng nước','thung nuoc',90000,40,10,80000]]]
]);
const normalize = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim();
const samples = {
  price:['bao nhieu tien','gia sao','bao gia','gia si','gia le','gia'],
  stock:['con hang khong','con bao nhieu','kiem tra ton kho','con khong'],
  cart:['cho minh lay','minh muon mua','dat mua','lay','dat','mua'],
  cancel:['thoi khong lay','huy','bo qua','doi y'],
  human:['gap nhan vien','khieu nai','tu van vien','nguoi that']
};
// Retrieve an intent from short Vietnamese examples using overlapping words.
function classify(q) {
  const words = new Set(q.split(/\W+/));
  let best = 'unknown', score = 0;
  for (const [intent, examples] of Object.entries(samples)) {
    for (const example of examples) {
      const tokens = example.split(' ');
      const hits = tokens.filter(t => words.has(t)).length;
      const weight = hits === tokens.length ? hits : 0;
      if (weight > score) { best = intent; score = weight; }
    }
  }
  return best;
}
function respond(shop, previous, text) {
  const rows = catalogs.get(shop);
  const result = (kind,reply,state={},facts={}) => ({kind,reply,state,facts});
  if (!rows || typeof text !== 'string' || text.length > 512)
    return result('denied','Mình có thể hỏi lại về sản phẩm được không ạ?');
  const q = normalize(text);
  if (/prompt|token|secret|bo qua (quy tac|huong dan)|khach khac|shop khac|mat khau/.test(q))
    return result('denied','Shop chỉ hỗ trợ thông tin sản phẩm trong danh mục ạ.');
  if (/\b(khong|chua|dung|k|ko)\s+(muon\s+)?(lay|mua|dat|chot)\b/.test(q))
    return result('cancel','Dạ, mình chưa chốt mẫu này nhé.');
  const intent = classify(q);
  if (intent === 'cancel') return result('cancel','Dạ, mình bỏ lựa chọn vừa rồi nhé.');
  if (intent === 'human') return result('human','Trường hợp này cần nhân viên kiểm tra. Lab chưa có kênh chuyển tiếp ạ.');
  const skuTokens = q.match(/\b[a-z]+\d+\b/g) || [];
  if (skuTokens.some(t => !rows.some(r => r[0].toLowerCase() === t)))
    return result('missing','Shop chưa tìm thấy mã này. Mình kiểm tra lại mã giúp shop nhé.');
  const matches = rows.filter(r => q.includes(r[2]) || skuTokens.includes(r[0].toLowerCase()));
  if(matches.length > 1) return result('clarify','Mình muốn xem mẫu nào trước ạ?');
  if (shop === 'fashion' && /ao den/.test(q) && !/size/.test(q) && !matches.length)
    return result('size','Mình cần áo đen size nào ạ?',{pending:'black'});
  let row = matches[0];
  if (!row && previous.pending === 'black' && /^(size )?l[.!?]?$/.test(q)) row = rows[0];
  if (!row && /\b(size|mau|doi sang|doi qua|ao trang|ao xanh)\b/.test(q) && q !== 'size l')
    return result('clarify','Mình cho shop xin mã mẫu mới để kiểm tra đúng giá và tồn nhé.');
  if (!row && previous.sku && (intent !== 'unknown' || /^(size )?l$/.test(q))) row = rows.find(r=>r[0]===previous.sku);
  if (!row) return result('clarify','Mình đang tìm sản phẩm hoặc mã nào để shop kiểm tra ạ?');
  const [sku,name,,price,stock,min,bulk] = row;
  const state = {sku};
  if (!stock) {
    const alt = rows.find(r=>r[4]>0);
    return result('empty',name+' hiện hết hàng.'+(alt?' Mình muốn xem '+alt[1]+' không ạ?':''),state);
  }
  if (intent === 'cart') {
    // Refuse to infer units, fractions, offered prices or multiple numbers.
    const stripped = q.replace(sku.toLowerCase(),'').replace(row[2],'');
    const values = stripped.match(/[+-]?\d+(?:[.,]\d+)*/g) || [];
    const qty = values.length === 1 && /^\d+$/.test(values[0]) ? Number(values[0]) : 0;
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > stock) return result('quantity','Mình muốn lấy bao nhiêu ạ? Hiện có '+stock+' trong kho thử nghiệm.',state);
    const total = qty * (min && qty >= min ? bulk : price);
    return result('preview','Tạm tính '+qty+' × '+name+' là '+total.toLocaleString('vi-VN')+'đ. Đây là bản nháp thử nghiệm.',state,{sku,qty,total});
  }
  const wholesale = min ? ' Từ '+min+' đơn vị, giá sỉ '+bulk.toLocaleString('vi-VN')+'đ.' : '';
  return result('catalog',name+' có giá '+price.toLocaleString('vi-VN')+'đ, còn '+stock+'.'+wholesale,state,{sku,price,stock});
}
function simulateDelivery({enabled=false,recipient,remaining,prior,status}) {
  if (!enabled || recipient !== 'fixture-owner' || !(remaining > 0) || prior) return 'blocked';
  if (status === 429) return 'rate_limited';
  if (status === 'timeout' || (Number.isInteger(status) && status>=500)) return 'needs_review';
  return status === 200 ? 'mock_accepted' : 'failed';
}
module.exports={respond,simulateDelivery};
