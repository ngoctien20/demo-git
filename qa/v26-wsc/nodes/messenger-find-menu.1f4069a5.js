// V21 menu: find which menu button (if any) this message came from. Read-only; the payload only names an item id.
const body=$('Webhook1').first().json.body??{};
const pay=new Map();
for(const en of (Array.isArray(body.entry)?body.entry:[]))for(const e of (Array.isArray(en.messaging)?en.messaging:[])){
 const m=e.message??{};const sid=String(e.sender?.id??'');let ts=Number(e.timestamp??0);if(ts>0&&ts<1e12)ts*=1000;
 const id=String(m.mid??e.postback?.mid??'').trim()||(e.postback?'pb_'+sid+'_'+String(ts||0):'');
 const p=e.postback?String(e.postback.payload??''):String(m.quick_reply?.payload??'');
 if(id&&p.length<=40&&(p.startsWith('T404:M:')||p==='TIEN404:START'))pay.set(id,p);
}
return $input.all().map((it,i)=>{const j={...it.json};const p=pay.get(String(j.messageId??''));
 if(p&&!j.selectedSku&&(p!=='TIEN404:START'||j.mediaType==='postback'))j.menuPayload=p;
 return {json:j,pairedItem:{item:i}};});

