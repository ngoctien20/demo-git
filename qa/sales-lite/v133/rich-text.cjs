'use strict';
// Zalo Bot sendMessage text_styles validator. Official st schema, UTF-16 positions.
// This module NEVER calls an API. Source: docs.zaloplatforms.com/docs/BOT/apis/sendMessage
const ST=new Set(['b','i','u','s','f_13','f_15','f_18','f_20','c_050a19','c_15a85f',
 'c_f7b503','c_f27806','c_db342e','lst_1','lst_2','ind_1','ind_2','ind_3','ind_4','ind_5']);
const fail=c=>{const e=new Error(c);e.code=c;throw e;};
function boundary(t,i){return !(i>0&&i<t.length&&/[\uD800-\uDBFF]/.test(t[i-1])&&/[\uDC00-\uDFFF]/.test(t[i]));}
function validateRichDraft({text,text_styles=[],parse_mode=null}={}){
 if(typeof text!=='string'||text.length<1||text.length>2000)fail('TEXT_LENGTH_INVALID');
 if(parse_mode!==null&&parse_mode!==undefined){
  if(!['markdown','html'].includes(parse_mode))fail('PARSE_MODE_INVALID');
  if(text_styles.length)fail('PARSE_MODE_AND_STYLES_CONFLICT');
  return Object.freeze({text,parse_mode,send_enabled:false,providerPayload:null});
 }
 if(!Array.isArray(text_styles)||text_styles.length>100)fail('TEXT_STYLES_INVALID');
 const styles=text_styles.map(run=>{
  if(!run||!Number.isSafeInteger(run.start)||!Number.isSafeInteger(run.len)||
    run.start<0||run.len<1||run.start+run.len>text.length||!boundary(text,run.start)||!boundary(text,run.start+run.len))fail('UTF16_RANGE_INVALID');
  if(!Array.isArray(run.st)||!run.st.length||run.st.some(s=>!ST.has(s))||new Set(run.st).size!==run.st.length)fail('STYLE_NOT_WHITELISTED');
  return Object.freeze({start:run.start,len:run.len,st:Object.freeze([...run.st])});
 });
 return Object.freeze({text,text_styles:Object.freeze(styles),send_enabled:false,providerPayload:null});
}
module.exports={validateRichDraft,STYLE_CODES:ST};
