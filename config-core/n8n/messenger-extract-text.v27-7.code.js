const payload=$('Webhook1').first().json.body??{};
const allowedPage='2379295362359912';
if(payload.object!=='page'||!Array.isArray(payload.entry))return [];
// V22 fast path: only a clear single-SKU question (e.g. "Xem A003", "A003 giá bao nhiêu") skips the AI.
const detectSku=text=>{
 const norm=text.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[?!.,~…]+/g,' ').replace(/\s+/g,' ').trim();
 const all=norm.match(/\b[a-z]\d{3}\b/g)||[];
 if(new Set(all).size!==1)return null;
 const re=/^(?:(?:cho (?:em|minh|toi|chi|anh|e|m) )?(?:xem|check|coi|hoi|tu van|xin) )?(?:(?:thong tin|gia) )?(?:(?:mau|ma|sp|san pham) )?([a-z]\d{3})(?: (?:gia bao nhieu|bao nhieu tien|bao nhieu|gia sao|gia|con hang khong|con hang ko|con khong|con ko|con k|con hang|con|thong tin|the nao|sao|nhe|nha|a|ah|voi|di|shop|ad))*$/;
 const m=re.exec(norm);
 return m?m[1].toUpperCase():null;
};
const menuQuestions={
 'TIEN404:ASK:catalog':'Shop đang có những sản phẩm nào?',
 'TIEN404:ASK:ao':'Shop có những mẫu áo nào?',
 'TIEN404:ASK:quan':'Shop có những mẫu quần nào?',
 'TIEN404:ASK:order':'Tôi muốn tra cứu đơn hàng của tôi',
 'TIEN404:ASK:human':'Tôi muốn gặp nhân viên tư vấn'
};
// V27.7: nhân viên tự trả lời trong Hộp thư Trang (echo không do app bot gửi) → bot im với khách đó 30 phút.
const BOT_APP_ID='1637989744444198';
const STAFF_PAUSE_MS=30*60000;
const store=$getWorkflowStaticData('global');
const pause=(store.staffPause&&typeof store.staffPause==='object')?store.staffPause:{};
const nowMs=Date.now();
for(const k of Object.keys(pause))if(!(Number(pause[k])>nowMs))delete pause[k];
for(const entry of payload.entry){
 if(String(entry?.id??'')!==allowedPage||!Array.isArray(entry?.messaging))continue;
 for(const e of entry.messaging){
  const m=e?.message;
  if(!m||m.is_echo!==true)continue;
  if(String(m.app_id??'')===BOT_APP_ID)continue;
  const psid=String(e.recipient?.id??'');
  if(String(e.sender?.id??'')!==allowedPage||!/^\d{5,30}$/.test(psid))continue;
  pause[psid]=nowMs+STAFF_PAUSE_MS;
 }
}
const keys=Object.keys(pause);
if(keys.length>500)for(const k of keys.sort((x,y)=>pause[x]-pause[y]).slice(0,keys.length-500))delete pause[k];
store.staffPause=pause;
const out=[];const seen=new Set();
for(const entry of payload.entry){
 const pageId=String(entry.id??'');
 if(pageId!==allowedPage||!Array.isArray(entry.messaging))continue;
 for(const e of entry.messaging){
  if(!e.message&&!e.postback&&!e.referral)continue;
  const m=e.message??{};
  if(m.is_echo===true||m.is_deleted===true||m.is_unsupported===true)continue;
  const senderId=String(e.sender?.id??'');
  const recipientId=String(e.recipient?.id??'');
  if(!/^\d{5,30}$/.test(senderId)||recipientId!==allowedPage)continue;
  if(Number(pause[senderId])>nowMs)continue; // nhân viên đang trả lời khách này
  let ts=Number(e.timestamp??0);
  if(ts>0&&ts<1e12)ts*=1000; // referral events send seconds
  if(ts>0&&(ts>Date.now()+300000||Date.now()-ts>23*3600000))continue;
  let chatInput=typeof m.text==='string'?m.text.trim():'';
  let mediaType='text';
  let selectedSku;
  let fastPath;
  let memoryUserText;
  let audioUrl;
  const isSticker=!chatInput&&Array.isArray(m.attachments)&&m.attachments.some(a=>a?.type==='sticker'||a?.payload?.sticker_id);
  if(isSticker){
   // V26: sticker (vd nút like 👍) không phải ảnh sản phẩm.
   mediaType='sticker';
   chatInput='Khách vừa gửi một nhãn dán (sticker) như 👍, không có chữ. Đáp lại đúng 1 câu ngắn thân thiện và hỏi khách cần shop hỗ trợ gì. (Ghi chú nội bộ, không nhắc với khách: sticker KHÔNG phải xác nhận đặt hàng; chỉ khi shop đang chờ khách xác nhận đơn thì mới xin khách xác nhận bằng chữ.)';
  } else if(!chatInput&&Array.isArray(m.attachments)&&m.attachments.length){
   const type=String(m.attachments[0]?.type??'file').toLowerCase();
   mediaType=['image','video','audio','file','fallback'].includes(type)?type:'file';
   // V24.1: tin thoại từ CDN của Meta → nghe qua TIEN404 VOICE (F7EhVGWIALKWg8Y6) trước vòng lặp.
   const url=String(m.attachments[0]?.payload?.url??'');
   if(mediaType==='audio'&&url.length<=2000&&/^https:\/\/[a-z0-9.-]+\.(?:fbcdn\.net|fbsbx\.com)\//i.test(url)){mediaType='voice';audioUrl=url;chatInput='[Tin nhắn thoại]';}
   else{
   const label={image:'ảnh',video:'video',audio:'tin nhắn thoại',file:'tệp',fallback:'tệp'};
   chatInput='Khách vừa gửi '+label[mediaType]+'. Hệ thống chưa phân tích được nội dung tệp, hãy lịch sự xin khách mô tả sản phẩm hoặc yêu cầu bằng chữ. Không giả vờ đã xem/nghe.';
   }
  }
  if(e.postback){
   const action=String(e.postback.payload??'');
   const selected=/^TIEN404:VIEW:([A-Z][0-9]{3})$/.exec(action);
   if(selected){
    selectedSku=selected[1];
    mediaType='product_detail';
    fastPath='postback';
    memoryUserText='Tôi vừa bấm nút Xem '+selectedSku;
    chatInput='Xem thông tin mẫu '+selectedSku;
   } else if(action.startsWith('T404:C:')){
   // Catalog cursor is authorized by the published menu bridge, never by its text.
   mediaType='postback';
   chatInput='Khách vừa chọn trang khác của danh mục sản phẩm.';
   } else if(action==='TIEN404:START'){
   mediaType='postback';
   chatInput='Khách vừa nhấn Bắt đầu trò chuyện. Chào khách và hỏi muốn tư vấn sản phẩm hay hỗ trợ đơn hàng.';
   } else if(menuQuestions[action]){
   // V24: persistent menu / ice breaker buttons become the customer's own question.
   mediaType='text';
   chatInput=menuQuestions[action];
   } else if(action.startsWith('TIEN404:')){continue;} else {
   mediaType='postback';
   chatInput='Khách vừa nhấn Bắt đầu trò chuyện. Chào khách và hỏi muốn tư vấn sản phẩm hay hỗ trợ đơn hàng.';
   }
  } else if(e.referral&&!e.message){
   // handled below
  } else if(mediaType==='text'&&chatInput&&chatInput.length<=80&&!chatInput.startsWith('QA_CORE:')){
   const sku=detectSku(chatInput);
   if(sku){selectedSku=sku;mediaType='product_detail';fastPath='text';memoryUserText=chatInput;}
  }
  // V26: link m.me/...?ref=SKU hoặc quảng cáo có ref -> gửi luôn giá/tồn của mẫu đó (không AI).
  const refRaw=String((e.referral||e.postback?.referral||{}).ref??'').trim().toUpperCase();
  const refSku=/^[A-Z][0-9]{3}$/.test(refRaw)?refRaw:null;
  if(e.referral&&!e.message&&!e.postback&&!refSku)continue;
  if(refSku&&(!e.message||e.postback)&&(!e.postback||mediaType==='postback')){
   selectedSku=refSku;mediaType='product_detail';fastPath='referral';
   memoryUserText='Tôi mở link xem mẫu '+refSku;chatInput='Xem thông tin mẫu '+refSku;
  }
  if(!chatInput||chatInput.length>1800)continue;
  const rawId=String(m.mid??e.postback?.mid??'').trim();
  const messageId=rawId||(e.postback?'pb_'+senderId+'_'+String(ts||0):e.referral?'ref_'+senderId+'_'+String(ts||0):'attachment_'+senderId+'_'+String(ts||0));
  if(messageId.length<4||messageId.length>512||/\s/.test(messageId))continue;
  if(seen.has(messageId))continue;
  seen.add(messageId);
  out.push({json:{pageId,senderId,messageId,chatInput,mediaType,...(selectedSku?{selectedSku,fastPath,memoryUserText}:{}),...(audioUrl?{audioUrl}:{}),sessionId:'messenger:'+pageId+':'+senderId,receivedAt:new Date().toISOString()},pairedItem:{item:0}});
 }
}
return out;

