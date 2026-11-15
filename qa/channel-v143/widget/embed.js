/* TIEN404 V14.3 — intentionally QA-ONLY embed snippet.
 * No customer website publishing, secrets, API calls or credentials.
 * Requires data-mode="qa-offline"; real install will require hosted gateway,
 * verified domain, rate limit, scoped session and shop RLS approval.
 */
(()=>{
 'use strict';
 const script=document.currentScript;
 if(!script||script.dataset.mode!=='qa-offline')return;
 const id=script.dataset.widgetId||'';
 if(!/^qa_shop_[abc]$/.test(id))return;
 const frame=new URL('./frame.html',script.src);
 frame.searchParams.set('qa',id);
 // Only a local synthetic HTML is allowed. Do not accept iframe URL from user.
 const node=document.createElement('iframe');
 node.title='TIEN404 AI Chat · Mô phỏng';
 node.setAttribute('sandbox','allow-scripts');
 node.setAttribute('referrerpolicy','no-referrer');
 node.setAttribute('data-tien404-qa-widget','true');
 node.style.position='fixed';
 node.style.zIndex='2147480000';
 node.style.width='min(370px, calc(100vw - 20px))';
 node.style.maxWidth='calc(100vw - 20px)';
 node.style.height='72px';
 node.style.bottom='12px';
 node.style.border='0';
 node.style.background='transparent';
 node.style.pointerEvents='auto';
 node.style[script.dataset.position==='left'?'left':'right']='10px';
 node.src=frame.toString();
 window.addEventListener('message',event=>{
  // Opaque sandboxed QA frame has origin null. Source identity and exact
  // message schema are checked; no sensitive data crosses this boundary.
  if(event.source!==node.contentWindow||
     !event.data||event.data.kind!=='TIEN404_QA_WIDGET_SIZE'||
     ![72,520].includes(event.data.height))return;
  node.style.height=Math.min(event.data.height,window.innerHeight-12)+'px';
 });
 document.body.append(node);
})();