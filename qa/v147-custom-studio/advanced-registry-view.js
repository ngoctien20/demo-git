'use strict';
/* V15.2 ADV2 — readonly, client-only capability registry inspector. */
(function(){
 const registry=window.T404ChannelRegistry,studioApi=window.T404Studio,
  policy=window.T404AdvancedPresentation;
 if(!registry||!studioApi||!policy)throw Error('CHANNEL_CAPABILITY_DEPENDENCY_MISSING');
 const studio=studioApi.createStudio(),$=s=>document.getElementById(s);
 const labels={
  TEXT:'Văn bản',RICH_TEXT:'Chữ đậm/nghiêng/màu',IMAGE:'Ảnh sản phẩm',
  PRODUCT_CARD:'Thẻ sản phẩm',CAROUSEL:'Danh sách thẻ trượt',
  QUICK_REPLY:'Trả lời nhanh',ACTION_BUTTON:'Nút hành động',
  PERSISTENT_MENU:'Menu cố định',PUBLIC_WEBVIEW:'Trang mở trong chat',
  OA_CTA:'Nút tương tác OA',OA_MENU:'Menu OA',
  ZBS_TEMPLATE:'ZBS mẫu có duyệt/chi phí',VERIFIED_LINK:'Liên kết đã xác minh'
 };
 const states={
  DOCUMENTED:'Có tài liệu · chưa chứng nhận tài khoản',
  ACCOUNT_GATED:'Cần xác minh quyền kênh',
  LOCAL_PREVIEW:'Chỉ dựng được trong Widget',
  UNVERIFIED:'Chưa xác minh hỗ trợ native',
  UNSUPPORTED:'Không hỗ trợ theo registry',
  APPROVAL_SPEND:'Cần duyệt mẫu và ngân sách'
 };
 function el(tag,txt){
  const node=document.createElement(tag);
  if(txt!==undefined)node.textContent=String(txt);
  return node;
 }
 function rerender(){
  const channel=$('channel').value,shop=$('shop').value;
  const fallback=JSON.parse($('json').textContent||'{}');
  const intent=policy.INTENTS.includes(fallback.intent)?fallback.intent:'GREETING';
  const view=registry.compose({studio,studioApi,policy,channel,shop,proposal:{intent}});
  $('capabilitySelected').textContent='Đề xuất: '+labels[view.preferredComponent]+
   ' · Hiển thị QA: '+labels[view.renderedComponent]+
   ' · '+(view.reason==='VERIFIED_MEDIA_MISSING'?'Thiếu ảnh được phê duyệt':states[view.capabilityDecision.state]);
  $('capabilitySummary').textContent='Kiểm tra '+registry.COMPONENTS.length+
   ' thành phần trên '+channel+'. Chưa xác minh quyền tài khoản; không thể gửi tin thật.';
  const tbody=$('capabilityRows');tbody.replaceChildren();
  for(const item of registry.list(channel)){
   const decision=registry.decision(channel,item.component);
   const row=el('tr');row.dataset.component=item.component;
   row.dataset.state=item.state;
   row.append(el('td',labels[item.component]||item.component));
   row.append(el('td',states[item.state]));
   row.append(el('td',decision.fallbackRequired?'Chuyển sang văn bản':'Bản xem trước'));
   const info=el('td');
   if(item.providerDoc){
    const a=el('a','Tài liệu');a.href=item.providerDoc;a.target='_blank';a.rel='noopener noreferrer';
    info.append(a);
   }else info.append(el('span','Nội bộ'));
   row.append(info);
   tbody.append(row);
  }
 }
 for(const id of ['shop','channel','manualIntent'])$(id).addEventListener('change',rerender);
 $('question').addEventListener('input',rerender);
 rerender();
})();