// V21 menu: find which menu button (if any) this message came from. Read-only; the payload only names an item id.
const body=$('Webhook1').first().json.body??{};
const pay=new Map();
for(const en of (Array.isArray(body.entry)?body.entry:[]))for(const e of (Array.isArray(en.messaging)?en.messaging:[])){
 const m=e.message??{};const sid=String(e.sender?.id??'');const page=String(en.id??'');let ts=Number(e.timestamp??0);if(ts>0&&ts<1e12)ts*=1000;
 const id=String(m.mid??e.postback?.mid??'').trim()||(e.postback?'pb_'+sid+'_'+String(ts||0):e.message?'attachment_'+sid+'_'+String(ts||0):'');
 let p=e.postback?String(e.postback.payload??''):String(m.quick_reply?.payload??'');
 // V27.2: the Page's old ☰ "Xem sản phẩm" / ice-breaker payload opens the same published catalog item.
 if(p==='TIEN404:ASK:catalog')p='T404:M:catalog';
 if(id&&page&&sid&&p.length<=100&&(p.startsWith('T404:M:')||p.startsWith('T404:C:')||p==='TIEN404:START')){
  const key=JSON.stringify([page,sid,id]);
  if(!pay.has(key))pay.set(key,p);
 }
}
return $input.all().map((it,i)=>{const j={...it.json};const p=pay.get(JSON.stringify([String(j.pageId??''),String(j.senderId??''),String(j.messageId??'')]));
 if(p&&!j.selectedSku&&(p!=='TIEN404:START'||j.mediaType==='postback'))j.menuPayload=p;
 return {json:j,pairedItem:{item:i}};});

