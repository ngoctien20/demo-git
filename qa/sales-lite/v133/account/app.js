'use strict';
// TIEN404 V13.3 Merchant Portal. Same-origin READ ONLY, no write and no browser token storage.
// Production-ready identity/session/authorization must be provided by trusted backend API.
const $=id=>document.getElementById(id);
const empty={shop:'Chưa xác minh',plan:'Chưa có dữ liệu',planNote:'Chưa có nguồn thuê bao đã xác thực',botStatus:'Không xác định',expires:'—',starts:'—',remaining:'—',pairing:'Chưa xác minh',subscriptionStatus:'UNKNOWN',noticeStatus:'CHƯA XÁC MINH',owner:'Chưa đăng nhập'};
const qa={
 demo:{shop:'Cửa hàng QA · ví dụ',plan:'Lite · mẫu',planNote:'CHỈ LÀ FIXTURE QA',botStatus:'Chưa kết nối',expires:'30/11/2026 (mẫu)',starts:'01/11/2026 (mẫu)',remaining:'Mô phỏng',pairing:'Chưa xác minh',subscriptionStatus:'ACTIVE (mẫu)',noticeStatus:'FIXTURE QA',owner:'Người dùng mô phỏng'},
 empty:{...empty,noticeStatus:'EMPTY · QA'},
 expired:{...empty,shop:'Cửa hàng QA · ví dụ',plan:'Lite · mẫu',expires:'01/11/2026 (mẫu)',remaining:'Đã hết hạn (mẫu)',subscriptionStatus:'EXPIRED (mẫu)',noticeStatus:'EXPIRED · QA'},
 error:{...empty,shop:'Không có dữ liệu',noticeStatus:'ERROR · QA'}
};
const allowedStates=new Set(['ACTIVE','EXPIRING','EXPIRED','SUSPENDED','PAYMENT_PENDING','UNKNOWN']);
function show(view){document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active',s.id==='view-'+view));document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});window.scrollTo({top:0,behavior:'instant'});}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.goto)));
function paint(v){document.querySelectorAll('[data-fill]').forEach(n=>n.textContent=v[n.dataset.fill]??'—');}
function banner(text){$('expiryBanner').textContent=text;}
function fmtDate(s){const v=Date.parse(s);return Number.isFinite(v)?new Date(v).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';}
function remaining(s,now=Date.now()){const x=Date.parse(s);if(!Number.isFinite(x))return 'Chưa có dữ liệu';return Math.ceil((x-now)/86400000)>0?Math.ceil((x-now)/86400000)+' ngày':'Đã đến hạn hoặc hết hạn';}
function derive(result){
 // This only validates an API response shape for presentation; it is NOT authorization proof.
 if(!result||result.contract_version!=='1.0.0'||result.source!=='SERVER_VERIFIED'||!result.shop||!result.subscription||!result.bot||!result.account)throw Error('CONTRACT_INVALID');
 const sub=result.subscription,bot=result.bot;
 const status=allowedStates.has(sub.state)?sub.state:'UNKNOWN';
 return {shop:result.shop.name||'Không có tên cửa hàng',owner:result.account.display_name||'Người dùng',plan:sub.plan_name||'Chưa có dữ liệu',
 planNote:'Dữ liệu trả về từ API đã xác thực',botStatus:bot.connection_state||'UNKNOWN',expires:fmtDate(sub.expires_at),starts:fmtDate(sub.starts_at),
 remaining:remaining(sub.expires_at),pairing:bot.owner_pairing||'UNKNOWN',subscriptionStatus:status,noticeStatus:status};
}
let controller=null;
async function live(){
 if(controller)controller.abort();controller=new AbortController();
 $('modeBadge').textContent='ĐANG TẢI · API CHỈ ĐỌC';$('connectionMessage').textContent='Đang tải thông tin qua API chỉ đọc…';paint(empty);banner('Chưa có thông tin thuê bao đã xác minh.');
 const ctrl=controller;const timer=setTimeout(()=>ctrl.abort(),8000);
 try{
  const r=await fetch('/api/sales-lite/me',{method:'GET',credentials:'same-origin',cache:'no-store',signal:ctrl.signal,redirect:'error',headers:{accept:'application/json'}});
  if(ctrl!==controller)return;
  if(r.status===401){$('connectionMessage').textContent='Chưa đăng nhập. Hãy dùng trang đăng nhập TIEN404 chính thức khi được kết nối.';return;}
  if(r.status===403){$('connectionMessage').textContent='Tài khoản không có quyền xem thông tin cửa hàng.';return;}
  if(!r.ok){$('connectionMessage').textContent='Không truy cập được API tài khoản. Dữ liệu không khả dụng.';return;}
  const data=await r.json();if(ctrl!==controller)return;
  const v=derive(data);paint(v);
  const days=Number.isFinite(Date.parse(data.subscription?.expires_at))?Math.ceil((Date.parse(data.subscription.expires_at)-Date.now())/86400000):null;
  const sub=v.subscriptionStatus;
  const hint=sub==='EXPIRED'?'Gói đã hết hạn theo backend. Không có chức năng gia hạn tự động.':
    sub==='SUSPENDED'?'Gói tạm ngừng. Hãy liên hệ hỗ trợ.':
    sub==='PAYMENT_PENDING'?'Thanh toán đang chờ xác minh. Chưa tự xác nhận gia hạn.':
    ['ACTIVE','EXPIRING'].includes(sub)&&days!==null&&days<=0?'Đã tới hạn theo ngày đọc được; backend sẽ quyết định quyền sử dụng.':
    ['ACTIVE','EXPIRING'].includes(sub)&&days!==null&&days<=7?'Gói còn '+days+' ngày (mốc nhắc trong giao diện, không gửi thông báo).':
    'Chưa có cảnh báo gia hạn cần thực hiện.';
  banner(hint);$('modeBadge').textContent='READ-ONLY · API';$('connectionMessage').textContent='Đã nhận dữ liệu từ API. Quyền và phạm vi cửa hàng phải được kiểm tra phía backend.';
 }catch{$('connectionMessage').textContent='Không kết nối được API chỉ đọc. Không dùng dữ liệu mẫu thay thế.';}
 finally{clearTimeout(timer);}
}
function render(){
 const mode=$('previewMode').value;
 if(mode==='live'){live();return;}
 if(controller){controller.abort();controller=null;}
 const data=qa[mode]||qa.empty;paint(data);banner('QA FIXTURE — cảnh báo và thời hạn không phải dữ liệu thật.');$('modeBadge').textContent='QA FIXTURE · KHÔNG PHẢI DỮ LIỆU THẬT';
 $('connectionMessage').textContent='Đang xem dữ liệu mô phỏng riêng cho QA. Không có đăng nhập, dữ liệu shop hoặc thanh toán thực.';
}
$('previewMode').addEventListener('change',render);render();
