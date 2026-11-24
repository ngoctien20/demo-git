// V24 (quick replies) + V23 reply-count rule: 1 message by default, 2 when it helps (long text + button card), hard max 3 per customer message.
const MAX_MESSAGES=3;
const TEXT_LIMIT=1800;
const incoming=$input.first().json;
const current=$('Loop One Message').first(1, $('Loop One Message').context.currentRunIndex).json;
let reply=typeof incoming.output==='string'?incoming.output.trim():'';
// V24.1: tin thoại đã hiểu → mở đầu bằng câu bot nghe được (vẫn 1 tin).
if(reply&&typeof current.heard==='string'&&current.heard)reply='🎤 Shop nghe: "'+current.heard.slice(0,200)+'"\n\n'+reply;
if(!/^\d{5,30}$/.test(String(current.senderId??'')))return [];
if(!/^\d{5,30}$/.test(String(current.pageId??'')))return [];
// V21 catalogue pagination: deterministic message from the DEMO-only catalog renderer, no AI prices.
if(current.mediaType==='catalog_page'){
 const cm=incoming.catalogMessage&&typeof incoming.catalogMessage==='object'?incoming.catalogMessage:null;
 const fallback={text:'Danh mục chưa sẵn sàng. Bạn hãy mở lại mục Xem sản phẩm nhé.'};
 let mm=fallback;
 if(cm&&typeof cm.text==='string'&&cm.text.length<=1800&&cm.text.trim())mm={text:cm.text};
 else if(cm&&cm.attachment?.type==='template'&&cm.attachment?.payload?.template_type==='button'){
  const p=cm.attachment.payload;
  const bs=Array.isArray(p.buttons)?p.buttons:[];
  const qs=Array.isArray(cm.quick_replies)?cm.quick_replies:[];
  const validButtons=bs.length>=1&&bs.length<=3&&bs.every(b=>b.type==='postback'&&
   /^TIEN404:VIEW:[A-Z][0-9]{3}$/.test(String(b.payload??''))&&typeof b.title==='string'&&b.title.length<=20);
  const validQuick=qs.length<=2&&qs.every(q=>q.content_type==='text'&&typeof q.title==='string'&&q.title.length<=20&&
   /^T404:C:[a-z][a-z0-9_]{1,31}:[1-9][0-9]{0,8}:[0-9a-f]{8}:[1-9][0-9]?$/.test(String(q.payload??'')));
  if(typeof p.text==='string'&&p.text.length<=640&&p.text.trim()&&validButtons&&validQuick){
   mm={attachment:{type:'template',payload:{template_type:'button',text:p.text,buttons:bs}},
    ...(qs.length?{quick_replies:qs}:{})};
  }
 }
 // V27.1 native layout: 2–3 trusted items => generic carousel (photo when verified) followed by a short
 // follow-up text carrying page controls. Any missing/malformed/mismatched data => original button template.
 const cards=Array.isArray(incoming.catalogCards)?incoming.catalogCards:[];
 const originalButtons=mm.attachment?.payload?.buttons??[];
 const cpLen=s=>[...s].length;
 const imgOk=u=>u===undefined||(typeof u==='string'&&u.length<=1000&&/^https:\/\/(lh3\.googleusercontent\.com|i\.imgur\.com|ngoctien20\.github\.io)\//.test(u));
 const follow=typeof incoming.catalogFollowText==='string'&&incoming.catalogFollowText.trim()&&cpLen(incoming.catalogFollowText)<=300?incoming.catalogFollowText:null;
 const validCards=!!follow&&cards.length>=2&&cards.length<=3&&cards.length===originalButtons.length&&cards.every((c,i)=>{
  const btn=originalButtons[i], cb=c?.buttons;
  return c&&typeof c.title==='string'&&cpLen(c.title)>0&&cpLen(c.title)<=80&&
   typeof c.subtitle==='string'&&cpLen(c.subtitle)>0&&cpLen(c.subtitle)<=80&&imgOk(c.image_url)&&
   Array.isArray(cb)&&cb.length===1&&cb[0].type==='postback'&&cb[0].payload===btn.payload&&
   cb[0].title===btn.title&&c.title.startsWith(btn.payload.slice('TIEN404:VIEW:'.length)+' · ');
 });
 const hasImg=validCards&&cards.some(c=>c.image_url);
 const plan=validCards?[{attachment:{type:'template',payload:{template_type:'generic',...(hasImg?{image_aspect_ratio:'square'}:{}),
   elements:cards.map(c=>({title:c.title,subtitle:c.subtitle,...(c.image_url?{image_url:c.image_url}:{}),buttons:c.buttons.map(x=>({type:'postback',title:x.title,payload:x.payload}))}))}}},
  {text:follow,...(mm.quick_replies?.length?{quick_replies:mm.quick_replies}:{})}]:[mm];
 const safeReply=mm.text??mm.attachment?.payload?.text??fallback.text;
 return plan.map((messengerMessage,index)=>({json:{messengerMessage,messageIndex:index+1,messageCount:plan.length,pageId:current.pageId,
  senderId:current.senderId,messageId:current.messageId,receivedAt:current.receivedAt,replyText:safeReply}}));
}
// V21 menu: fixed reply built from the owner's PUBLISHED menu (greeting + quick replies, or owner-entered info). 1 message, no AI.
if(current.mediaType==='menu_reply'&&current.menuMessage&&typeof current.menuMessage.text==='string'){
 const mm={text:String(current.menuMessage.text).slice(0,TEXT_LIMIT)};
 const q=Array.isArray(current.menuMessage.quick_replies)?current.menuMessage.quick_replies.slice(0,13):[];
 if(q.length)mm.quick_replies=q.map(x=>({content_type:'text',title:String(x.title??'').slice(0,20),payload:String(x.payload??'').slice(0,1000)}));
 return [{json:{messengerMessage:mm,messageIndex:1,messageCount:1,pageId:current.pageId,senderId:current.senderId,messageId:current.messageId,receivedAt:current.receivedAt,replyText:mm.text}}];
}
if(!reply)return [];
const officialWebsiteUrl='https://ngoctien20.github.io/demo-git/';
const isCustomerText=current.mediaType==='text' && !String(current.chatInput??'').startsWith('QA_CORE:');
const normalizedInput=String(current.chatInput??'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/gi,'d').toLowerCase();
const asksForWebsite=/(?:website|trang web|link chinh thuc|link web)/i.test(normalizedInput);
let card=null; // {buttons, intro}
if(isCustomerText && asksForWebsite && reply.includes(officialWebsiteUrl)){
 card={buttons:[{type:'web_url',url:officialWebsiteUrl,title:'Mở website'}],intro:'Website chính thức của shop:'};
} else if(isCustomerText){
 const skus=[...new Set(Array.from(reply.matchAll(/^\s*(?:[-•*]\s*|\d{1,2}[.)]\s*)?(?:\*\*)?([A-Z]\d{3})\b/gm),m=>m[1]))];
 // Meta button template has max 3 buttons. Even a longer AI catalog still needs selectable SKUs.
 if(skus.length>0)card={buttons:skus.slice(0,3).map(sku=>({type:'postback',title:'Xem '+sku,payload:'TIEN404:VIEW:'+sku})),intro:skus.length>3?'Bấm xem một trong 3 mẫu đầu hoặc nhắn mã SKU của mẫu khác:':'Bấm để xem nhanh từng mẫu:'};
}
// Split long text on paragraph/line boundaries into chunks of at most TEXT_LIMIT characters.
const splitText=(text,maxChunks)=>{
 if(text.length<=TEXT_LIMIT)return [text];
 const parts=text.split(/(\n\s*\n|\n)/);
 const chunks=[];let cur='';
 for(const p of parts){
  if((cur+p).length<=TEXT_LIMIT){cur+=p;continue;}
  if(cur.trim())chunks.push(cur.trim());
  cur=p;
  while(cur.length>TEXT_LIMIT){chunks.push(cur.slice(0,TEXT_LIMIT).trim());cur=cur.slice(TEXT_LIMIT);}
 }
 if(cur.trim())chunks.push(cur.trim());
 if(chunks.length>maxChunks){
  const kept=chunks.slice(0,maxChunks);
  kept[maxChunks-1]=kept[maxChunks-1].slice(0,TEXT_LIMIT-1)+'…';
  return kept;
 }
 return chunks;
};
const messages=[];
if(card && reply.length<=640){
 // Best case: a single message that carries both the answer and the buttons.
 messages.push({attachment:{type:'template',payload:{template_type:'button',text:reply,buttons:card.buttons}}});
} else if(card){
 for(const t of splitText(reply,MAX_MESSAGES-1))messages.push({text:t});
 messages.push({attachment:{type:'template',payload:{template_type:'button',text:card.intro,buttons:card.buttons}}});
} else {
 for(const t of splitText(reply,MAX_MESSAGES))messages.push({text:t});
}
// V24 quick replies (Messenger shows them as tappable chips under the last message; they are not extra messages).
const qr=(titles)=>titles.map((title,i)=>({content_type:'text',title:title.slice(0,20),payload:'TIEN404:QR:'+(i+1)}));
let quickReplies=null;
const isGreeting=current.mediaType==='postback' || (current.mediaType==='text' && normalizedInput.trim().length<=40 && /^(?:xin chao|chao|hi|hello|alo|shop oi|ad oi|hey)\b/.test(normalizedInput.trim()));
if(current.mediaType==='product_detail' && current.selectedSku){
 if(/chưa tìm thấy/i.test(reply))quickReplies=qr(['Gợi ý giúp mình','Xem áo','Xem quần']);
 else if(/hết hàng/i.test(reply))quickReplies=qr(['Xem mẫu tương tự','Xem mẫu khác']);
 else if(/Còn \d+ cái/.test(reply))quickReplies=qr(['Đặt '+current.selectedSku,'Xem mẫu khác']);
} else if(isGreeting){
 // V27.2: greeting chips follow mock-up 01 (3 quick choices). "Xem sản phẩm" opens the published catalog
 // carousel; the other two keep their old payload so the existing text routing is unchanged.
 quickReplies=[{content_type:'text',title:'Xem sản phẩm',payload:'T404:M:catalog'},
  {content_type:'text',title:'Tra cứu đơn',payload:'TIEN404:QR:3'},{content_type:'text',title:'Gặp nhân viên',payload:'TIEN404:QR:4'}];
}
if(quickReplies && messages.length)messages[messages.length-1].quick_replies=quickReplies;
const capped=messages.slice(0,MAX_MESSAGES);
return capped.map((messengerMessage,index)=>({json:{messengerMessage,messageIndex:index+1,messageCount:capped.length,pageId:current.pageId,senderId:current.senderId,messageId:current.messageId,receivedAt:current.receivedAt,replyText:reply.slice(0,TEXT_LIMIT)}}));


