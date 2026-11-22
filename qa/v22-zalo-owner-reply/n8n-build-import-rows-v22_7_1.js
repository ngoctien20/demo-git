// V22.7.2: pending import -> sandbox catalog rows (Shop B only). Re-validates every row.
// A loose "ok"/"có" with nothing pending stays silent; only a clear "xác nhận nhập" gets the "nothing pending" reply.
const p=$input.first()?.json||{};
let strict=true;try{strict=$('V22 Import Confirm?').first().json.strict===true}catch(_){}
const fresh=typeof p.rows_json==='string'&&p.rows_json.length>2&&Date.now()-Date.parse(p.created_at)<=15*60*1000;
if(!fresh)return strict?[{json:{has:false}}]:[];
let rows=[];try{rows=JSON.parse(p.rows_json)}catch(_){rows=[]}
const now=new Date().toISOString(),seen=new Set(),out=[];
for(const r of Array.isArray(rows)?rows.slice(0,100):[]){
  const sku=String(r&&r.sku||'').toUpperCase();
  if(!/^[A-Z0-9-]{1,20}$/.test(sku)||seen.has(sku))continue;
  if(!Number.isSafeInteger(r.price_vnd)||r.price_vnd<1||r.price_vnd>1e9||!Number.isSafeInteger(r.stock)||r.stock<0||r.stock>1e6)continue;
  seen.add(sku);
  out.push({json:{has:true,tenant_key:'qa-tenant-b',store_key:'qa-store-b',bot_key:'qa-bot-b',sku,product_name:String(r.product_name||'').slice(0,120),price_vnd:r.price_vnd,stock:r.stock,snapshot_at:now,source:'OWNER_FILE_IMPORT_QA'}});
}
return out.length?out:(strict?[{json:{has:false}}]:[]);
