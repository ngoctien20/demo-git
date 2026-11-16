'use strict';
/* ADV.5: Merchant-driven local UAT form; NO provider, model, network, persistence. */
(function(){
 const api=window.T404MerchantUAT;
 if(!api||!window.T404Adv4Inspector)throw Error('ADV5_UAT_DEPENDENCY_MISSING');
 const $=id=>document.getElementById(id);
 const form=api.createSession();
 const statuses={NOT_RUN:'Chưa kiểm tra',PASS:'Đạt theo nhận xét',FAIL:'Chưa đạt',NOT_APPLICABLE:'Không áp dụng'};
 function el(tag,label){const e=document.createElement(tag);if(label!==undefined)e.textContent=String(label);return e}
 function refresh(){
  const s=form.inspect();
  $('uatSummary').textContent='Đã tự đánh giá: '+(s.cases-s.counts.NOT_RUN)+'/'+s.cases+
   ' · Đạt: '+s.counts.PASS+' · Chưa đạt: '+s.counts.FAIL+
   ' · Chưa kiểm tra: '+s.counts.NOT_RUN+' · Đang chờ chủ shop và đánh giá độc lập.';
  $('uatReviewGate').textContent='Trạng thái: CHƯA NGHIỆM THU. Kết quả đánh dấu chỉ là tự đánh giá, không xác minh Owner, không cấp quyền triển khai.';
 }
 const cells=[];
 for(const item of api.CASES){
  const tr=el('tr'),id=item.id;
  tr.dataset.uatCase=id;
  const description=el('td');
  const heading=el('strong',id+' · '+item.name);description.append(heading);
  description.append(el('div',item.scope+' — '+item.steps));
  const expected=el('td');
  const expectedLabel=el('div','Kết quả mong đợi');
  expectedLabel.className='uat-mobile-label';
  expected.append(expectedLabel,document.createTextNode(item.expected));
  const statusTd=el('td');
  const select=el('select');
  select.id='uat_'+id;select.setAttribute('aria-label','Kết quả '+id);
  for(const [v,label] of Object.entries(statuses)){
   const option=el('option',label);option.value=v;select.append(option);
  }
  const statusLabel=el('label','Kết quả tự đánh giá');
  statusLabel.className='uat-mobile-label';statusLabel.htmlFor=select.id;
  statusTd.append(statusLabel,select);
  const noteTd=el('td');
  const note=el('input');note.type='text';note.maxLength=280;
  note.id='uat_note_'+id;
  note.autocomplete='off';note.placeholder='Chỉ ghi nhận xét, không ghi tên/SĐT khách';
  note.setAttribute('aria-label','Ghi chú '+id);
  const noteLabel=el('label','Nhận xét (không bắt buộc)');
  noteLabel.className='uat-mobile-label';noteLabel.htmlFor=note.id;
  noteTd.append(noteLabel,note);
  const apply=()=>{
   try{form.update(id,select.value,note.value);refresh();$('uatNotice').textContent='Đã ghi trong bộ nhớ QA: '+id}
   catch(e){$('uatNotice').textContent='Bị chặn: '+e.message}
  };
  select.addEventListener('change',apply);
  note.addEventListener('change',apply);
  tr.append(description,expected,statusTd,noteTd);
  $('uatRows').append(tr);
  cells.push({select,note});
 }
 $('exportUat').addEventListener('click',()=>{
  // Attach only readonly QA technical metrics, never brand as merchant owner proof.
  const evidence=form.exportEvidence();
  const inspector=window.T404Adv4Inspector.status();
  $('uatExportJson').value=JSON.stringify({...evidence,technicalPreview:{
   renderCount:inspector.renderCount,canSend:false,canWriteOrders:false,
   realModelCalls:0,hostedReads:0,sourceOnly:true
  }},null,2);
  $('uatNotice').textContent='Đã tạo báo cáo UAT trong trình duyệt. Sao chép JSON và gửi thủ công để người khác xem xét.';
  refresh();
 });
 $('resetUat').addEventListener('click',()=>{
  form.reset();
  for(const {select,note} of cells){select.value='NOT_RUN';note.value=''}
  $('uatExportJson').value='';refresh();
  $('uatNotice').textContent='Đã xóa đánh giá UAT khỏi bộ nhớ trang.';
 });
 refresh();
 Object.defineProperty(window,'T404Adv5UatInspector',{value:Object.freeze({
  status:()=>form.inspect(),exportEvidence:()=>form.exportEvidence()
 }),writable:false});
})();
