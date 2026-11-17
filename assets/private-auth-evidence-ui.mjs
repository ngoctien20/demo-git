// TIEN404 V18.0-P0O — Private read-only browser UI, no network beyond Auth + RLS SELECT.
import {getAuthClient} from '/assets/auth-client.js';
import {verifyOwnerLocally,validNonce,makeLocalPairReceipt,comparePeerLocalReceipt}
  from '/assets/private-auth-evidence-core.mjs';
const ORIGIN='https://tien404-auth-staging.onrender.com';
const $=id=>document.getElementById(id);
const status=$('status'),btn=$('check'),result=$('result');
const compareBtn=$('compare-receipt'),copyBtn=$('copy-receipt');
let localEvidence=null,localNonce=null;
const show=(msg)=>{status.textContent=msg;};
function clearEvidence(){
 localEvidence=null;localNonce=null;
 result.hidden=true;
 for(const id of ['nonce-output','actor-code','tenant-codes','receipt-output','peer-receipt'])
   $(id).value!==undefined?$(id).value='':$(id).textContent='';
 $('compare-status').textContent='Chưa đối chiếu';
}
if(location.origin!==ORIGIN || location.pathname!=='/auth-evidence.html'){
 btn.disabled=true;show('BLOCKED: Sai nguồn staging hoặc sai trang QA.');
}else{
 btn.addEventListener('click',async()=>{
  clearEvidence();
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
   const receipt=makeLocalPairReceipt(evidence,nonce);
   if(!receipt){show('BLOCKED: Không thể tạo biên nhận tạm thời.');return;}
   localEvidence=evidence;localNonce=nonce;
   $('nonce-output').textContent=nonce;
   $('actor-code').textContent=evidence.actorCode;
   $('tenant-codes').textContent=evidence.ownerTenantCodes.join(' / ');
   $('receipt-output').value=receipt;
   result.hidden=false;
   show('Đã kiểm tra cục bộ. Để đối chiếu, sao chép biên nhận phiên B và dán vào phiên A.');
  }catch{
   show('BLOCKED: Không thể kiểm tra qua Auth staging.');
  }finally{btn.disabled=false;}
 });
 compareBtn.addEventListener('click',()=>{
  if(!localEvidence||!localNonce){
    $('compare-status').textContent='BLOCKED: Phiên hiện tại chưa được kiểm tra.';return;
  }
  const r=comparePeerLocalReceipt(localEvidence,localNonce,$('peer-receipt').value);
  $('compare-status').textContent=r.status==='LOCAL_TWO_ACTOR_SAME_OWNER_TENANT_INDICATION'
    ?'ĐỐI CHIẾU CỤC BỘ ĐẠT: hai dấu tài khoản khác nhau, cùng một tenant owner. Chưa phải xác minh server hoặc Store A/B.'
    :'CHƯA ĐẠT: '+r.reason+'. Không cấp quyền hoặc gửi dữ liệu.';
 });
 copyBtn.addEventListener('click',async()=>{
  const value=$('receipt-output').value;
  if(!value||!localEvidence)return;
  try{
   await navigator.clipboard.writeText(value);
   $('copy-status').textContent='Đã sao chép biên nhận tạm thời. Chỉ dán vào trang QA của phiên còn lại.';
  }catch{
   $('receipt-output').focus();$('receipt-output').select();
   $('copy-status').textContent='Không thể sao chép tự động: dùng thao tác Sao chép văn bản đã chọn.';
  }
 });
 $('nonce').addEventListener('input',clearEvidence);
 $('consent').addEventListener('change',clearEvidence);
}
