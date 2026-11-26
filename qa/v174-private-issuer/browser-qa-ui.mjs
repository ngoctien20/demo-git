import {createWebsiteChatQaClient} from '/qa-adapter.mjs';
const status=document.querySelector('#status');
const log=document.querySelector('#chat');
const form=document.querySelector('#composer');
const message=document.querySelector('#message');
const button=document.querySelector('#send');
function append(text,className){
 const block=document.createElement('div');block.className='message '+className;
 block.textContent=text;log.append(block);return block;
}
const client=createWebsiteChatQaClient({
 apiBase:location.origin,origin:location.origin,installationRef:'QA_WEB_WIDGET_A',
 fetchImpl:globalThis.fetch.bind(globalThis),
 randomId:()=> 'QA_MSG_'+crypto.randomUUID().replaceAll('-','').toUpperCase()
});
window.addEventListener('pagehide',()=>client.clear());
form.addEventListener('submit',async event=>{
 event.preventDefault();
 const text=message.value;
 if(!text||text.length>500)return;
 button.disabled=true;status.textContent='Đang kiểm tra phiên QA...';
 append(text,'user');message.value='';
 try{
  const result=await client.chat(text);
  append(result.reply,'bot');status.textContent='QA ONLY — không có lệnh gửi hoặc ghi đơn';
 }catch{
  append('QA không khả dụng hoặc phiên không hợp lệ. Không có thao tác thật nào được thực hiện.','bot');
  status.textContent='BLOCKED — không có quyền gửi tin/ghi đơn';
 }finally{button.disabled=false;message.focus();}
});