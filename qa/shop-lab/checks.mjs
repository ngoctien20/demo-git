import {parseInquiry,answerInquiry} from '../messenger-shop/catalog-inquiry.mjs';
const cash=n=>n.toLocaleString('vi-VN')+'đ';
export function audit(row,rows,index) {
  const variant=r=>r.size && r.color ? 'Mã '+r.sku+' màu '+r.color+' size '+r.size+' giá bao nhiêu?' : 'Mẫu '+r.sku+' còn không?';
  const sold=rows.find(r=>r.sku===row.sku && r.stock===0 && r.size && r.color);
  const sizes=[...new Set(rows.filter(r=>r.sku===row.sku && r.stock>0).map(r=>r.size))];
  function check(question,source,test,context) {
    const intent=parseInquiry(question.toLowerCase());
    const reply=intent ? answerInquiry(intent,rows,context) : {status:'unknown',text:'Chưa hiểu câu hỏi.'};
    return {question,source,reply:reply.text??reply.status,grade:test(reply)?'Đạt':'Cần sửa'};
  }
  const absent=(question,source)=>({question,source,reply:'Chưa có dữ liệu để thử',grade:'Chưa thử'});
  const ref=r=>[r.sku,r.color,r.size,cash(r.price),'tồn '+r.stock].filter(Boolean).join(' · ');
  const unit=()=>check(variant(row),ref(row),r=>r.text?.includes(cash(row.price))&&r.rows?.length===1);
  const cases=[unit,()=>check('Lấy 2 cái thì sao?',ref(row),r=>row.stock<2 ? r.status==='reconfirm_stock' :
    r.total===2*row.price && r.text.includes(cash(2*row.price)),[row.sku,row.color,row.size]),
    ()=>row.size ? check('Mã '+row.sku+' còn size nào?',row.sku+' · '+sizes.join(', '),r=>
      sizes.length ? r.rows?.every(x=>x.stock>0)&&sizes.every(s=>r.rows?.some(x=>x.size===s)) : r.status==='no_match') : absent('Size nào còn hàng?',row.sku+' · chưa khai size'),
    ()=>sold ? check(variant(sold),ref(sold),r=>r.rows?.length===1 && r.text.includes('còn 0 cái')) : absent('Biến thể hết hàng?',row.sku+' · chưa có biến thể hết hàng'),
    ()=>check('Mình chưa chọn màu',row.sku+' · thiếu lựa chọn của khách',r=>r.status==='ask_variant'&&r.text.includes('mã mẫu'))];
  return (index===undefined?cases:[cases[index]]).map(run=>run());
}
