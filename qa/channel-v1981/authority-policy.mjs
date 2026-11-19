// TIEN404 V19.8.1 — OFFLINE ONLY. This function never authorizes a real database read.
// Synthetic flags and receipts in this file are NOT acceptable as hosted security evidence.
// Native Zalo webhook auth, canonical Store Authority and real owner verification are external blockers.
export function planZaloStoreRead(input) {
  const denied = (reason) => ({decision:"DENY",reason,canReadHosted:false,canSend:false,canWrite:false,providerSends:0,commerceWrites:0});
  if (!input || typeof input !== "object") return denied("INVALID_INPUT");
  const {receipt,installation,authority,request,product,nowMs} = input;
  if (!receipt || receipt.evidenceType!=="SYNTHETIC_SIGNED_WEBHOOK_FIXTURE" || receipt.transportVerified!==true || receipt.trustedServerIssuer!==true) return denied("UNVERIFIED_PROVIDER_RECEIPT");
  if (receipt.eventType!=="message.text.received" || receipt.chatType!=="PRIVATE" || receipt.isBot!==false || receipt.messageIdValid!==true) return denied("UNSUPPORTED_EVENT");
  if (!Number.isSafeInteger(nowMs) || !Number.isSafeInteger(receipt.occurredAtMs) || Math.abs(nowMs-receipt.occurredAtMs)>300000) return denied("STALE_OR_INVALID_RECEIPT");
  if (receipt.uniqueEvent!==true || receipt.rateAllowed!==true) return denied("REPLAY_OR_RATE");
  if (!installation || installation.source!=="SYNTHETIC_SERVER_REGISTRY" || installation.status!=="qa_active" || installation.channel!=="zalo_bot") return denied("INSTALLATION_UNVERIFIED");
  if (!installation.botId || receipt.boundBotId!==installation.botId) return denied("BOT_BINDING_MISMATCH");
  if (!installation.tenantId || !installation.storeId || !installation.installationId) return denied("INSTALLATION_INCOMPLETE");
  if (!authority || authority.source!=="SYNTHETIC_SERVER_AUTHORITY" || authority.ownerVerified!==true || authority.storeActive!==true || authority.tenantId!==installation.tenantId || authority.storeId!==installation.storeId) return denied("STORE_AUTHORITY_MISSING");
  if (!request || request.source!=="SYNTHETIC_QA_INPUT" || typeof request.sku!=="string" || !/^[A-Z][A-Z0-9-]{1,20}$/.test(request.sku)) return denied("INVALID_REQUEST");
  if (["tenantId","storeId","admin","owner","serviceRole","credential","sessionJwt","accessGranted","canWrite"].some(k=>Object.prototype.hasOwnProperty.call(request,k))) return denied("CLIENT_PRIVILEGE_OR_SCOPE_CLAIM");
  if (!product || product.source!=="SYNTHETIC_CATALOG_FIXTURE" || product.tenantId!==installation.tenantId || product.storeId!==installation.storeId) return denied("CROSS_STORE_DATA");
  if (product.sku!==request.sku) return denied("PRODUCT_NOT_FOUND_IN_STORE");
  if (!Number.isSafeInteger(product.priceVnd) || product.priceVnd<=0 || !Number.isSafeInteger(product.stock) || product.stock<0) return denied("INVALID_PRICE_OR_STOCK");
  return {decision:"CANDIDATE_PREVIEW_ONLY",reason:"OFFLINE_CONTRACT_PASS_NOT_LIVE_AUTHORIZATION",tenantScope:"SYNTHETIC_ONLY",storeScope:"SYNTHETIC_ONLY",sku:product.sku,priceVnd:product.priceVnd,stock:product.stock,canReadHosted:false,canSend:false,canWrite:false,providerSends:0,commerceWrites:0};
}
