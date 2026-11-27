import { randomId, sha256Hex } from './crypto.mjs';

const ttl = 10 * 60 * 1000;
const failed = (error, status = 409) => ({ status, body: { ok: false, error } });
const ok = fields => ({ status: 200, body: { ok: true, ...fields } });

export async function ownerLink(db, action, store, actor, body, now) {
  const query = (sql, ...params) => db.prepare(sql).bind(...params);
  if (action === 'start') {
    const secret = randomId(12);
    const result = await query(`INSERT INTO zh_web_stores(store_id,code,challenge_hash,expires_at,requested_by)
      SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM zh_connections WHERE store_id=? AND status<>'revoked')
      ON CONFLICT(store_id) DO UPDATE SET challenge_hash=excluded.challenge_hash,expires_at=excluded.expires_at,
      requested_by=excluded.requested_by,connection_id=NULL,epoch=NULL WHERE confirmed=0`,
      store, 'CH-'+randomId(6).toUpperCase(), await sha256Hex(secret), now+ttl, actor, store).run();
    if (!result.meta.changes) return failed('STORE_HAS_LIVE_BOT');
    const row = await query('SELECT code FROM zh_web_stores WHERE store_id=?',store).first();
    return ok({ code:row.code, command:'Liên kết '+row.code+' '+secret });
  }
  const row = await query(`SELECT w.*, c.bot_name, k.revision, k.snapshot FROM zh_web_stores w
    LEFT JOIN zh_connections c ON c.id=w.connection_id AND c.owner_epoch=w.epoch AND c.status='active'
    LEFT JOIN zh_lite_catalog k ON k.connection_id=c.id AND k.owner_epoch=c.owner_epoch AND k.store_id=c.store_id
    WHERE w.store_id=?`,store).first();
  if (action === 'status') {
    const ready = row?.connection_id && (row.confirmed || (row.expires_at>now && row.requested_by===actor));
    return ok({code:row?.code ?? null, state:ready ? (row.confirmed?'linked':'confirm'):'idle',
      bot:ready ? row.bot_name : null, confirmation:ready && !row.confirmed ? row.challenge_hash : null, revision:row?.confirmed ? row.revision : null,
      products:row?.confirmed && row.snapshot ? JSON.parse(row.snapshot).products : []});
  }
  if (action === 'confirm') {
    const result = await query(`UPDATE zh_web_stores SET confirmed=1,expires_at=NULL,challenge_hash=NULL WHERE store_id=? AND challenge_hash=?
      AND requested_by=? AND expires_at>? AND confirmed=0 AND connection_id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM zh_connections WHERE store_id=zh_web_stores.store_id AND status<>'revoked')
      AND EXISTS(SELECT 1 FROM zh_connections WHERE id=connection_id AND owner_epoch=epoch AND status='active')`,
    store,body.confirmation ?? '',actor,now).run();
    return result.meta.changes ? ok({}) : failed('LINK_CHANGED');
  }
  if (action !== 'price' || !Number.isSafeInteger(body.price) || body.price<0 || body.price>1000000000 ||
    !Number.isSafeInteger(body.revision) || typeof body.sku!=='string') return failed('INVALID_PRICE',400);
  if (!row?.confirmed || !row.snapshot || row.revision!==body.revision) return failed('LINK_CHANGED');
  const catalog = JSON.parse(row.snapshot);
  if (catalog.setup?.expires_at > now) return failed('BOT_DRAFT_OPEN');
  delete catalog.setup;
  const product = catalog.products.find(p=>p.sku===body.sku);
  if (!product) return failed('PRODUCT_MISSING',404);
  product.price=body.price;
  const result=await query(`UPDATE zh_lite_catalog SET snapshot=?,revision=revision+1,updated_at=?
    WHERE connection_id=? AND owner_epoch=? AND revision=? AND EXISTS(
    SELECT 1 FROM zh_web_stores w JOIN zh_connections c ON c.id=w.connection_id AND c.owner_epoch=w.epoch
    WHERE w.store_id=? AND w.confirmed=1 AND c.id=zh_lite_catalog.connection_id AND c.status='active')`,
  JSON.stringify(catalog),now,row.connection_id,row.epoch,row.revision,store).run();
  return result.meta.changes ? ok({}) : failed('LINK_CHANGED');
}

export async function botLink(env,c,text,now) {
  const db=env.ZH_DB;
  if (/^Thông tin cửa hàng$/iu.test(text)) {
    const row=await db.prepare('SELECT code FROM zh_web_stores WHERE connection_id=? AND epoch=? AND confirmed=1').bind(c.id,c.owner_epoch).first();
    return row ? 'Mã cửa hàng: '+row.code : 'Mở Kênh kết nối trên web và chọn Liên kết bot đang dùng.';
  }
  if (!/^Liên kết\s/iu.test(text)) return null;
  const match=/^Liên kết (CH-[A-F0-9]{12}) ([a-f0-9]{24})$/iu.exec(text);
  if (!match) return 'Hãy sao chép toàn bộ lệnh từ cửa hàng trên web.';
  await db.prepare('UPDATE zh_web_stores SET connection_id=NULL,epoch=NULL,challenge_hash=NULL WHERE connection_id=? AND confirmed=0 AND expires_at<=?').bind(c.id,now).run();
  const result=await db.prepare(`UPDATE OR IGNORE zh_web_stores SET challenge_hash=?,connection_id=?,epoch=?
    WHERE code=? AND challenge_hash=? AND expires_at>? AND confirmed=0 AND connection_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM zh_connections WHERE store_id=zh_web_stores.store_id AND status<>'revoked')
    AND EXISTS(SELECT 1 FROM zh_connections WHERE id=? AND owner_chat_id=? AND owner_user_id IS ? AND owner_epoch=? AND status='active')`)
    .bind(randomId(16),c.id,c.owner_epoch,match[1].toUpperCase(),await sha256Hex(match[2]),now,c.id,c.owner_chat_id,c.owner_user_id,c.owner_epoch).run();
  return result.meta.changes ? 'Đã chọn cửa hàng '+match[1]+'. Quay lại web để xác nhận đúng bot.' : 'Mã đã hết hạn, đã dùng hoặc cửa hàng đã có bot.';
}
