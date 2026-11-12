/* TIEN404 Super Admin staging UI.
 * Authenticated same-origin calls only. No credentials, fake business records,
 * tenant mutation, n8n calls, payment activation or production fallbacks.
 */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const state={csrf:null,me:null,epoch:0};
function show(id,yes){$(id).hidden=!yes}
function setText(id,value){$(id).textContent=String(value??"—")}
function row(cells,body){
  const tr=document.createElement("tr");
  for(const text of cells){const td=document.createElement("td");td.textContent=String(text??"—");tr.appendChild(td)}
  body.appendChild(tr);
}
function clear(id){$(id).replaceChildren()}
async function request(path,options={}){
  const res=await fetch(path,{credentials:"same-origin",cache:"no-store",...options});
  let data=null;
  try{data=await res.json()}catch{data={}}
  if(!res.ok){const e=new Error("HTTP "+res.status);e.status=res.status;throw e}
  return data;
}
function notice(text){setText("app-status",text)}
async function session(){
  const epoch=state.epoch;
  const me=await request("/api/v1/auth/me");
  if(epoch!==state.epoch)return;
  if(!["SUPER_ADMIN","SUPPORT_ADMIN","TECH_ADMIN"].includes(me.role))throw Object.assign(new Error("insufficient_role"),{status:403});
  state.me=me;
  const csrf=await request("/api/v1/auth/csrf",{method:"POST"});
  if(epoch!==state.epoch)return;
  state.csrf=csrf.csrf;
  // Never reuse DOM from a prior privileged session or role.
  resetConsole();
  show("login-view",false);show("console-view",true);
  setText("account-role",me.role);
  document.querySelector('[data-tab="audit"]').hidden=me.role!=="SUPER_ADMIN";
  await refreshTenants();
}
function resetConsole(){
  for(const id of ["tenants-body","plans-body","audit-body"])clear(id);
  for(const id of ["tenant-count","source-state","audit-check","account-role"])setText(id,"—");
  for(const id of ["tenants-empty","plans-empty","audit-empty"])show(id,false);
  notice("");
  document.querySelectorAll("[data-tab]").forEach(b=>{
    const selected=b.dataset.tab==="tenants";
    b.classList.toggle("active",selected);
    if(selected)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");
  });
  for(const name of ["tenants","plans","audit"])show(name+"-panel",name==="tenants");
  document.querySelector('[data-tab="audit"]').hidden=true;
}
function showLogin(message=""){
  state.epoch++;
  state.csrf=null;state.me=null;
  resetConsole();
  show("console-view",false);show("login-view",true);
  setText("login-error",message);show("login-error",Boolean(message));
}
async function refreshTenants(){
  const epoch=state.epoch;
  if(!state.me)return;
  clear("tenants-body");show("tenants-empty",false);notice("");
  try{
    const d=await request("/api/v1/admin/tenants");
    if(epoch!==state.epoch||!state.me)return;
    setText("source-state",d.source==="staging_sqlite"?"STAGING":"Không xác định");
    const items=Array.isArray(d.items)?d.items:[];
    setText("tenant-count",items.length);
    for(const t of items)row([t.name,t.industry,t.service_enabled?"Bật trong staging":"Tắt trong staging",t.bot_paused?"Đang tạm dừng":"Chưa tạm dừng",t.id],$("tenants-body"));
    show("tenants-empty",items.length===0);
  }catch(e){if(epoch!==state.epoch)return;setText("source-state","Lỗi kết nối");show("tenants-empty",true);notice("Không tải được dữ liệu cửa hàng ("+e.message+").")}
}
async function refreshPlans(){
  const epoch=state.epoch;
  if(!state.me)return;
  clear("plans-body");show("plans-empty",false);notice("");
  try{
    const d=await request("/api/v1/admin/plans");
    if(epoch!==state.epoch||!state.me)return;
    const items=Array.isArray(d.items)?d.items:[];
    for(const p of items)row([p.label,p.cycle,p.price_minor+" VND (staging)",p.max_messages],$("plans-body"));
    show("plans-empty",items.length===0);
  }catch(e){if(epoch!==state.epoch)return;show("plans-empty",true);notice("Không tải được các gói trong staging ("+e.message+").")}
}
async function refreshAudit(){
  const epoch=state.epoch;
  if(!state.me)return;
  clear("audit-body");show("audit-empty",false);notice("");
  try{
    const d=await request("/api/v1/admin/audit");
    if(epoch!==state.epoch||!state.me)return;
    setText("audit-check",d.hash_chain_valid?"Chuỗi hash hợp lệ":"Lỗi xác minh chuỗi hash");
    const entries=Array.isArray(d.entries)?d.entries:[];
    for(const a of entries)row([a.created_at,a.action,a.tenant_id||"—",a.reason],$("audit-body"));
    show("audit-empty",entries.length===0);
  }catch(e){if(epoch!==state.epoch)return;show("audit-empty",true);notice("Không thể xem nhật ký ("+e.message+").")}
}
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("[data-tab]").forEach(x=>{x.classList.toggle("active",x===b);if(x===b)x.setAttribute("aria-current","page");else x.removeAttribute("aria-current")});
  const tab=b.dataset.tab;
  for(const name of ["tenants","plans","audit"])show(name+"-panel",tab===name);
  if(tab==="tenants")refreshTenants();
  if(tab==="plans")refreshPlans();
  if(tab==="audit")refreshAudit();
}));
$("login-form").addEventListener("submit",async e=>{
 e.preventDefault();
 const form=e.currentTarget,btn=form.querySelector('button[type="submit"]');
 btn.disabled=true;show("login-error",false);
 const fd=new FormData(form);
 try{
  const payload={email:String(fd.get("email")||""),password:String(fd.get("password")||""),totp:String(fd.get("totp")||"")};
  const login=await request("/api/v1/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  state.csrf=login.csrf;
  form.reset();
  await session();
 }catch(e){showLogin("Không thể đăng nhập hoặc tài khoản không có quyền truy cập (mã "+(e.status||"kết nối")+").")}
 finally{btn.disabled=false}
});
$("logout").addEventListener("click",async()=>{
 const csrf=state.csrf||"";
 // Clear sensitive content before waiting for the network. Stale requests
 // cannot repopulate the console because showLogin increments epoch.
 showLogin();
 try{await request("/api/v1/auth/logout",{method:"POST",headers:{"X-CSRF-Token":csrf}})}
 catch{show("login-error",true);setText("login-error","Chưa xác nhận được đăng xuất trên máy chủ. Vui lòng thử lại hoặc đóng trình duyệt.");}
});
$("refresh-tenants").addEventListener("click",refreshTenants);
$("refresh-plans").addEventListener("click",refreshPlans);
session().catch(()=>showLogin());
})();