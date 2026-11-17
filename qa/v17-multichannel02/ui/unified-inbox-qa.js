// TIEN404 V17.MULTI-CHANNEL-02 — browser-only synthetic Inbox.
// All buttons simulate transitions in memory. No fetch/XHR/WS/localStorage,
// provider calls, token/session handling, orders, or real staff authority.
(() => {
 'use strict';
 const byId = id => document.getElementById(id);
 const channels = {messenger:'Messenger',zalo_oa:'Zalo OA',
   zalo_bot:'Zalo Bot',website_widget:'Website'};
 const stateName = {BOT_ACTIVE:'AI đang xử lý',
  HANDOFF_PENDING:'Chờ nhân viên',HUMAN_ACTIVE:'Nhân viên tiếp quản',
  RESUME_PENDING:'Chờ trả AI'};
 const seed = [
  ['store-A','messenger','QA-A-01','Khách QA 01',
    'Mình cần gặp nhân viên tư vấn.', 'HANDOFF_PENDING'],
  ['store-A','zalo_oa','QA-A-02','Khách QA 02',
    'Cho mình xem mẫu sản phẩm mới.', 'BOT_ACTIVE'],
  ['store-A','website_widget','QA-A-03','Khách QA 03',
    'Xin hỗ trợ đổi size.', 'HUMAN_ACTIVE'],
  ['store-A','zalo_bot','QA-A-04','Khách QA 04',
    'Mình hỏi thời gian hoạt động.', 'BOT_ACTIVE'],
  ['store-B','messenger','QA-B-01','Khách QA 05',
    'Mình muốn hỏi hàng đang có.', 'BOT_ACTIVE'],
  ['store-B','zalo_oa','QA-B-02','Khách QA 06',
    'Nhân viên hỗ trợ giúp tôi nhé.', 'HANDOFF_PENDING'],
  ['store-B','website_widget','QA-B-03','Khách QA 07',
    'Đang chờ AI tư vấn lại.', 'RESUME_PENDING'],
  ['store-B','zalo_bot','QA-B-04','Khách QA 08',
    'Tôi cần tư vấn thêm.', 'HUMAN_ACTIVE']
 ];
 const rows = seed.map(([store,channel,id,label,body,status]) => ({
   store,channel,id,label,body,status,revision:1,
   log:['Bản ghi QA synthetic. Không phải tin nhắn khách hàng thật.']
 }));
 let selected = null;
 const q = {store:'store-A',channel:'all',state:'all',search:''};
 function el(tag,cls,text){
   const e=document.createElement(tag);
   if(cls)e.className=cls;
   if(text!==undefined)e.textContent=String(text);
   return e;
 }
 function filtered(){
   return rows.filter(r => r.store===q.store &&
      (q.channel==='all'||r.channel===q.channel) &&
      (q.state==='all'||r.status===q.state) &&
      (!q.search||[r.label,r.body,r.id].some(s=>
        s.toLocaleLowerCase('vi').includes(q.search))));
 }
 function visibleSelected(list){return list.find(r=>r.id===selected) ?? list[0] ?? null;}
 function setDetail(row){
   const message=byId('messages');message.replaceChildren();
   const name=byId('title'),channel=byId('channelLabel');
   const pill=byId('status');
   if(!row){
     name.textContent='Không có hội thoại phù hợp';
     channel.textContent='Đổi bộ lọc để xem dữ liệu QA';
     pill.textContent='QA NO SEND';
     message.append(el('p','muted','Không có dữ liệu khách hàng thật.'));
   } else {
     name.textContent=row.label+' · '+row.id;
     channel.textContent=channels[row.channel]+' · '+(row.store==='store-A'?'QA Store A':'QA Store B');
     pill.textContent=stateName[row.status];
     const intro=el('div','safeline');
     intro.textContent='Bản xem thử · Nội dung, danh tính và phân quyền là giả lập. Trạng thái: '+stateName[row.status]+'.';
     message.append(intro);
     const customer=el('div','bubble customer');
     customer.append(el('div','caption','Khách QA · dữ liệu mô phỏng'));
     customer.append(document.createTextNode(row.body));
     message.append(customer);
     const status=el('div','bubble internal');
     status.append(el('div','caption','Hệ thống QA / no-send'));
     status.append(document.createTextNode(row.log.at(-1)));
     message.append(status);
     if(row.status!=='BOT_ACTIVE') {
       message.append(el('div','safeline','AI bị giữ ở chế độ tạm dừng trong trạng thái này. Không có lệnh gửi tin nào được gọi.'));
     }
   }
   const allow = step => row && ({
     request:'BOT_ACTIVE',ack:'HANDOFF_PENDING',
     resume:'HUMAN_ACTIVE',ackResume:'RESUME_PENDING'
   })[step]===row.status;
   for(const key of ['request','ack','resume','ackResume'])
     byId(key).disabled=!allow(key);
   byId('audit').textContent=row ?
      'QA '+row.id+' · revision '+row.revision+
      ' · 0 tin gửi thật · 0 đơn ghi · 0 Meta/Zalo API call.' :
      '0 tin gửi thật · 0 đơn ghi · 0 Meta/Zalo API call.';
 }
 function render(){
   const list=filtered();
   const focus=visibleSelected(list);
   selected=focus?.id??null;
   const box=byId('threads');box.replaceChildren();
   byId('storeName').textContent=q.store==='store-A'?'QA Store A':'QA Store B';
   byId('counts').textContent=list.length+' hội thoại thử nghiệm';
   for(const row of list){
     const b=el('button','thread'+(row.id===selected?' selected':''));b.type='button';
     b.setAttribute('aria-label','Xem '+row.id+' ('+channels[row.channel]+')');
     b.setAttribute('aria-selected',row.id===selected?'true':'false');
     const r1=el('div','row');
     r1.append(el('span','threadtitle',row.label));
     const flag=el('span','pill '+(row.status==='BOT_ACTIVE'?'bot':
        row.status==='HUMAN_ACTIVE'?'human':'pending'),channels[row.channel]);
     r1.append(flag);b.append(r1);
     b.append(el('span','muted',row.body));
     b.append(el('span','muted','QA SYNTHETIC · '+stateName[row.status]));
     b.addEventListener('click',()=>{selected=row.id;render();});
     box.append(b);
   }
   if(!list.length)box.append(el('p','muted','Không có hội thoại QA phù hợp.'));
   setDetail(focus);
 }
 function transition(step){
   const row=rows.find(x=>x.id===selected&&x.store===q.store);
   if(!row)return;
   const next={
     request:['BOT_ACTIVE','HANDOFF_PENDING','QA yêu cầu nhân viên, AI tạm dừng.'],
     ack:['HANDOFF_PENDING','HUMAN_ACTIVE','QA xác nhận nhân viên nhận; không có Meta webhook thật.'],
     resume:['HUMAN_ACTIVE','RESUME_PENDING','QA yêu cầu trả AI, bot vẫn tạm dừng.'],
     ackResume:['RESUME_PENDING','BOT_ACTIVE','QA xác nhận trả AI; không có Meta API thật.']
   }[step];
   if(!next||row.status!==next[0])return;
   row.status=next[1];row.revision++;
   row.log.push(next[2]);
   // State transitions here are mock-only: no persisted CAS or provider ACK.
   render();
 }
 for(const key of ['store','channel','state']){
   byId(key).addEventListener('change',()=>{
     q[key]=byId(key).value;selected=null;render();
   });
 }
 byId('search').addEventListener('input',()=>{
   q.search=byId('search').value.toLocaleLowerCase('vi').trim();
   selected=null;render();
 });
 for(const key of ['request','ack','resume','ackResume']){
   byId(key).addEventListener('click',()=>transition(key));
 }
 render();
})();