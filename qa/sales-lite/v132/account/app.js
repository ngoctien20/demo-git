'use strict';
// TIEN404 V13.2 Merchant Portal -- UI prototype only. No auth, no API, no billing writes.
const $=id=>document.getElementById(id);
const scenarios={
demo:{shop:'Cửa hàng mẫu · QA',plan:'Sales Lite · mẫu',planNote:'Chỉ là thông tin mẫu',botStatus:'Chưa kết nối',expires:'30/11/2026 (mẫu)',starts:'01/11/2026 (mẫu)',pairing:'Chưa xác minh',subscriptionStatus:'ACTIVE (mô phỏng)',noticeStatus:'DEMO',owner:'Tài khoản mẫu · chưa xác minh'},
empty:{shop:'Chưa có dữ liệu',plan:'Chưa có dữ liệu',planNote:'Chưa có dữ liệu thuê bao',botStatus:'Chưa xác minh',expires:'—',starts:'—',pairing:'Chưa xác minh',subscriptionStatus:'UNKNOWN',noticeStatus:'THIẾU DỮ LIỆU',owner:'Chưa có dữ liệu'},
expired:{shop:'Cửa hàng mẫu · QA',plan:'Sales Lite · mẫu',planNote:'Trạng thái giả lập hết hạn',botStatus:'Tạm dừng (mẫu)',expires:'01/11/2026 (mẫu)',starts:'01/10/2026 (mẫu)',pairing:'Chưa xác minh',subscriptionStatus:'EXPIRED (mô phỏng)',noticeStatus:'HẾT HẠN (MẪU)',owner:'Tài khoản mẫu · chưa xác minh'},
error:{shop:'Không tải được',plan:'Không tải được',planNote:'Mất kết nối giả lập',botStatus:'Không rõ trạng thái',expires:'—',starts:'—',pairing:'Không xác định',subscriptionStatus:'UNKNOWN',noticeStatus:'LỖI KẾT NỐI (MẪU)',owner:'Không tải được'}};
function show(view){document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active',s.id==='view-'+view));document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false')});window.scrollTo({top:0,behavior:'instant'});}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.goto)));
function render(){const mode=$('previewMode').value,v=scenarios[mode]||scenarios.empty;document.querySelectorAll('[data-fill]').forEach(n=>n.textContent=v[n.dataset.fill]??'—');
$('modeBadge').textContent=mode==='demo'?'FIXTURE · KHÔNG PHẢI DỮ LIỆU THẬT':mode==='empty'?'EMPTY STATE · QA':mode==='error'?'ERROR STATE · QA':'EXPIRED STATE · QA';}
$('previewMode').addEventListener('change',render);render();