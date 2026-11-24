// V21 menu: apply the bridge decision. ai/handoff -> same sentence a customer would type (existing AI / handoff path);
// greeting/direct/rejected -> fixed reply from the published menu; anything else (legacy, read error) -> unchanged.
const origs=$('Nút menu đã cấu hình?').all(0);
const ds=$input.all();
return origs.map((it,i)=>{
 const o={...it.json};const d=(ds[i]&&ds[i].json)||{};
 delete o.menuPayload;
 o.menuMode=String(d.mode||'error');o.menuConfigVersion=d.configVersion??null;
 // V21: propagate only an allowlisted handoff team; never trust a client-supplied acknowledgment.
 if(d.mode==='handoff'&&['sales','page_admin','booking','consultant','support','manager'].includes(d.team))o.menuHandoffTeam=d.team;
 if(d.mode==='catalog'){
  const good=typeof d.itemId==='string'&&/^[a-z][a-z0-9_]{1,31}$/.test(d.itemId)&&
    Number.isSafeInteger(d.catalogPage)&&d.catalogPage>=1&&d.catalogPage<=99&&
    Number.isSafeInteger(d.configVersion)&&d.configVersion>=1&&d.configVersion<=999999999;
  if(good){
   o.mediaType='catalog_page';o.catalogItemId=d.itemId;o.catalogPage=d.catalogPage;
   o.catalogCategory=typeof d.catalogCategory==='string'?d.catalogCategory:null;
   o.catalogVersion=d.configVersion;
   o.catalogDigest=(typeof d.catalogDigest==='string'&&/^[0-9a-f]{8}$/.test(d.catalogDigest))?d.catalogDigest:null;
   o.chatInput='Khách vừa yêu cầu xem trang danh mục sản phẩm.';
  }else{o.mediaType='menu_reply';o.menuMessage={text:'Danh mục chưa khả dụng. Bạn hãy mở lại mục Xem sản phẩm nhé.'};}
 }
 else if((d.mode==='ai'||d.mode==='handoff')&&typeof d.chatInput==='string'&&d.chatInput){o.chatInput=d.chatInput;o.mediaType='text';}
 else if(d.mode==='greeting'||d.mode==='direct'||d.mode==='rejected'){
  const msg=d.mode==='direct'?{text:d.replyText}:d.message;
  if(msg&&typeof msg.text==='string'&&msg.text.trim()){o.mediaType='menu_reply';o.menuMessage=msg;}
 }
 return {json:o,pairedItem:{item:i}};
});
