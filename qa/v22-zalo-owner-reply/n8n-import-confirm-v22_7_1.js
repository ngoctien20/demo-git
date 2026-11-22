// V22.7.2: owner confirm for a pending file import. Accepts natural replies ("ok", "đồng ý", "nhập đi", "xác nhận"…), with or without accents.
// strict = message clearly names the import (xác nhận / nhập); loose words ("ok", "có"…) only act when a file is waiting.
if($input.first()?.json?.decision!=='eligible_for_shadow')return [];
let e={};try{e=$('V1 normalized input').first().json||{}}catch(_){return []}
if(e.stage!=='READ_ONLY'||e.accepted!==true||e.eventName!=='message.text.received'||e.chatType!=='PRIVATE'||typeof e.text!=='string')return [];
const t=e.text.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/gi,'d').toUpperCase().replace(/[^A-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
if(!t||t.length>60)return [];
const w=t.split(' ');
if(w.length>8)return [];
const NEG=new Set(['KHONG','KO','KHG','HONG','CHUA','HUY','DUNG','THOI','NO','DUNGLAI','DEP','KHOAN','DOI','NHUNG','SAI']);
if(w.some(x=>NEG.has(x)))return [];
if(/\b(F|SP)?\d|\bGIA\b|\bMUA\b/.test(t))return []; // product / price talk goes to the normal route
const has=p=>(' '+t+' ').includes(' '+p+' ');
const STRICT=['XAC NHAN','XACNHAN','XN','NHAP','IMPORT'];
const LOOSE=['OK','OKE','OKI','OKAY','OKELA','YES','Y','CO','DONG Y','LUU','GHI','CHOT','DUYET','DUOC','U','UH','UHM','UM','VANG','DA','TIEN HANH','LAM DI','DI','DUOC ROI','CHUAN'];
const strict=STRICT.some(has);
if(!strict&&!LOOSE.some(has))return [];
return [{json:{confirm:true,strict}}];
