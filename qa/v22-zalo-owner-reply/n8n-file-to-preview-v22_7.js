// V22.7 owner product-file import PREVIEW: validate rows, report counts + coded errors. Writes NOTHING.
const g=$('V22 Media Owner Gate').first().json;
const items=$input.all().map(i=>i.json||{});
const out=(o)=>[{json:{mediaKind:'file',echo:Object.assign({kind:'FILE_IMPORT_PREVIEW',file_name:String(g.mediaCaption||'').slice(0,60)},o)}}];
const unreadable=()=>out({valid_count:0,error_count:1,sample_skus:[],errors:[{row:0,code:'UNREADABLE'}]});
if(!items.length||items[0].error)return unreadable();
const norm=k=>String(k).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/gi,'d').toLowerCase().trim().replace(/[\s-]+/g,'_');
const rows=items.map(r=>{const o={};for(const [k,v] of Object.entries(r))o[norm(k)]=v;return o;});
const need=['sku','ten_san_pham','gia_vnd','ton_kho'];
const keys=new Set(rows.flatMap(r=>Object.keys(r)));
if(!need.every(k=>keys.has(k)))return out({valid_count:0,error_count:1,sample_skus:[],errors:[{row:1,code:'BAD_HEADER'}]});
if(rows.length>500)return out({valid_count:0,error_count:1,sample_skus:[],errors:[{row:0,code:'TOO_MANY'}]});
const int=(v,min,max)=>{if(typeof v==='number')return Number.isSafeInteger(v)&&v>=min&&v<=max?v:null;const s=String(v??'').trim().replace(/[.,\s]/g,'').replace(/(d|vnd|đ)$/i,'');if(!/^-?\d+$/.test(s))return null;const n=Number(s);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null;};
const seen=new Set(),valid=[],errors=[];
rows.forEach((r,i)=>{
  const row=i+2;
  if(need.every(k=>String(r[k]??'').trim()===''))return;
  const sku=String(r.sku??'').trim().toUpperCase();
  let code=null;
  if(!sku)code='NO_SKU';
  else if(!/^[A-Z0-9-]{1,20}$/.test(sku))code='BAD_SKU';
  else if(seen.has(sku))code='DUP_SKU';
  else if(!String(r.ten_san_pham??'').trim())code='NO_NAME';
  else if(int(r.gia_vnd,1,1e9)===null)code='BAD_PRICE';
  else if(int(r.ton_kho,0,1e6)===null)code='BAD_STOCK';
  if(sku&&/^[A-Z0-9-]{1,20}$/.test(sku))seen.add(sku);
  if(code)errors.push({row,code});else valid.push(sku);
});
return out({valid_count:valid.length,error_count:errors.length,sample_skus:valid.slice(0,6),errors:errors.slice(0,5)});
