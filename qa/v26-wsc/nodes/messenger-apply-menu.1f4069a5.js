// V21 menu: apply the bridge decision. ai/handoff -> same sentence a customer would type (existing AI / handoff path);
// greeting/direct/rejected -> fixed reply from the published menu; anything else (legacy, read error) -> unchanged.
const origs=$('Nút menu đã cấu hình?').all(0);
const ds=$input.all();
return origs.map((it,i)=>{
 const o={...it.json};const d=(ds[i]&&ds[i].json)||{};
 delete o.menuPayload;
 o.menuMode=String(d.mode||'error');o.menuConfigVersion=d.configVersion??null;
 if((d.mode==='ai'||d.mode==='handoff')&&typeof d.chatInput==='string'&&d.chatInput){o.chatInput=d.chatInput;o.mediaType='text';}
 else if(d.mode==='greeting'||d.mode==='direct'||d.mode==='rejected'){
  const msg=d.mode==='direct'?{text:d.replyText}:d.message;
  if(msg&&typeof msg.text==='string'&&msg.text.trim()){o.mediaType='menu_reply';o.menuMessage=msg;}
 }
 return {json:o,pairedItem:{item:i}};
});

