// V22.3/V22.6 owner-only media gate: same allowlist rule as the text owner gate. No send, no write.
let e={};try{e=$('V1 normalized input').first().json||{}}catch(_){return []}
if(!['voice','image','sticker','file'].includes(e.mediaType))return [];
// V22.7 files: owner product sheets only (.xlsx/.csv, <= 2 MB).
if(e.mediaType==='file'&&(!/\.(xlsx|csv)$/i.test(String(e.mediaCaption||''))||!(e.fileSize>0&&e.fileSize<=2*1024*1024)))return [];
if(e.stage!=='READ_ONLY'||e.chatType!=='PRIVATE'||typeof e.chatId!=='string'||!e.chatId||typeof e.messageId!=='string'||!/^[A-Za-z0-9_-]{4,120}$/.test(e.messageId)||typeof e.mediaUrl!=='string'||!/^https:\/\/\S{8,1500}$/.test(e.mediaUrl))return [];
const rows=$input.all().map(i=>i.json||{});
const ok=rows.length===1&&rows[0].status==='ALLOWED_STAGING_OWNER'&&rows[0].chat_id===e.chatId&&Number.isFinite(Date.parse(rows[0].expires_at))&&Date.parse(rows[0].expires_at)>Date.now();
if(!ok)return [];
return [{json:{mediaType:e.mediaType,mediaUrl:e.mediaUrl,mediaCaption:String(e.mediaCaption||''),fileExt:(String(e.mediaCaption||'').match(/\.(xlsx|csv)$/i)||['',''])[1].toLowerCase()}}];
