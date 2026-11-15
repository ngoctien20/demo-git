'use strict';
// V13.2 QA-only browser client. Never sends, writes, persists, or authenticates users.
const $=id=>document.getElementById(id);
const state={source:null,draft:null,active:null,selected:null,qty:null,richStyles:[]};
const clone=o=>JSON.parse(JSON.stringify(o));
function message(x){$('feedback').textContent=x}
function page(which){for(const s of document.querySelectorAll('.section'))s.classList.toggle('active',s.id==='view-'+which);
for(const b of document.querySelectorAll('[data-view]')){b.classList.toggle('active',b.dataset.view===which);b.setAttribute('aria-current',b.dataset.view===which?'page':'false')}
window.scrollTo({top:0,behavior:'instant'});}
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>page(b.dataset.view));
for(const b of document.querySelectorAll('[data-goto]'))b.addEventListener('click',()=>page(b.dataset.goto));
function menu(role){return state.draft?.menus?.find(m=>m.actor_role===role)}
function node(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n;}
function valid(){
const d=state.draft;if(!d||d.menu_version!=='1.1.0'||d.send_enabled!==false||d.order_write_enabled!==false||d.subscription_write_enabled!==false)return 'Trạng thái không an toàn hoặc Registry không hợp lệ';
const ids=new Set();for(const m of d.menus){const cmds=new Set();for(const a of m.actions){
if(ids.has(a.action_id)||!a.action_id||!a.label?.trim()||a.label.length>72||!a.description?.trim()||a.actor_role!==m.actor_role||!/^[1-9][0-9]?$/.test(a.fallback_command)||cmds.has(a.fallback_command)||a.menu_version!==d.menu_version||!Array.isArray(a.required_permissions)||!Array.isArray(a.channel_support)||!a.channel_support.includes('MOCK_WEB')||(a.action_type==='WRITE_PROPOSAL'&&!a.requires_confirmation))return 'Lỗi Action ID, vai trò, lệnh hoặc hợp đồng hành động';
ids.add(a.action_id);cmds.add(a.fallback_command);}}
return null;}
function selectorReset(){state.selected=null;drawActions();drawChat();}
function drawActions(){const m=menu($('role').value);$('actions').replaceChildren();$('actionCounter').textContent=m?m.actions.length+' hành động':'Không có menu';
if(!m)return;for(const a of m.actions){const b=node('button','action'+(state.selected===a.action_id?' active':''));b.type='button';
const text=node('span');text.append(node('b',null,a.fallback_command+' · '+a.label),node('small',null,a.description));
b.append(text,node('span','action-id',a.action_id));b.addEventListener('click',()=>selectAction(a.action_id));$('actions').append(b);}
if(!state.selected){$('editor').classList.add('hide');$('editorEmpty').classList.remove('hide');}}
function selectAction(id){const a=menu($('role').value)?.actions?.find(x=>x.action_id===id);if(!a)return;
state.selected=id;$('editor').classList.remove('hide');$('editorEmpty').classList.add('hide');
$('actionId').value=a.action_id;$('label').value=a.label;$('command').value=a.fallback_command;$('description').value=a.description;
$('permissions').textContent=a.required_permissions.join(' · ')||'Không có';$('nextState').textContent=a.next_state;
$('confirmation').textContent=a.requires_confirmation?'BẮT BUỘC':'KHÔNG';$('channels').textContent=a.channel_support.join(' + ');drawActions();}
$('role').addEventListener('change',selectorReset);$('shop').addEventListener('change',drawChat);
$('editor').addEventListener('submit',e=>{e.preventDefault();const a=menu($('role').value)?.actions?.find(x=>x.action_id===state.selected);if(!a)return;
const prev=clone(a);a.label=$('label').value.trim();a.description=$('description').value.trim();a.fallback_command=$('command').value.trim();
const err=valid();if(err){Object.assign(a,prev);selectAction(a.action_id);message('Không thể lưu: '+err);return;}
message('Đã sửa trong bản nháp cục bộ. Chưa cập nhật Registry gốc.');drawActions();drawChat();});
$('resetDraft').addEventListener('click',()=>{const a=menu($('role').value)?.actions.find(x=>x.action_id===state.selected),original=state.source?.menus.find(m=>m.actor_role===$('role').value)?.actions.find(x=>x.action_id===state.selected);
if(a&&original){Object.assign(a,clone(original));selectAction(a.action_id);message('Đã khôi phục action gốc trong bản nháp.')}});
$('validate').addEventListener('click',()=>{message(valid()||'Không phát hiện lỗi contract cục bộ. Đây không phải xác minh backend.');});
$('localQA').addEventListener('click',()=>{$('qaResult').textContent=valid()?'FAIL — '+valid():'PASS — kiểm tra contract cục bộ. Chưa có browser/hosted QA.';});
$('addDraft').addEventListener('click',()=>{if(!state.draft)return;const m=menu($('role').value);const ids=new Set(state.draft.menus.flatMap(x=>x.actions.map(a=>a.action_id))),commands=new Set(m.actions.map(a=>a.fallback_command));
let n=1;while(ids.has('EXP_QA_ACTION_'+n))n++;let c=1;while(commands.has(String(c)))c++;if(c>99){message('Không còn số menu 1–99.');return;}
const a={action_id:'EXP_QA_ACTION_'+n,menu_version:'1.1.0',label:'Hành động thử nghiệm',description:'Chưa gắn backend',actor_role:m.actor_role,action_type:'READ',required_permissions:['qa:preview'],requires_confirmation:false,idempotency_policy:'READ_ONLY',fallback_command:String(c),next_state:'MOCK_ONLY',enabled:true,channel_support:['ZALO_BOT_TEXT','MOCK_WEB']};
m.actions.push(a);selectAction(a.action_id);message('Đã thêm hành động EXPERIMENTAL cục bộ. Không tự publish.');});
$('export').addEventListener('click',()=>{if(valid()){message('Cấu hình không hợp lệ, không thể xuất.');return;}const payload=JSON.stringify({...state.draft,release:'EXPERIMENTAL',send_enabled:false,order_write_enabled:false,subscription_write_enabled:false},null,2);
const url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));const a=node('a');a.href=url;a.download='tien404-v133-menu-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Đã xuất bản nháp JSON, không gửi lên server.');});
function bubble(text,user){const b=node('div','bubble'+(user?' user':''),text);$('chat').append(b);$('chat').scrollTop=$('chat').scrollHeight;}
function drawChat(){const m=menu($('previewRole').value);state.qty=null;$('chat').replaceChildren();$('previewActions').replaceChildren();if(!m)return;
const actions=m.actions.filter(a=>a.enabled);bubble(m.title+'\n'+actions.map(a=>a.fallback_command+' — '+a.label).join('\n')+'\n\nGửi số để chọn mục.');
for(const a of actions){const b=node('button','action');b.type='button';b.append(node('span',null,a.fallback_command+' · '+a.label));b.addEventListener('click',()=>respond(a.fallback_command));$('previewActions').append(b);}}
function respond(value){const cmd=String(value).trim();if(!cmd)return;const m=menu($('previewRole').value);if(!m)return;bubble(cmd,true);
if(state.qty!==null&&/^\d+$/.test(cmd)){const n=Number(cmd);if(n>=1&&n<=499){const price=$('shop').value==='qa-store-b'?199000:159000;bubble('[CHỈ LÀ FIXTURE QA]\nF01 × '+n+' = '+(price*n).toLocaleString('vi-VN')+'đ. Chưa tạo đơn. Giá và kho thật phải xác minh lại.');state.qty=null;return;}state.qty=null;}
const a=m.actions.find(x=>x.enabled&&(x.fallback_command===cmd||x.action_id.toLowerCase()===cmd.toLowerCase()));
if(!a){bubble('Chưa nhận diện lựa chọn. Hãy gửi số trong danh sách.');return;}
if(a.action_id==='CUS_ORDER_DRAFT'){state.qty=0;bubble('Mô phỏng: hãy nhập số lượng 1–499. Không ghi đơn, không giữ hàng.');return;}
if(a.requires_confirmation){bubble(a.label+' cần xác thực Owner, xác nhận và backend receipt. Bản mô phỏng không thực hiện thao tác.');return;}
if(a.action_id==='CUS_CATALOG'||a.action_id==='CUS_PRICE'){bubble('Fixture QA F01: '+($('shop').value==='qa-store-b'?'199.000đ · tồn QA 5':'159.000đ · tồn QA 3')+'. Không phải giá bán đang áp dụng.');return;}
if(a.action_type==='HANDOFF'){bubble('Mô phỏng yêu cầu hỗ trợ. Chưa có ticket hoặc handoff thật.');return;}
bubble(a.label+' — chưa kết nối API xác thực. Không cung cấp thông tin đơn thật.');}
$('previewRole').addEventListener('change',drawChat);$('resetChat').addEventListener('click',drawChat);
$('chatForm').addEventListener('submit',e=>{e.preventDefault();respond($('chatInput').value);$('chatInput').value='';});
const richWhitelist=new Set(['b','i','u','s','f_18','c_15a85f','c_db342e']);
function rich(){
 const t=$('richText').value,preview=$('richPreview');preview.replaceChildren();
 const run=state.richStyles[0];if(run){
  const first=document.createTextNode(t.slice(0,run.start)),styled=node('span',null,t.slice(run.start,run.start+run.len)),last=document.createTextNode(t.slice(run.start+run.len));
  if(run.st.includes('b'))styled.style.fontWeight='800';
  if(run.st.includes('i'))styled.style.fontStyle='italic';
  if(run.st.includes('u'))styled.style.textDecoration='underline';
  if(run.st.includes('s'))styled.style.textDecoration='line-through';
  if(run.st.includes('f_18'))styled.style.fontSize='18px';
  if(run.st.includes('c_15a85f'))styled.style.color='#15a85f';
  if(run.st.includes('c_db342e'))styled.style.color='#db342e';
  preview.append(first,styled,last);
 }else preview.textContent=t;
 $('richPayload').textContent=JSON.stringify({text:t,text_styles:state.richStyles,send_enabled:false,note:'OFFICIALLY_DOCUMENTED_SCHEMA / NOT PROVIDER_TESTED'},null,2);
}
$('richText').addEventListener('input',()=>{state.richStyles=[];rich();});
$('styleApply').addEventListener('click',()=>{
 const el=$('richText'),t=el.value;let start=0,len=t.length;
 if($('styleRange').value==='selection'){start=el.selectionStart;len=el.selectionEnd-start;if(len===0){$('richPayload').textContent='Hãy chọn đoạn văn bản trước khi áp dụng định dạng.';return;}}
 const style=$('styleType').value;
 if(!len||t.length>2000||!richWhitelist.has(style)||start<0||start+len>t.length||
  (start>0&&/\uD800-\uDBFF/.test(t[start-1])&&/\uDC00-\uDFFF/.test(t[start]))||
  (start+len<t.length&&/\uD800-\uDBFF/.test(t[start+len-1])&&/\uDC00-\uDFFF/.test(t[start+len]))){
   $('richPayload').textContent='Khoảng UTF-16, ký tự hoặc kiểu định dạng không hợp lệ.';return;
 }
 state.richStyles=[{start,len,st:[style]}];rich();
});
$('richCopy').addEventListener('click',()=>{const s=$('richPayload').textContent;if(navigator.clipboard?.writeText)navigator.clipboard.writeText(s).catch(()=>{$('richPayload').focus();});});
// Draft timeline is entirely in memory; no storage, API, or publication.
const timeline=[],DRAFT_STATES=new Set(['DRAFT','REVIEW']);
let releaseState='DRAFT';
function draftDiff(b,a){
 const x=new Map(b.menus.flatMap(m=>m.actions.map(z=>[z.action_id,z])));
 const y=new Map(a.menus.flatMap(m=>m.actions.map(z=>[z.action_id,z])));
 const out=[];
 for(const id of new Set([...x.keys(),...y.keys()])){
  const before=x.get(id),after=y.get(id);
  if(!before){out.push(id+' · NEW ACTION · REVIEW_REQUIRED');continue}
  if(!after){out.push(id+' · REMOVED · HIGH RISK');continue}
  for(const field of ['label','description','fallback_command','required_permissions','requires_confirmation','next_state','channel_support','enabled']){
   if(JSON.stringify(before[field])!==JSON.stringify(after[field]))out.push(id+' · '+field+( ['required_permissions','requires_confirmation','channel_support','enabled'].includes(field)?' · HIGH RISK':' · REVIEW_REQUIRED'));
  }
 }
 return out;
}
$('saveVersion').addEventListener('click',()=>{
 if(releaseState!=='DRAFT'){message('Đã khóa trong REVIEW. Hãy làm phiên Draft mới để tiếp tục.');return;}
 if(valid()){message('Không thể lưu bản nháp không hợp lệ.');return;}
 const n=timeline.length+1;timeline.push({id:'DRAFT-'+n,registry:clone(state.draft)});
 const opt=node('option',null,'Bản nháp '+n);opt.value='draft-'+(n-1);$('compareVersion').append(opt);
 message('Đã chụp phiên bản '+n+' trong bộ nhớ trang. Không ghi server.');
});
$('compareButton').addEventListener('click',()=>{
 if(!state.draft)return;const v=$('compareVersion').value;
 const before=v==='baseline'?state.source:timeline[Number(v.replace('draft-',''))]?.registry;
 if(!before){$('diffOutput').textContent='Không tìm thấy bản lưu.';return;}
 const delta=draftDiff(before,state.draft);$('diffOutput').textContent=delta.length?delta.join('\n'):'Không có khác biệt giữa hai bản đang so sánh.';
});
$('reviewButton').addEventListener('click',()=>{
 if(valid()){message('Không thể REVIEW bản nháp chưa qua kiểm tra.');return;}
 if(releaseState!=='DRAFT')return;releaseState='REVIEW';
 $('versionStatus').textContent='REVIEW · CHỜ NGƯỜI PHÊ DUYỆT';
 $('reviewButton').disabled=true;$('addDraft').disabled=true;$('editor').querySelector('button[type="submit"]').disabled=true;
 message('Đã chuyển sang REVIEW trong bộ nhớ. APPROVED/RELEASED chỉ được quyết định qua quy trình có quyền.');
});
async function init(){try{const r=await fetch('../../v131/menu-registry.json',{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();state.source=clone(d);state.draft=clone(d);if(valid())throw new Error(valid());
$('version').textContent=d.menu_version;$('totalActions').textContent=String(d.menus.reduce((n,m)=>n+m.actions.length,0));drawActions();drawChat();rich();message('Registry nguồn đã tải thành công. Bản nháp không được lưu trên máy chủ.');
}catch(e){message('Không thể tải Menu Registry: '+e.message+' — chạy qua HTTP server với cấu trúc repo đầy đủ.');$('actions').textContent='Lỗi tải Registry. Không tạo menu giả.';}}
init();