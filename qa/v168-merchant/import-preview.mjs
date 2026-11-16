/* TIEN404 V16.8: browser-local synthetic CSV/XLSX preview only.
 * NO upload, NO network, NO database, NO Orders, NO persistence.
 * XLSX: first worksheet, plain strings/numbers/inline strings, no formulas.
 * It is deliberately not a full commercial Excel import engine.
 */
export const IMPORT_CONTRACT='T404_V168_SYNTHETIC_IMPORT_PREVIEW_ONLY';
export const MARKER='QA_V168_SYNTHETIC_ONLY';
export const HEADERS=Object.freeze(['fixture_marker','sku','product_name','retail_price_vnd','wholesale_price_vnd','stock','unit']);
export const MAX_SOURCE_BYTES=2*1024*1024;
const fail=x=>{throw Error(x)};
const text=v=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=120&&!/[\u0000-\u001f\u007f<>]/.test(v);
const exact=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const id=v=>typeof v==='string'&&/^QA_STORE_[A-Z]$/.test(v);
const number=(v,allowBlank=false)=>{
 if(v===''&&allowBlank)return null;
 if(typeof v!=='string'||! /^(?:0|[1-9]\d{0,11})$/.test(v))fail('INVALID_VND_OR_STOCK');
 const x=Number(v);if(!Number.isSafeInteger(x))fail('INVALID_VND_OR_STOCK');return x;
};
export function parseCsv(source){
 if(typeof source!=='string'||new TextEncoder().encode(source).length>MAX_SOURCE_BYTES)fail('CSV_LIMIT');
 const value=source.replace(/^\uFEFF/,'');
 if(!value.trim())fail('EMPTY_FILE');
 const firstLine=value.split(/\r?\n/,1)[0];
 const delim=['\t',';',','].sort((a,b)=>firstLine.split(b).length-firstLine.split(a).length)[0];
 const rows=[];let row=[],cell='',inQuotes=false;
 for(let i=0;i<value.length;i++){
  const c=value[i];
  if(inQuotes){
   if(c==='"'&&value[i+1]==='"'){cell+='"';i++}
   else if(c==='"')inQuotes=false;
   else cell+=c;
  }else if(c==='"'){
   if(cell!=='')fail('CSV_MALFORMED_QUOTE');
   inQuotes=true;
  }else if(c===delim){row.push(cell);cell=''}
  else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell=''}
  else cell+=c;
 }
 if(inQuotes)fail('CSV_UNTERMINATED_QUOTE');
 if(cell!==''||row.length){row.push(cell.replace(/\r$/,''));rows.push(row)}
 if(rows.length>502)fail('CSV_ROW_LIMIT');
 return rows.filter(r=>r.some(x=>x!==''));}
