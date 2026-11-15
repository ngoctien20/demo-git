'use strict';
/* TIEN404 Zalo Bot Creator capability lab.
   OFFLINE ONLY: builds API-compatible *message bodies without chat_id*, token, HTTP, or sends.
   Based on official /docs/BOT/apis/sendMessage. Does not claim native keyboard/button support.
*/
const {validateRichDraft}=require('../sales-lite/v133/rich-text.cjs');
const ROLES=new Set(['CUSTOMER','OWNER','TIEN404_SUPPORT']);
const fail=(msg)=>{throw new Error(msg);};
function styledMessage(text,runs){
 const v=validateRichDraft({text,text_styles:runs});
 // Includes NO chat_id: only an authorized sender may bind a verified QA recipient server-side.
 return Object.freeze({mode:'TEXT_STYLES',text:v.text,text_styles:v.text_styles,send_enabled:false,provider_tested:false});
}
function markdownMessage(text){
 const v=validateRichDraft({text,parse_mode:'markdown'});
 return Object.freeze({mode:'MARKDOWN',text:v.text,parse_mode:'markdown',send_enabled:false,provider_tested:false});
}
function numberedMenu({role,heading,items}={}){
 if(!ROLES.has(role)||typeof heading!=='string'||!heading.trim()||!Array.isArray(items)||items.length<1||items.length>9)fail('MENU_INVALID');
 const seen=new Set();
 const lines=items.map((item,index)=>{
  if(!item||typeof item.label!=='string'||!item.label.trim()||item.label.length>72||
    typeof item.action_id!=='string'||!/^[A-Z][A-Z0-9_]{2,63}$/.test(item.action_id))fail('MENU_ITEM_INVALID');
  const number=String(index+1);
  if(seen.has(number)||seen.has(item.action_id))fail('MENU_DUPLICATED');
  seen.add(number);seen.add(item.action_id);
  return number+'. '+item.label.trim();
 });
 const text=[heading.trim(),...lines,'Trả lời bằng số để chọn mục.'].join('\n');
 if(text.length>2000)fail('MENU_TEXT_TOO_LONG');
 return Object.freeze({role,ui:'TEXT_NUMBERED_ONLY',native_buttons:false,callback_payload:null,text,
   control_map:Object.freeze(items.map((item,index)=>Object.freeze({number:String(index+1),action_id:item.action_id}))),
   external_sends:0,write_enabled:false});
}
function officialSamples(){
 const a='TIEN404 · SHOP QA\n1. Xem sản phẩm\n2. Hỏi giá\n3. Gửi yêu cầu mua hàng';
 const b='TIEN404 — Xin chào 👋\nDanh mục thử nghiệm';
 const c='TIEN404 đang hỗ trợ bạn ✅';
 return Object.freeze([
  styledMessage(a,[{start:0,len:7,st:['b','f_18','c_15a85f']}]),
  styledMessage(b,[{start:0,len:7,st:['b','c_f27806']},{start:22,len:19,st:['i']}]),
  styledMessage(c,[{start:0,len:c.length,st:['u','c_db342e']}]),
  markdownMessage('**TIEN404**\n{green}Tư vấn sản phẩm{/green}\n1. Xem hàng\n2. Gửi yêu cầu')
 ]);
}
module.exports={styledMessage,markdownMessage,numberedMenu,officialSamples};
