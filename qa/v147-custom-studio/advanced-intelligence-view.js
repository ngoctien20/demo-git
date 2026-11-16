'use strict';
/* ADV3: offline browser explanation. No provider/AI calls, no crypto key in client. */
(function(){
 const intel=window.T404PresentationIntelligence,policy=window.T404AdvancedPresentation,
  registry=window.T404ChannelRegistry,studioApi=window.T404Studio;
 if(!intel||!policy||!registry||!studioApi)throw Error('ADV3_PRESENTATION_VIEW_REQUIREMENTS');
 const studio=studioApi.createStudio(),$=id=>document.getElementById(id);
 const label={GREETING:'Chào hỏi',DISCOVER:'Tìm sản phẩm',QUOTE:'Báo giá',LOW_STOCK:'Tồn kho',
  POLICY:'Chính sách',ORDER_REQUEST:'Yêu cầu đặt hàng',ORDER_LOOKUP:'Tra mã đơn',
  SUPPORT:'Gặp nhân viên',ABSTAIN:'Chưa đủ thông tin'};
 function show(){
  try{
   const q=$('question').value;
   if(!q.trim()){$('heuristicDecision').textContent='Nhập một câu hỏi để xem quyết định thử nghiệm.';return}
   const proposal=intel.heuristic(q);
   const r=intel.proposeFromValidatedOutput({modelOutput:proposal,policy,registry,studio,studioApi,
    shop:$('shop').value,channel:$('channel').value});
   const denied=proposal.intent==='ABSTAIN';
   $('heuristicDecision').textContent='Bộ phân loại theo quy tắc (không phải AI): '+
    label[proposal.intent]+'. '+(denied?'Cần hỏi lại khách; không thực hiện hành động.':
    'Thành phần dự kiến: '+r.renderedComponent+'.');
   $('heuristicStatus').textContent=denied?'TỪ CHỐI ĐOÁN Ý ĐỊNH':'BẢN XEM TRƯỚC NO-SEND';
  }catch(e){
   $('heuristicDecision').textContent='Không thể phân loại: '+e.message;
   $('heuristicStatus').textContent='TỪ CHỐI';
  }
 }
 function validate(){
  try{
   const v=intel.validateModelOutput($('modelProposal').value);
   const result=intel.proposeFromValidatedOutput({modelOutput:v,policy,registry,studio,studioApi,
    shop:$('shop').value,channel:$('channel').value});
   $('proposalStatus').textContent='SCHEMA HỢP LỆ · '+label[v.intent]+
    '. Hiển thị '+(result.renderedComponent||'TEXT')+
    '. Không được dùng đề xuất này để gửi tin hoặc chạy action.';
  }catch(e){$('proposalStatus').textContent='BỊ CHẶN · '+e.message}
 }
 for(const id of ['question','shop','channel'])$(id).addEventListener(id==='question'?'input':'change',show);
 $('validateProposal').addEventListener('click',validate);
 show();validate();
})();