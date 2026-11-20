// TIEN404 V19.8.5 — SYNTHETIC CONTRACT ONLY. NOT deployable as trusted ingress.
// No provider sends, SQL, credentials, hosted reads, LLM, order writes or remote calls.
import {formatCatalogCandidate} from '../channel-v1984/catalog-preview-contract.mjs';

const OFFLINE = 'V1985_SYNTHETIC_QA_ONLY';
function deny(reason) {
  return {success:false,decision:'DENY',reason,environment:'blocked',
    tenantId:null,storeId:null,products:[],count:0,replyPreview:'',
    canReadHosted:false,canSend:false,canWrite:false,modelCalls:0,
    providerSends:0,orderWrites:0,stockWrites:0,
    legacyPublishedWorkflowsCalled:0,productionReady:false};
}
const own = (x,k)=>Object.prototype.hasOwnProperty.call(x,k);
function exactKeys(x,allowed) {
  return !!x && typeof x === 'object' && !Array.isArray(x) &&
    Object.keys(x).every(k=>allowed.includes(k));
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SKU = /^[A-Z][A-Z0-9-]{1,20}$/;

/** Block all attempts to route the existing 4-field Catalog Query into this candidate. */
export function legacyCatalogCompatibility(request) {
  const keys=['channelType','accountId','query','limit'];
  if (!exactKeys(request,keys) || typeof request.channelType!=='string' ||
      typeof request.accountId!=='string' || typeof request.query!=='string')
    return deny('LEGACY_INPUT_INVALID');
  return deny('LEGACY_TENANT_ONLY_CATALOG_NOT_STORE_SAFE');
}

/**
 * Simulates a future INTERNAL-only Store-scoped adapter.
 * source/binding proofs here are test fixtures, NOT actual provider/JWT verification.
 * The caller-supplied chat data can only contain a product SKU and quantity.
 * This function never calls Commerce or sends a message.
 */
export function previewIsolatedStoreAdapter(data) {
  if (!exactKeys(data,['mode','request','receipt','installation','ownerEvidence','reader','nowMs']))
    return deny('INVALID_ADAPTER_ENVELOPE');
  if (data.mode!==OFFLINE) return deny('OFFLINE_ONLY');
  const {request:r,receipt:e,installation:i,ownerEvidence:o,reader:d,nowMs}=data;
  if(!exactKeys(r,['source','channel','sku','quantity'])||
     r.source!=='SYNTHETIC_UNPRIVILEGED_CHAT'||
     r.channel!=='zalo_bot'||!SKU.test(String(r.sku||''))||
     !Number.isSafeInteger(r.quantity)||r.quantity<1||r.quantity>100)
    return deny('INVALID_OR_PRIVILEGED_CUSTOMER_REQUEST');
  if(!exactKeys(e,['source','botRef','eventType','chatType','actor','isEcho','unique','rateAllowed','occurredAtMs'])||
     e.source!=='MOCK_VERIFIED_PRIVATE_WEBHOOK'||e.eventType!=='message.text.received'||
     e.chatType!=='PRIVATE'||e.isEcho!==false||
     !['CUSTOMER','OWNER_AS_CUSTOMER_QA'].includes(e.actor)||
     e.unique!==true||e.rateAllowed!==true||
     !Number.isSafeInteger(nowMs)||!Number.isSafeInteger(e.occurredAtMs)||
     Math.abs(nowMs-e.occurredAtMs)>300000)
    return deny('UNTRUSTED_OR_STALE_MOCK_RECEIPT');
  if(!exactKeys(i,['source','channel','installationRef','botRef','tenantId','storeId','state'])||
     i.source!=='MOCK_SERVER_PRIVATE_REGISTRY'||i.channel!=='zalo_bot'||
     i.state!=='qa_active'||!i.installationRef||
     e.botRef!==i.botRef||!UUID.test(String(i.tenantId||''))||!UUID.test(String(i.storeId||'')))
    return deny('INSTALLATION_NOT_BOUND');
  if(!exactKeys(o,['source','installationRef','storeId','tenantId','ownerVerified','consentActive','qaOwnerCustomerAllowed'])||
     o.source!=='MOCK_SERVER_OWNER_PROOF'||o.installationRef!==i.installationRef||
     o.storeId!==i.storeId||o.tenantId!==i.tenantId||
     o.ownerVerified!==true||o.consentActive!==true||
     (e.actor==='OWNER_AS_CUSTOMER_QA' && o.qaOwnerCustomerAllowed!==true))
    return deny('OWNER_AUTHORITY_NOT_VERIFIED');
  if(!exactKeys(d,['source','rows'])||d.source!=='MOCK_POSTGRESQL_RLS_READER'||
     !Array.isArray(d.rows))
    return deny('READER_RESULT_UNVERIFIED');
  const preview = formatCatalogCandidate({
    mode:'SYNTHETIC_OFFLINE_ONLY',readerProof:'EPHEMERAL_PG_MOCK_RLS',
    scope:{source:'SYNTHETIC_SERVER_FIXTURE',tenantId:i.tenantId,storeId:i.storeId},
    query:{sku:r.sku,quantity:r.quantity},rows:d.rows,nowMs
  });
  if(!['OFFLINE_PREVIEW','INSUFFICIENT_STOCK'].includes(preview.decision))
    return deny('CATALOG_REJECTED_'+preview.reason);
  const row=d.rows[0];
  return {success:true,decision:preview.decision,reason:'MOCK_DATA_PREVIEW_NOT_LIVE_QUOTE',
    environment:'offline_qa',tenantId:null,storeId:null,
    products:[{sku:row.sku,priceVnd:row.price_vnd,stock:row.stock_on_hand,currency:'VND',
      source:'QA_SAMPLE_ONLY'}],count:1,replyPreview:preview.replyPreview,
    canReadHosted:false,canSend:false,canWrite:false,modelCalls:0,
    providerSends:0,orderWrites:0,stockWrites:0,
    legacyPublishedWorkflowsCalled:0,productionReady:false};
}
