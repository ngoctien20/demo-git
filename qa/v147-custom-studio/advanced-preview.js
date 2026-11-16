'use strict';
/* Browser-only heuristic preview, NOT an LLM, no send or external I/O. */
(function(){
 const api=window.T404Studio,policy=window.T404AdvancedPresentation;
 if(!api||!policy)throw Error('ADVANCED_PREVIEW_DEPENDENCY_MISSING');
 const studio=api.createStudio(),$=x=>document.getElementById(x);
 const create=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=String(txt);if(cls)e.className=cls;return e;};
 const labels={GREETING:'Chào hỏi',DISCOVER:'Gợi ý sản phẩm',QUOTE:'Báo giá',LOW_STOCK:'Cảnh báo tồn kho',
  POLICY:'Chính sách',ORDER_REQUEST:'Yêu cầu đặt hàng',ORDER_LOOKUP:'Tra mã đơn',SUPPORT:'Nhân viên hỗ trợ'};
 function heuristic(input){
  const t=String(input||'').toLocaleLowerCase('vi-VN');
  if(/mã đơn|tra đơn|kiểm tra đơn|đơn hàng.*(đâu|trạng thái)/u.test(t))return 'ORDER_LOOKUP';
  if(/hết hàng|sắp hết|tồn kho|còn bao nhiêu/u.test(t))return 'LOW_STOCK';
  if(/đặt hàng|chốt đơn|muốn mua|lấy \d+/u.test(t))return 'ORDER_REQUEST';
  if(/chính sách|đổi trả|giao hàng|bảo hành/u.test(t))return 'POLICY';
  if(/gặp nhân viên|tư vấn viên|khiếu nại/u.test(t))return 'SUPPORT';
  if(/bao nhiêu tiền|báo giá|giá bao nhiêu|giá/u.test(t))return 'QUOTE';
  if(/sản phẩm|gợi ý|mẫu|có bán|xem hàng/u.test(t))return 'DISCOVER';
  return 'GREETING';
 }
 function styleText(container,text,spans){
   const sorted=spans.filter(s=>s.start>=0&&s.start+s.len<=text.length).sort((a,b)=>a.start-b.start);
   let last=0;
   for(const s of sorted){
     if(s.start<last)continue;
     container.append(document.createTextNode(text.slice(last,s.start)));
     const node=create(s.kind==='PRICE'?'strong':s.kind==='NOTE'?'em':'span',text.slice(s.start,s.start+s.len));
     node.className='style-'+s.kind.toLowerCase();
     container.append(node);last=s.start+s.len;
   }
   container.append(document.createTextNode(text.slice(last)));
 }
 function render(){
   const shop=$('shop').value,channel=$('channel').value,typed=$('question').value;
   const intent=$('manualIntent').value==='AUTO'?heuristic(typed):$('manualIntent').value;
   const x=policy.compile({api,studio,shop,channel,proposal:{intent}});
   $('intent').textContent=labels[intent]+' · '+( $('manualIntent').value==='AUTO'?'Bộ phân loại heuristic QA':'Chọn thủ công');
   $('shopName').textContent=api.FIXTURES[shop].name;
   $('channelName').textContent=channel;
   $('status').textContent='EXPERIMENTAL · KHÔNG GỬI · KHÔNG GHI ĐƠN';
   $('capability').textContent=x.render.type+' · '+x.capability.color;
   const screen=$('screen');screen.replaceChildren();
   const note=create('div','MÔ PHỎNG KHÔNG GỬI','note');
   screen.append(note);
   const bubble=create('div',undefined,'bubble');
   styleText(bubble,x.render.text,x.render.segments);
   screen.append(bubble);
   if(x.render.cards.length){
     const cards=create('div',undefined,'cards');
     for(const item of x.render.cards){
       const card=create('div',undefined,'product-card');
       card.append(create('div',item.emoji||'▢','product-icon'));
       card.append(create('strong',item.title,'product-title'));
       card.append(create('div',item.priceLabel||item.subtitle||'','product-price'));
       card.append(create('small','SKU: '+item.sku+' · ảnh QA bằng biểu tượng'));
       cards.append(card);
     }
     screen.append(cards);
   }
   if(x.render.image)screen.append(create('div',x.render.image.emoji+' · Ảnh minh họa QA. Chưa có URL ảnh xác minh.','photo'));
   if(x.render.buttons.length){
     const btns=create('div',undefined,'buttons');
     for(const a of x.render.buttons){const b=create('button',a.label+' · preview');b.type='button';b.disabled=true;btns.append(b);}
     screen.append(btns);
   }
   screen.append(create('p',x.warnings.join(' '),'warning'));
   $('json').textContent=JSON.stringify({contract:x.contract,source:x.source,shop:x.shop,
    channel:x.channel,intent,renderType:x.render.type,semantic:x.plan,
    canPublish:x.canPublish,providerSends:x.providerSends,orderWrites:x.orderWrites},null,2);
 }
 for(const id of ['shop','channel','manualIntent'])$(id).addEventListener('change',render);
 $('question').addEventListener('input',render);
 render();
})();