const decodeXml=s=>s.replace(/&#x([a-fA-F0-9]+);|&#([0-9]+);|&(amp|lt|gt|quot|apos);/g,(all,h,d,n)=>{
 if(h||d){const cp=parseInt(h||d,h?16:10);return cp>0&&cp<=0x10FFFF?String.fromCodePoint(cp):'�'}
 return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[n]||all;
});
const attr=(s,n)=>{const m=new RegExp('(?:^|\\s)'+n+'="([^"]*)"').exec(s);return m?m[1]:null};
const tagValue=(s,name)=>{
 const m=new RegExp('<(?:\\w+:)?'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?'+name+'>').exec(s);
 return m?decodeXml(m[1].replace(/<[^>]+>/g,'')):null;
};
function xlsxRows(xml,sharedStrings){
 if(/<(?:\w+:)?f(?:\s|>)/.test(xml))fail('XLSX_FORMULA_REFUSED');
 const rows=[];
 for(const match of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
  const cells=[];
  for(const c of match[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
   const ref=attr(c[1],'r');if(!ref)fail('XLSX_CELL_REFERENCE_MISSING');
   const m=/^([A-Z]+)(\d+)$/.exec(ref);if(!m)fail('XLSX_CELL_REFERENCE_INVALID');
   let idx=0;for(const ch of m[1])idx=idx*26+ch.charCodeAt(0)-64;
   idx--;if(idx>40)fail('XLSX_COLUMN_LIMIT');
   const v=tagValue(c[2],'v');
   let cell;
   if(attr(c[1],'t')==='inlineStr'){cell=tagValue(c[2],'t')??''}
   else if(attr(c[1],'t')==='s'){
    if(!/^\d+$/.test(v??''))fail('XLSX_SHARED_INDEX_INVALID');
    cell=sharedStrings[Number(v)];if(cell===undefined)fail('XLSX_SHARED_INDEX_INVALID');
   }else cell=v??'';
   cells[idx]=cell;
  }
  rows.push(Array.from({length:HEADERS.length},(_,i)=>cells[i]??''));
  if(rows.length>502)fail('XLSX_ROW_LIMIT');
 }
 return rows;
}
const dvread=(v,pos,length)=>{if(pos<0||pos+length>v.byteLength)fail('XLSX_ZIP_BOUNDS')};
async function unzipFirstSheet(buf){
 const v=new DataView(buf);let end=-1;
 for(let i=v.byteLength-22;i>=Math.max(0,v.byteLength-65557);i--){
  if(v.getUint32(i,true)===0x06054b50){end=i;break}
 }
 if(end<0)fail('XLSX_CENTRAL_DIR_MISSING');
 const count=v.getUint16(end+10,true),central=v.getUint32(end+16,true);
 if(count>100)fail('XLSX_TOO_MANY_FILES');
 let pos=central,total=0;const entries=new Map(),decoder=new TextDecoder();
 for(let i=0;i<count;i++){
  dvread(v,pos,46);if(v.getUint32(pos,true)!==0x02014b50)fail('XLSX_ZIP_CENTRAL_INVALID');
  const method=v.getUint16(pos+10,true),compressed=v.getUint32(pos+20,true),
   plain=v.getUint32(pos+24,true),len=v.getUint16(pos+28,true),
   extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true),
   local=v.getUint32(pos+42,true);
  dvread(v,pos+46,len+extra+comment);
  const name=decoder.decode(new Uint8Array(buf,pos+46,len));
  if(name.includes('..')||name.startsWith('/')||entries.has(name)||name.includes('\\'))fail('XLSX_ZIP_PATH_INVALID');
  total+=plain;if(total>8*1024*1024||plain>4*1024*1024)fail('XLSX_DECOMPRESSION_LIMIT');
  entries.set(name,{method,compressed,plain,local});
  pos+=46+len+extra+comment;
 }
 for(const name of entries.keys()){
  if(/vbaProject|externalLinks|connections\.xml|_rels\/external|customXml/i.test(name))fail('XLSX_UNTRUSTED_FEATURE');
 }
 async function load(name){
  const e=entries.get(name);if(!e)return null;
  dvread(v,e.local,30);if(v.getUint32(e.local,true)!==0x04034b50)fail('XLSX_ZIP_LOCAL_INVALID');
  const start=e.local+30+v.getUint16(e.local+26,true)+v.getUint16(e.local+28,true);
  dvread(v,start,e.compressed);
  const bytes=new Uint8Array(buf,start,e.compressed),data=e.method===0?bytes:
   e.method===8?new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(
    new DecompressionStream('deflate-raw'))).arrayBuffer()):fail('XLSX_COMPRESSION_NOT_SUPPORTED');
  if(data.length!==e.plain||data.length>4*1024*1024)fail('XLSX_DECOMPRESSION_MISMATCH');
  return decoder.decode(data);
 }
 const xml=await load('xl/worksheets/sheet1.xml');
 if(!xml)fail('XLSX_SHEET1_NOT_FOUND');
 const shared=await load('xl/sharedStrings.xml');
 const strings=[];
 if(shared)for(const si of shared.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)){
  strings.push([...si[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x=>decodeXml(x[1])).join(''));
 }
 return xlsxRows(xml,strings);
}
export async function parseXlsx(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength>MAX_SOURCE_BYTES||buffer.byteLength<22)fail('XLSX_LIMIT');
 return unzipFirstSheet(buffer);
}
export function previewImport({store_id,rows,existing=[]}){
 if(!id(store_id))fail('QA_STORE_SCOPE_REQUIRED');
 if(!Array.isArray(rows)||rows.length<2||rows.length>501||!Array.isArray(rows[0]))fail('IMPORT_ROWS_INVALID');
 const heads=rows[0].map(s=>typeof s==='string'?s.trim():'');
 if(!exact(heads,HEADERS))fail('UNSUPPORTED_HEADERS_OR_CUSTOMER_PII');
 const old=new Map(existing.map(x=>[x.sku,x]));
 const seen=new Set(),result=[];
 rows.slice(1).forEach((row,n)=>{
  const reasons=[];let sku='',name='',retail=null,wholesale=null,stock=null,unit='';
  if(!Array.isArray(row)||row.length!==HEADERS.length){reasons.push('COLUMN_COUNT_INVALID')}
  else {
   const [marker,vsku,vname,vretail,vwholesale,vstock,vunit]=row.map(x=>String(x).trim());
   if(marker!==MARKER)reasons.push('NOT_SYNTHETIC_FIXTURE');
   sku=vsku;name=vname;unit=vunit;
   if(!/^([A-Z][A-Z0-9_-]{1,23})$/.test(sku))reasons.push('SKU_INVALID');
   if(!text(name)||/^[=+@-]/.test(name))reasons.push('NAME_INVALID_OR_FORMULA');
   if(!text(unit)||/^[=+@-]/.test(unit))reasons.push('UNIT_INVALID');
   try{retail=number(vretail);wholesale=number(vwholesale,true);stock=number(vstock)}
   catch{reasons.push('PRICE_OR_STOCK_INVALID')}
   if(retail!==null&&retail>100000000000)reasons.push('PRICE_TOO_LARGE');
   if(stock!==null&&stock>1000000)reasons.push('STOCK_TOO_LARGE');
   if(retail!==null&&wholesale!==null&&wholesale>retail)reasons.push('WHOLESALE_GREATER_THAN_RETAIL');
   if(seen.has(sku))reasons.push('DUPLICATE_SKU_IN_BATCH');seen.add(sku);
  }
  const before=old.get(sku)||null;
  const valid=reasons.length===0;
  const changes=valid&&before?['name','price_vnd','stock','unit'].filter(k=>
    (k==='name'?name:k==='price_vnd'?retail:k==='stock'?stock:unit)!==before[k]):[];
  result.push(Object.freeze({row:n+2,sku,product_name:name,retail_price_vnd:retail,
    wholesale_price_vnd:wholesale,stock,unit,valid,reasons,status:valid?(before?'UPDATE_PREVIEW':'CREATE_PREVIEW'):'REJECTED',
    prior_price_vnd:before?.price_vnd??null,changed_fields:changes,not_committed:true}));
 });
 return Object.freeze({contract:IMPORT_CONTRACT,store_id,total:result.length,
  accepted:result.filter(x=>x.valid).length,rejected:result.filter(x=>!x.valid).length,
  rows:Object.freeze(result),source:'LOCAL_SYNTHETIC_FILE_ONLY',upload_to_server:false,
  database_writes:0,order_writes:0,no_send:true});
}
export function sampleCsvForStore(store){
 if(!id(store))fail('QA_STORE_SCOPE_REQUIRED');
 const p=store==='QA_STORE_A'?['SAME01','Gạo A',159000,120000,12,'túi']:
  store==='QA_STORE_B'?['SAME01','Áo B',209000,180000,7,'cái']:
  ['SAME01','Xi măng C',259000,230000,3,'bao'];
 return HEADERS.join(',')+'\n'+[MARKER,...p].join(',')+'\n';
}
export function acceptRealMerchantFile(){fail('REAL_MERCHANT_DATA_INGRESS_BLOCKED')}
export function commitImport(){fail('IMPORT_WRITE_BLOCKED')}
