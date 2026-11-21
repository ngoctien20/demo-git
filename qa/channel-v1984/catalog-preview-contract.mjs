/**
 * TIEN404 V19.8.4 — OFFLINE QA preview formatter only.
 * NEVER callable with a live Zalo payload as authorization.
 * "EPHEMERAL_PG_MOCK_RLS" is a synthetic marker, NOT cryptographic evidence.
 * No database, network, LLM, payment, order or provider send capabilities.
 */
export function formatCatalogCandidate(input) {
  const deny = reason => ({
    decision:'DENY',reason,replyPreview:'',canReadHosted:false,canSend:false,
    canWrite:false,orderCommitted:false,stockReserved:false
  });
  if (!input || input.mode!=='SYNTHETIC_OFFLINE_ONLY' ||
      input.readerProof!=='EPHEMERAL_PG_MOCK_RLS') return deny('UNTRUSTED_OFFLINE_INPUT');
  const {scope,query,rows,nowMs}=input;
  if (!scope||scope.source!=='SYNTHETIC_SERVER_FIXTURE' ||
      !/^[0-9a-fA-F-]{36}$/.test(String(scope.tenantId||'')) ||
      !/^[0-9a-fA-F-]{36}$/.test(String(scope.storeId||'')))
    return deny('NO_VERIFIED_SCOPE');
  if (!query || typeof query.sku!=='string' ||
      !/^[A-Z][A-Z0-9-]{1,20}$/.test(query.sku)) return deny('INVALID_SKU');
  if (!Number.isSafeInteger(query.quantity)||query.quantity<1||query.quantity>100)
    return deny('INVALID_QUANTITY');
  if (!Array.isArray(rows)||rows.length!==1||!rows[0]||typeof rows[0]!=='object')
    return deny('MISSING_OR_AMBIGUOUS_CATALOG');
  const p=rows[0];
  if (p.tenant_id!==scope.tenantId||p.store_id!==scope.storeId||p.sku!==query.sku)
    return deny('READER_SCOPE_MISMATCH');
  if (p.currency!=='VND'||!/^V1984_[A-Z]_[0-9]{3}$/.test(String(p.source_revision||'')))
    return deny('UNVERIFIED_SOURCE');
  if (!Number.isSafeInteger(p.price_vnd)||p.price_vnd<=0||p.price_vnd>9000000000000000||
      !Number.isSafeInteger(p.stock_on_hand)||p.stock_on_hand<0||p.stock_on_hand>10000000)
    return deny('INVALID_PRICE_STOCK');
  if (!Number.isSafeInteger(nowMs) || !p.verified_at ||
      !Number.isFinite(Date.parse(p.verified_at))) return deny('INVALID_FRESHNESS');
  const age=nowMs-Date.parse(p.verified_at);
  if(age<0||age>300000) return deny('STALE_OR_FUTURE_SNAPSHOT');
  const maxTotal=p.price_vnd*query.quantity;
  if(!Number.isSafeInteger(maxTotal)) return deny('VND_TOTAL_OVERFLOW');
  const inStock=p.stock_on_hand>=query.quantity;
  const format=n=>n.toLocaleString('vi-VN')+'đ';
  const reply=inStock
    ? 'Mã '+p.sku+': '+format(p.price_vnd)+'/sản phẩm. Tồn kho mẫu '+p.stock_on_hand+
      '. Xem trước '+query.quantity+' sản phẩm: '+format(maxTotal)+'. Chưa tạo đơn hoặc giữ hàng.'
    : 'Mã '+p.sku+' có tồn kho mẫu '+p.stock_on_hand+
      ', chưa đủ '+query.quantity+' sản phẩm. Chưa nhận đơn hoặc giữ hàng.';
  return {
    decision:inStock?'OFFLINE_PREVIEW':'INSUFFICIENT_STOCK',
    reason:'SYNTHETIC_ONLY_NOT_PROVIDER_REPLY',
    replyPreview:'[TIEN404 QA — DỮ LIỆU MẪU] '+reply,
    canReadHosted:false,canSend:false,canWrite:false,orderCommitted:false,stockReserved:false,
    storeScope:'OFFLINE_ONLY',currency:'VND'
  };
}
