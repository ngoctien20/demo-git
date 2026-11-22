// V22.7.1: owner text "Xác nhận nhập" (eligible owner only).
if($input.first()?.json?.decision!=='eligible_for_shadow')return [];
let e={};try{e=$('V1 normalized input').first().json||{}}catch(_){return []}
if(e.stage!=='READ_ONLY'||e.accepted!==true||e.eventName!=='message.text.received'||e.chatType!=='PRIVATE'||typeof e.text!=='string')return [];
const t=e.text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toUpperCase().replace(/[^A-Z ]+/g,' ').replace(/\s+/g,' ').trim();
if(t!=='XAC NHAN NHAP')return [];
return [{json:{confirm:true}}];
