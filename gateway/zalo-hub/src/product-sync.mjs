// One explicit choice changes one destination. Source snapshots are versioned on both sides.
import { validProduct, MAX_PRODUCTS } from './lite-commerce.mjs';

const fail = (error, status=409) => ({status,body:{ok:false,error}});
const success = () => ({status:200,body:{ok:true}});

export async function reconcileProduct(env,deps,request,b) {
  if (!['web','zalo'].includes(b.source) || typeof b.sku!=='string' || !b.sku.length || b.sku.length>80 ||
      typeof b.binding!=='string' || !Number.isSafeInteger(b.revision) ||
      !(b.webVersion===null || typeof b.webVersion==='string')) return fail('INVALID_SYNC',400);
  const row=await env.ZH_DB.prepare(`SELECT c.id,c.owner_epoch,k.revision,k.snapshot
    FROM zh_web_stores w JOIN zh_connections c ON c.id=w.connection_id AND c.owner_epoch=w.epoch
    JOIN zh_lite_catalog k ON k.connection_id=c.id AND k.owner_epoch=c.owner_epoch AND k.store_id=c.store_id
    WHERE w.store_id=? AND w.confirmed=1 AND c.status='active'`).bind(b.store_id).first();
  if (!row || row.id+'.'+row.owner_epoch!==b.binding || row.revision!==b.revision) return fail('LINK_CHANGED');
  const catalog=JSON.parse(row.snapshot);
  const bot=catalog.products.find(p=>p.sku===b.sku);
  const headers={apikey:env.ZH_SUPABASE_KEY,authorization:request.headers.get('authorization'),'content-type':'application/json'};
  const base=env.ZH_SUPABASE_URL.replace(/\/+$/,'')+'/rest/v1/';
  // SDK-style filters: exact equality, scoped to the authenticated workspace on every request.
  const params=new URLSearchParams({store_id:'eq.'+b.store_id,sku:'eq.'+b.sku,
    select:'sku,name,price_vnd,stock_on_hand,is_active,updated_at'});
  const response=await deps.fetch(base+'products?'+params,{headers,signal:AbortSignal.timeout(8000)});
  if (!response.ok) return fail('WEB_CATALOG_UNAVAILABLE',503);
  const rows=await response.json();
  if (!Array.isArray(rows) || rows.length>1 || (rows[0] && rows[0].sku!==b.sku)) return fail('WEB_CATALOG_UNAVAILABLE',503);
  const web=rows[0];
  if ((web?.updated_at ?? null)!==b.webVersion) return fail('LINK_CHANGED');
  if (b.source==='zalo') {
    if (!bot || web?.is_active===false) return fail('INVALID_SYNC');
    const write=await deps.fetch(base+'rpc/save_merchant_product_in_store',{method:'POST',headers,
      signal:AbortSignal.timeout(8000),body:JSON.stringify({p_store:b.store_id,p_sku:bot.sku,
        p_name:web?.name ?? bot.name,p_price:bot.price,p_active:true,p_initial_stock:web ? null : bot.stock,
        p_expected_updated_at:b.webVersion})});
    if (write.ok) return success();
    return fail(write.status===409 ? 'LINK_CHANGED' : 'WEB_WRITE_FAILED',write.status===409 ? 409 : 422);
  }
  if (!web) return fail('INVALID_SYNC');
  if (catalog.setup?.expires_at>deps.now()) return fail('BOT_DRAFT_OPEN');
  delete catalog.setup;
  if (!web.is_active) {
    if (!bot) return fail('LINK_CHANGED');
    catalog.products=catalog.products.filter(p=>p.sku!==b.sku);
  } else {
    const product={sku:web.sku,name:bot?.name ?? web.name,price:web.price_vnd,stock:bot?.stock ?? web.stock_on_hand};
    if (!validProduct(product) || (!bot && catalog.products.length>=MAX_PRODUCTS)) return fail('BOT_PRODUCT_LIMIT',422);
    if (bot) bot.price=product.price;
    else catalog.products.push(product);
  }
  const snapshot=JSON.stringify(catalog);
  if (snapshot.length>32000) return fail('BOT_PRODUCT_LIMIT',422);
  const result=await env.ZH_DB.prepare(`UPDATE zh_lite_catalog SET snapshot=?,revision=revision+1,updated_at=?
    WHERE connection_id=? AND owner_epoch=? AND revision=? AND EXISTS(
      SELECT 1 FROM zh_web_stores w JOIN zh_connections c ON c.id=w.connection_id AND c.owner_epoch=w.epoch
      WHERE w.store_id=? AND w.confirmed=1 AND c.status='active' AND c.id=zh_lite_catalog.connection_id
      AND c.owner_epoch=zh_lite_catalog.owner_epoch)`)
    .bind(snapshot,deps.now(),row.id,row.owner_epoch,row.revision,b.store_id).run();
  return result.meta.changes===1 ? success() : fail('LINK_CHANGED');
}
