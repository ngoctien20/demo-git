(function(){
  'use strict';
  // Deliberately independent, synthetic UI preview only. No API, credentials,
  // tenant session, storage, persistence, Zalo dispatch or customer records.
  const $=id=>document.getElementById(id);
  const state={status:'AI_ACTIVE',assignee:null,shopPaused:false,turns:0};
  const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim();
  function append(sender,text,style){
    const bubble=document.createElement('div');
    bubble.className='bubble '+style;
    const label=document.createElement('div');
    label.className='sender';
    label.textContent=sender;
    const value=document.createTextNode(String(text).slice(0,1000));
    bubble.append(label,value);
    $('conversation').append(bubble);
    $('conversation').scrollTop=$('conversation').scrollHeight;
    state.turns++;
  }
  function render(){
    const isHuman=state.status==='HUMAN_ACTIVE';
    $('stateValue').textContent=state.status;
    $('handoffStatus').textContent=state.status;
    $('botStatus').textContent=state.shopPaused?'Shop tạm nghỉ':isHuman?'Đang có nhân viên':
      state.status==='WAITING_STAFF'?'Chờ nhân viên':'AI sẵn sàng';
    $('assigneeLabel').textContent=state.assignee?'Nhân viên QA Shop B':'Chưa có';
    $('acceptBtn').disabled=state.status!=='WAITING_STAFF';
    $('releaseBtn').disabled=!isHuman;
    $('closeBtn').disabled=!isHuman;
    $('staffInput').disabled=!isHuman;
    $('staffSendBtn').disabled=!isHuman;
    $('pauseBtn').disabled=state.shopPaused;
    $('resumeBtn').disabled=!state.shopPaused;
    $('staffNotice').textContent=state.shopPaused?'Shop đang tạm nghỉ (chỉ mô phỏng).':
      isHuman?'AI không phản hồi tự động khi nhân viên đang tiếp quản.':
      state.status==='WAITING_STAFF'?'Yêu cầu nhân viên tiếp quản đã được tạo trong mô phỏng.':
      state.status==='RESOLVED'?'Đã đóng. Tin tiếp theo của khách sẽ mở hội thoại mới.':
      'AI đang phụ trách. Khách có thể yêu cầu gặp nhân viên.';
  }
  function updateAudit(kind){
    $('auditStatus').textContent=kind+' · 0 tin gửi Zalo · 0 đơn ghi dữ liệu · Không lưu hội thoại.';
  }
  function customerMessage(raw){
    const text=String(raw||'').trim();
    if(!text||text.length>1000)return false;
    if(state.status==='RESOLVED'){state.status='AI_ACTIVE';state.assignee=null;}
    append('Khách hàng QA',text,'customer');
    const t=norm(text);
    if(state.shopPaused){
      append('AI · Tin nhắn dự kiến','Cửa hàng hiện đang tạm nghỉ. Bạn có thể để lại lời nhắn, nhân viên sẽ hỗ trợ khi hoạt động trở lại.','ai');
    }else if(state.status==='WAITING_STAFF'||state.status==='HUMAN_ACTIVE'){
      // Suppress AI entirely: only staff response is allowed in HUMAN_ACTIVE.
    }else if(/\b(nhan vien|nguoi that|tu van vien|khieu nai|hoan tien|doi tra|can ho tro)\b/.test(t)){
      state.status='WAITING_STAFF';
      append('AI · Tin nhắn dự kiến','Mình sẽ chuyển yêu cầu của bạn đến nhân viên cửa hàng. Bạn có thể để lại nội dung cần hỗ trợ.','ai');
    }else if(/\b(gia|bao nhieu|san pham|ton kho|con hang|xem anh)\b/.test(t)){
      append('AI · Tin nhắn dự kiến','Mình đang kiểm tra dữ liệu sản phẩm của shop. Chưa có báo giá xác thực trong phiên mô phỏng này.','ai');
    }else if(/\b(mua|dat hang|chot don)\b/.test(t)){
      append('AI · Tin nhắn dự kiến','Mình đã ghi nhận nhu cầu mua. Cho mình biết mã sản phẩm và số lượng nhé. Chưa tạo đơn.','ai');
    }else {
      append('AI · Tin nhắn dự kiến','Chào bạn! Shop có thể hỗ trợ xem sản phẩm, hỏi giá hoặc chuyển đến nhân viên.','ai');
    }
    render();
    updateAudit('Đã xử lý tin khách trong giao diện mô phỏng');
    return true;
  }
  $('customerForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(customerMessage($('customerInput').value))$('customerInput').value='';
  });
  document.querySelectorAll('[data-quick]').forEach(button=>
    button.addEventListener('click',()=>customerMessage(button.dataset.quick)));
  $('acceptBtn').addEventListener('click',()=>{
    if(state.status!=='WAITING_STAFF')return;
    state.status='HUMAN_ACTIVE';state.assignee='qa_employee_b';
    render();updateAudit('Nhân viên tiếp quản (mock)');
  });
  $('releaseBtn').addEventListener('click',()=>{
    if(state.status!=='HUMAN_ACTIVE')return;
    state.status='AI_ACTIVE';state.assignee=null;
    render();updateAudit('Đã chuyển lại cho AI (mock)');
  });
  $('closeBtn').addEventListener('click',()=>{
    if(state.status!=='HUMAN_ACTIVE')return;
    state.status='RESOLVED';state.assignee=null;
    render();updateAudit('Đã đóng phiên QA');
  });
  $('staffForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(state.status!=='HUMAN_ACTIVE')return;
    const text=$('staffInput').value.trim();
    if(!text||text.length>1000)return;
    append('Nhân viên Shop B · Chưa gửi Zalo',text,'staff');
    $('staffInput').value='';
    updateAudit('Đã tạo bản nháp phản hồi của nhân viên');
  });
  $('pauseBtn').addEventListener('click',()=>{
    state.shopPaused=true;render();updateAudit('Shop tạm nghỉ (mock)');
  });
  $('resumeBtn').addEventListener('click',()=>{
    state.shopPaused=false;render();updateAudit('Shop hoạt động trở lại (mock)');
  });
  render();
})();