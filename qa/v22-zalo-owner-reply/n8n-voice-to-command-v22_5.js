// V22.5 voice understanding: (1) context biasing via prompt (catalog + example commands),
// (2) Gemini returns transcript AND structured intent in one call (JSON schema),
// (3) server-side validation + rule-based fallback on the transcript; low confidence -> ask again.
const deepText=(o,d=0)=>{if(d>8||o==null||typeof o!=='object')return '';if(Array.isArray(o)){for(const x of o){const t=deepText(x,d+1);if(t)return t}return ''}for(const k of ['text','content','output','transcript']){if(typeof o[k]==='string'&&o[k].trim())return o[k]}for(const v of Object.values(o)){const t=deepText(v,d+1);if(t)return t}return ''};
const inp=$input.first()?.json||{};
const raw=inp.error?'':deepText(inp);
let j={};try{const m=raw.match(/\{[\s\S]*\}/);j=JSON.parse(m?m[0]:'{}')||{}}catch(_){j={}}
const heard=String(typeof j.transcript==='string'?j.transcript:(raw&&!raw.trim().startsWith('{')?raw:'')).replace(/\s+/g,' ').trim().slice(0,160);
// rule-based parser (fallback + cross-check)
function rules(h){
 let t=' '+h.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/gi,'d').toUpperCase().replace(/[^A-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim()+' ';
 t=t.replace(/([A-Z0-9])((?:F|EP|EF) ?0 ?1 )/g,'$1 $2').replace(/ (?:MO|MUA|MU|MUO|MOA) /g,' MUA ');
 const skuRe=/ (?:F|EP|EF|ET|EFF|PHO) ?(?:0 ?1|1|KHONG MOT|MOT) /;
 if(!skuRe.test(t))return null;
 t=t.replace(skuRe,' SKU ');
 if(/^ 1 SKU /.test(t))t=t.replace(/^ 1 SKU /,' MUA SKU ');
 const W={KHONG:0,MOT:1,HAI:2,BA:3,BON:4,TU:4,NAM:5,LAM:5,SAU:6,BAY:7,TAM:8,CHIN:9,MUOI:10,MUOT:10};
 for(let i=0;i<2;i++)for(const [w,v] of Object.entries(W))t=t.replace(new RegExp(' '+w+' ','g'),' '+v+' ');
 const nums=(t.match(/ \d{1,4}(?= )/g)||[]).map(x=>Number(x.trim()));
 const buy=/ (?:MUA|LAY|DAT|CHOT) /.test(t);
 if(!buy)return {action:'price',quantity:null};
 if(nums.length===0)return {action:'ask_quantity',quantity:null};
 if(nums.length===1)return {action:'quote',quantity:nums[0]};
 return null;
}
// structured result from the model, validated
let ai=null;
const sku=typeof j.sku==='string'?j.sku.toUpperCase().replace(/\s+/g,''):'';
const conf=['high','medium','low'].includes(j.confidence)?j.confidence:'low';
const q=Number.isSafeInteger(j.quantity)&&j.quantity>=1&&j.quantity<=9999?j.quantity:null;
if(sku==='F01'&&conf!=='low'){
 if(j.intent==='price')ai={action:'price',quantity:null};
 else if(j.intent==='buy')ai=q?{action:'quote',quantity:q}:{action:'ask_quantity',quantity:null};
}
const rb=heard?rules(heard):null;
// agreement policy: model + rules agree -> go; only one side understood -> trust it only if the model is 'high'
let pick=null,how='none';
if(ai&&rb&&ai.action===rb.action&&ai.quantity===rb.quantity){pick=ai;how='agree';}
else if(ai&&conf==='high'&&(!rb||rb.action!=='quote'||ai.action==='quote')){pick=ai;how='ai_high';}
else if(rb&&!ai){pick=rb;how='rules';}
let shown=heard;
if(!shown&&inp.error){const e=typeof inp.error==='string'?inp.error:String(inp.error.message||inp.error);shown='(lỗi AI: '+(/timeout|ECONNABORTED/i.test(e)?'quá 15 giây':e.slice(0,50))+')';}
return [{json:{mediaKind:'voice',understood:!!pick,how,ai_confidence:conf,command:pick?{action:pick.action,sku:'F01',quantity:pick.quantity,owner_gate:'eligible',external_sends:0,orders_written:0,scope:'qa-tenant-b/qa-store-b/qa-bot-b'}:null,echo:{kind:'VOICE_HEARD',transcript:shown,understood:!!pick}}}];
