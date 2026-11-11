/* TIEN404 Super Admin staging UI.
 * Authenticated same-origin calls only. No credentials, fake business records,
 * tenant mutation, n8n calls, payment activation or production fallbacks.
 */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const state={csrf:null,me:null};
let usagePage=1;
function show(id,yes){$(id).hidden=!yes}
function setText(id,value){$(id).textContent=String(value??"—")}
function row(cells,body){
  const tr=document.createElement("tr");
  for(const text of cells){const td=document.createElement("td");td.textContent=String(text??"—");tr.appendChild(td)}
  body.appendChild(tr);
}
function clear(id){$(id).replaceChildren()}
async function request(path,options={}){
  const identity=state.me;
  const res=await fetch(path,{credentials:"same-origin",cache:"no-store",...options});
  let data=null;
  try{data=await res.json()}catch{data={}}
  if(identity!==state.me)throw new Error("session_changed");
  if(!res.ok){const e=new Error("HTTP "+res.status);e.status=res.status;throw e}
  return data;
}
function notice(text){setText("app-status",text)}
async function session(){
  const me=await request("/api/v1/auth/me");
  if(!["SUPER_ADMIN","SUPPORT_ADMIN","TECH_ADMIN"].includes(me.role))throw Object.assign(new Error("insufficient_role"),{status:403});
  state.me=me;
  const csrf=await request("/api/v1/auth/csrf",{method:"POST"});
  state.csrf=csrf.csrf;
  show("login-view",false);show("console-view",true);
  setText("account-role",me.role);
  document.querySelector('[data-tab="audit"]').hidden=me.role!=="SUPER_ADMIN";
  await refreshTenants();
}
function showLogin(message=""){
  state.csrf=null;state.me=null;
  for(const name of ["tenants","plans","audit","usage"])clear(name+"-body");
  for(const id of ["account-role","tenant-count","audit-check","source-state","app-status","usage-period","usage-status"])setText(id,"");
  const tab=document.querySelector('[data-tab="tenants"]');
  for(const btn of document.querySelectorAll("[data-tab]")){
    btn.classList.toggle("active",btn===tab);
    if(btn===tab)btn.setAttribute("aria-current","page");else btn.removeAttribute("aria-current");
    show(btn.dataset.tab+"-panel",btn===tab);
  }
  show("console-view",false);show("login-view",true);
  setText("login-error",message);show("login-error",Boolean(message));
}
async function refreshTenants(){
  clear("tenants-body");show("tenants-empty",false);notice("");
  try{
    const d=await request("/api/v1/admin/tenants");
    setText("source-state",d.source==="staging_sqlite"?"STAGING":"Không xác định");
    const items=Array.isArray(d.items)?d.items:[];
    setText("tenant-count",items.length);
    for(const t of items)row([t.name,t.industry,t.service_enabled?"Bật trong staging":"Tắt trong staging",t.bot_paused?"Đang tạm dừng":"Chưa tạm dừng",t.id],$("tenants-body"));
    show("tenants-empty",items.length===0);
  }catch(e){setText("source-state","Lỗi kết nối");show("tenants-empty",true);notice("Không tải được dữ liệu cửa hàng ("+e.message+").")}
}
async function refreshPlans(){
  clear("plans-body");show("plans-empty",false);notice("");
  try{
    const d=await request("/api/v1/admin/plans");
    const items=Array.isArray(d.items)?d.items:[];
    for(const p of items)row([p.label,p.cycle,p.price_minor+" VND (staging)",p.max_messages],$("plans-body"));
    show("plans-empty",items.length===0);
  }catch(e){show("plans-empty",true);notice("Không tải được các gói trong staging ("+e.message+").")}
}
async function refreshUsage(page=1){
  const previous=$("usage-prev"),next=$("usage-next");
  previous.disabled=next.disabled=true;
  clear("usage-body");
  setText("usage-status","Đang tải…");
  try{
    const data=await request("/api/v1/admin/usage?page="+page);
    usagePage=data.page;
    setText("usage-period","Tháng "+data.month_utc+" (UTC) · Lượt giữ chỗ trên gateway staging.");
    for(const item of data.items)row([item.name,item.reserved,item.quota??"Chưa có gói"],$("usage-body"));
    setText("usage-status",data.items.length?"Trang "+usagePage:"Chưa có cửa hàng.");
    previous.disabled=usagePage===1;
    next.disabled=!data.has_more;
  }catch(e){setText("usage-status","Không tải được hạn mức. Mở lại mục này để thử lại.")}
}
$("usage-prev").addEventListener("click",()=>refreshUsage(usagePage-1));
$("usage-next").addEventListener("click",()=>refreshUsage(usagePage+1));
async function refreshAudit(){
  clear("audit-body");show("audit-empty",false);notice("");
  try{
    const d=await request("/api/v1/admin/audit");
    setText("audit-check",d.hash_chain_valid?"Chuỗi hash hợp lệ":"Lỗi xác minh chuỗi hash");
    const entries=Array.isArray(d.entries)?d.entries:[];
    for(const a of entries)row([a.created_at,a.action,a.tenant_id||"—",a.reason],$("audit-body"));
    show("audit-empty",entries.length===0);
  }catch(e){show("audit-empty",true);notice("Không thể xem nhật ký ("+e.message+").")}
}
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("[data-tab]").forEach(x=>{x.classList.toggle("active",x===b);if(x===b)x.setAttribute("aria-current","page");else x.removeAttribute("aria-current")});
  const tab=b.dataset.tab;
  for(const name of ["tenants","plans","audit","usage"])show(name+"-panel",tab===name);
  if(tab==="tenants")refreshTenants();
  if(tab==="plans")refreshPlans();
  if(tab==="usage")refreshUsage();
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
 try{
   await request("/api/v1/auth/logout",{method:"POST",headers:{"X-CSRF-Token":state.csrf||""}});
   showLogin();
 }catch(e){
   if(e.status===401)showLogin();
   else notice("Chưa xác nhận đăng xuất. Hãy kiểm tra kết nối và thử lại.");
 }
});
$("refresh-tenants").addEventListener("click",refreshTenants);
$("refresh-plans").addEventListener("click",refreshPlans);
session().catch(()=>showLogin());
})();