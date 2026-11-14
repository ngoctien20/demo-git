'use strict';
const {isVerifiedCustomer} = require('./ingress.cjs');
const skuPattern = /^[A-Z]{1,4}\d{2,5}$/;
const safeName = s => typeof s === 'string' && s.trim().length > 0 && s.length <= 90 && !/[\r\n<>{}\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(s);

// The synthetic QA table has no wholesale, status, or business-verification timestamp.
// An actual SELECT time describes this QA read only. Never use it as freshness for a cached business feed.
const catalogSql = `
  SELECT c.tenant_key, c.store_key, c.bot_key, c.sku, c.product_name, c.price_vnd, c.stock,
         statement_timestamp() AS read_at
    FROM tien404_r1_qa.catalog AS c
    JOIN tien404_r1_qa.shop_bots AS b USING (tenant_key, store_key, bot_key)
   WHERE c.tenant_key=$1 AND c.store_key=$2 AND c.bot_key=$3 AND c.sku=$4
     AND b.enabled_mode='dry_run' AND b.identity_status='synthetic_qa'`;

function createPostgresQaCatalog({poolForContext}) {
  return Object.freeze({async readProduct({context, sku, client}) {
    if (!isVerifiedCustomer(context) || !skuPattern.test(sku)) throw Error('CATALOG_SCOPE_DENIED');
    const db = client || poolForContext(context);
    const {rows} = await db.query(catalogSql, [context.tenantId, context.storeId, context.botRef, sku]);
    if (!rows.length) return null;
    const r = rows[0];
    if (rows.length !== 1 || r.bot_key !== context.botRef) throw Error('CATALOG_SCOPE_DENIED');
    const price = typeof r.price_vnd === 'string' && /^\d+$/.test(r.price_vnd) ? Number(r.price_vnd) : r.price_vnd;
    return {tenantId:r.tenant_key, storeId:r.store_key, sku:r.sku, name:r.product_name,
      stock:r.stock, priceVnd:price, source:'QA_BACKEND_READBACK', readAt:r.read_at};
  }});
}

async function readFreshQaProduct({repository, context, sku, clock = Date.now, maxAgeMs = 120000, client} = {}) {
  if (!isVerifiedCustomer(context)) throw Error('CATALOG_SCOPE_DENIED');
  if (!repository || typeof repository.readProduct !== 'function') throw Error('CATALOG_REPOSITORY_REQUIRED');
  if (typeof sku !== 'string' || !skuPattern.test(sku)) throw Error('CATALOG_SKU_INVALID');
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1 || maxAgeMs > 120000) throw Error('CATALOG_TTL_INVALID');
  const record = await repository.readProduct({context, tenantId:context.tenantId, storeId:context.storeId, sku, client});
  if (!record || record.active === false) return {status:'NOT_FOUND'};
  if (record.tenantId !== context.tenantId || record.storeId !== context.storeId ||
      record.sku !== sku || record.source !== 'QA_BACKEND_READBACK') throw Error('CATALOG_CROSS_SCOPE_REJECTED');
  const now = clock();
  const at = record.readAt instanceof Date ? record.readAt.getTime() : Date.parse(record.readAt);
  if (!Number.isFinite(now) || !Number.isFinite(at) || at > now || now-at >= maxAgeMs) return {status:'STALE'};
  if (!safeName(record.name) || !Number.isSafeInteger(record.priceVnd) || record.priceVnd <= 0 ||
      !Number.isSafeInteger(record.stock) || record.stock < 0 ||
      (record.active !== undefined && typeof record.active !== 'boolean')) return {status:'INVALID'};
  const wholesale = record.wholesale;
  const validTier = Number.isSafeInteger(wholesale?.minQuantity) && wholesale.minQuantity > 0 &&
    Number.isSafeInteger(wholesale.priceVnd) && wholesale.priceVnd > 0 && wholesale.priceVnd <= record.priceVnd;
  const attributes = {};
  for (const field of ['size','color','unit']) if (safeName(record[field])) attributes[field] = record[field];
  return {status:'OK', product:Object.freeze({sku, name:record.name, priceVnd:record.priceVnd, stock:record.stock,
    wholesale:validTier ? Object.freeze({minQuantity:wholesale.minQuantity,priceVnd:wholesale.priceVnd}) : null, ...attributes})};
}
module.exports = {readFreshQaProduct, createPostgresQaCatalog};
