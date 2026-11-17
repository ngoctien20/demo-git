// TIEN404 V18.0-P0L — candidate UI only. No live Render deploy.
import {getAuthClient} from '/assets/auth-client.js';
import {verifyOwnerLocally,validNonce} from '/assets/private-auth-evidence-core.mjs';
const ORIGIN='https://tien404-auth-staging.onrender.com';
const $=id=>document.getElementById(id);
const status=$('status'),btn=$('check'),result=$('result');
const show=(msg)=>{status.textContent=msg;};
const clear=()=>{
 result.hidden=true;
 for(const id of ['nonce-output','actor-code','tenant-codes'])$(id).textContent='';
};
if(location.origin!==ORIGIN || !location.pathname.endsWith('/auth-evidence.html')){
 btn.disabled=true;show('BLOCKED: Sai nguồn staging hoặc sai trang QA.');
}else{
 btn.addEventListener('click',async()=>{
  clear();
  if(!$('consent').checked){show('BLOCKED: Cần sự đồng ý của chủ phiên QA.');return;}
  let nonce=$('nonce').value.trim();
  if(!nonce){nonce=crypto.randomUUID();$('nonce').value=nonce;}
  if(!validNonce(nonce)){show('BLOCKED: Mã đối chiếu không hợp lệ.');return;}
  btn.disabled=true;show('Đang kiểm tra Auth và quyền owner theo tenant…');
  try{
   const client=await getAuthClient();
   const evidence=await verifyOwnerLocally({client,nonce,consent:true});
   if(evidence.status!=='LOCAL_OWNER_AUTH_READ_OK'){
     show('BLOCKED: '+evidence.reason+' — không thay đổi phiên hoặc quyền.');return;
   }
   $('nonce-output').textContent=nonce;
   $('actor-code').textContent=evidence.actorCode;
   $('tenant-codes').textContent=evidence.ownerTenantCodes.join(' / ');
   result.hidden=false;
   show('Đã kiểm tra đọc cục bộ. KHÔNG phải chứng nhận Store hoặc session phía server.');
  }catch{
   show('BLOCKED: Không thể kiểm tra qua Auth staging.');
  }finally{
   btn.disabled=false;
  }
 });
}
