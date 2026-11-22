const envelope=$input.first()?.json||{};
let body=envelope.body||{};
if(typeof body==='string'){
  try {body=JSON.parse(body);} catch {
    return [{json:{stage:'READ_ONLY',accepted:false,reason:'invalid_json',note:'No outgoing Zalo API or Orders write'}}];
  }
}
const event=body?.result&&typeof body.result==='object'?body.result:body;
const msg=event?.message||{};
const sender=msg.from||{};
const chat=msg.chat||{};
const eventName=String(event?.event_name||'');
const chatType=String(chat?.chat_type||'');
const isBot=sender.is_bot===true||sender.isbot===true;
const messageType=String(msg.message_type||'');
const isText=typeof msg.text==='string'&&(!messageType||messageType==='CHAT_TEXT'||messageType==='TEXT');
const isValid=eventName==='message.text.received'&&isText&&!isBot&&chatType==='PRIVATE'&&!!chat.id&&!!msg.message_id;
// V22.3/V22.6/V22.7: private voice/image/sticker/file events are normalized for the owner-only media branch in OgDZ. accepted stays false,
// so every text path (owner gate, router, core shadow, QA meter) keeps ignoring them.
const mediaType=eventName==='message.voice.received'?'voice':eventName==='message.image.received'?'image':eventName==='message.sticker.received'?'sticker':eventName==='message.file.received'?'file':null;
const mediaUrl=mediaType==='voice'?msg.voice_url:mediaType==='image'?msg.photo_url:mediaType==='sticker'?msg.sticker_url:mediaType==='file'?msg.file_url:null;
const isMedia=!!mediaType&&!isBot&&chatType==='PRIVATE'&&!!chat.id&&!!msg.message_id&&typeof mediaUrl==='string'&&/^https:\/\/[^\s]{8,1500}$/.test(mediaUrl);
if(isMedia){
  return [{json:{stage:'READ_ONLY',accepted:false,reason:'media_event_owner_branch',eventName,chatType,chatId:String(chat.id),messageId:String(msg.message_id),text:'',mediaType,mediaUrl,mediaCaption:mediaType==='file'?String(msg.file_name||'').slice(0,120):typeof msg.caption==='string'?msg.caption.slice(0,200):'',fileSize:mediaType==='file'?Number(msg.file_size)||0:0,note:'Staging only: media handled by owner-only V22 branch'}}];
}
return [{json:{
  stage:'READ_ONLY',
  accepted:isValid,
  reason:isValid?'text_event_accepted':'unsupported_or_incomplete_event',
  eventName,
  chatType,
  chatId:isValid?String(chat.id):null,
  messageId:isValid?String(msg.message_id):null,
  text:isValid?String(msg.text).slice(0,2000):'',
  note:'Staging only: no outgoing Zalo API, no Orders write'
}}];
