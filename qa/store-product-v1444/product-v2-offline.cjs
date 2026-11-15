'use strict';
/**
 * TIEN404 V14.4.4 Store Product RPC V2 — offline design/contract ONLY.
 *
 * Not a PostgreSQL migration, public RPC, Supabase adapter, HTTP API,
 * hosted Auth verifier, order/stock service or released feature.
 * ALL identity comes from synthetic authoritative ports, never role,
 * user_id, tenant_id or price fields supplied by a browser/AI.
 *
 * In-memory writes below modify test fixtures ONLY; all hosted-write
 * flags are hard false. Actual SQL implementation requires separate DBA
 * approval, restored backup, RLS/RPC review and signed JWT acceptance.
 */
const {createHash,randomUUID}=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_VND=1_000_000_000_000;
const MAX_STOCK=2_147_483_647;
const ALLOWED_ROLES=new Set(['owner','manager']);
const ERROR_CODES=Object.freeze({
 BLOCKED:'OFFLINE_ADAPTER_REQUIRED', AUTH:'AUTH_NOT_VERIFIED',
 MEMBERSHIP:'STORE_MEMBERSHIP_DENIED', INPUT:'PRODUCT_INPUT_INVALID',
 FORBIDDEN:'CLIENT_SCOPE_OVERRIDE_DENIED', CONFLICT:'PRODUCT_VERSION_CONFLICT',
 DUPLICATE:'PRODUCT_IDEMPOTENCY_KEY_CONFLICT', MISSING:'PRODUCT_NOT_FOUND',
 OVERFLOW:'OFFLINE_FIXTURE_CAPACITY_EXCEEDED'
});
function reject(code){const error=new Error(code);error.code=code;throw error;}
const isUuid=x=>typeof x==='string'&&UUID.test(x);
const fields=new Set(['action','storeId','sku','name','priceVnd','isActive',
 'initialStock','expectedRevision','requestId']);
function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
  Object.keys(input).some(k=>!fields.has(k)))reject(ERROR_CODES.INPUT);
 const {action,storeId,sku,name,priceVnd,isActive,initialStock,expectedRevision,requestId}=input;
 if(!['create','update'].includes(action)||!isUuid(storeId)||
   typeof sku!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(sku)||
   typeof name!=='string'||name.trim()!==name||name.length<1||
   name.length>250||typeof isActive!=='boolean'||
   typeof priceVnd!=='number'||!Number.isSafeInteger(priceVnd)||
   priceVnd<0||priceVnd>MAX_VND||
   typeof requestId!=='string'||!/^[a-zA-Z0-9_-]{12,80}$/.test(requestId))
    reject(ERROR_CODES.INPUT);
 if(action==='create'){
  if(!Number.isSafeInteger(initialStock)||initialStock<0||
     initialStock>MAX_STOCK||expectedRevision!==null)
   reject(ERROR_CODES.INPUT);
 }else{
  if(initialStock!==null||!Number.isSafeInteger(expectedRevision)||
     expectedRevision<1)reject(ERROR_CODES.INPUT);
 }
 return Object.freeze({action,storeId,sku,name,priceVnd,isActive,
   initialStock,expectedRevision,requestId});
}
function createOfflineStoreProductV2({mode,ports,maxProducts=1000,maxRequests=3000}={}){
 if(mode!=='OFFLINE_SYNTHETIC_QA'||!ports||
   ports.mode!=='OFFLINE_SYNTHETIC_AUTH'||
   typeof ports.verifyBearer!=='function'||
   typeof ports.getActiveStoreMembership!=='function'||
   !Number.isInteger(maxProducts)||maxProducts<1||maxProducts>10000||
   !Number.isInteger(maxRequests)||maxRequests<1||maxRequests>20000)
  reject(ERROR_CODES.BLOCKED);
 const products=new Map(),replay=new Map(),audit=[];
 async function authorize(bearer,storeId){
  const user=await ports.verifyBearer(bearer);
  if(!user||!isUuid(user.id)||user.verifiedBy!=='SYNTHETIC_AUTH_SERVER'||
      user.active!==true)reject(ERROR_CODES.AUTH);
  const grant=await ports.getActiveStoreMembership({userId:user.id,storeId});
  if(!grant||grant.source!=='SYNTHETIC_CANONICAL_STORE_REGISTRY'||
    grant.userId!==user.id||grant.storeId!==storeId||
    !isUuid(grant.tenantId)||!grant.tenantActive||
    grant.storeActive!==true||grant.membershipActive!==true||
    !ALLOWED_ROLES.has(grant.role)||grant.canEditProducts!==true)
    reject(ERROR_CODES.MEMBERSHIP);
  return Object.freeze({userId:user.id,tenantId:grant.tenantId,storeId});
 }
 function key(x){return x.tenantId+'|'+x.storeId+'|'+x.sku;}
 function publicRow(row){
  return Object.freeze({storeId:row.storeId,sku:row.sku,name:row.name,
   priceVnd:row.priceVnd,isActive:row.isActive,
   stockOnHand:row.stockOnHand,revision:row.revision});
 }
 async function apply({bearer,body}={}){
  // Validate and authorize EVERY operation, including potential replays.
  const input=validate(body);
  const scope=await authorize(bearer,input.storeId);
  const idKey=scope.userId+'|'+scope.tenantId+'|'+scope.storeId+'|'+input.requestId;
  const fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const previous=replay.get(idKey);
  if(previous){
   if(previous.fingerprint!==fingerprint)reject(ERROR_CODES.DUPLICATE);
   return Object.freeze({...previous.result,replayed:true});
  }
  const rowKey=key({...scope,sku:input.sku});
  const current=products.get(rowKey);
  if(input.action==='create'){
   if(current)reject(ERROR_CODES.CONFLICT);
   if(products.size>=maxProducts||replay.size>=maxRequests)reject(ERROR_CODES.OVERFLOW);
   const row={id:randomUUID(),...scope,sku:input.sku,name:input.name,
    priceVnd:input.priceVnd,isActive:input.isActive,stockOnHand:input.initialStock,
    revision:1};
   products.set(rowKey,row);
   const result=Object.freeze({status:'CREATED_OFFLINE_FIXTURE_ONLY',product:publicRow(row),
    hostedWrites:0,orderWrites:0,stockUpdatedOnlyAtCreation:true});
   replay.set(idKey,{fingerprint,result});
   audit.push({event:'PRODUCT_CREATE_SYNTHETIC',scope:rowKey});
   return result;
  }
  if(!current)reject(ERROR_CODES.MISSING);
  if(current.revision!==input.expectedRevision)reject(ERROR_CODES.CONFLICT);
  if(replay.size>=maxRequests)reject(ERROR_CODES.OVERFLOW);
  const row={...current,name:input.name,priceVnd:input.priceVnd,
   isActive:input.isActive,revision:current.revision+1};
  products.set(rowKey,row);
  const result=Object.freeze({status:'UPDATED_OFFLINE_FIXTURE_ONLY',product:publicRow(row),
   hostedWrites:0,orderWrites:0,stockUpdatedOnlyAtCreation:false});
  replay.set(idKey,{fingerprint,result});
  audit.push({event:'PRODUCT_UPDATE_SYNTHETIC',scope:rowKey});
  return result;
 }
 async function read({bearer,storeId,sku}={}){
  if(!isUuid(storeId)||typeof sku!=='string')reject(ERROR_CODES.INPUT);
  const scope=await authorize(bearer,storeId);
  const row=products.get(key({...scope,sku}));
  if(!row)reject(ERROR_CODES.MISSING);
  return publicRow(row);
 }
 return Object.freeze({
  apply,read,
  inspect:()=>Object.freeze({
   mode:'OFFLINE_SYNTHETIC_QA',syntheticProducts:products.size,
   syntheticAuditEvents:audit.length,syntheticReplayEntries:replay.size,
   containsCustomerPII:false,hostedWrites:0,
   canWriteHosted:false,canPublishRpc:false,
   canChangeRls:false,canChangePrivileges:false,
   canSendMessages:false,canUpdateStockAfterCreate:false
  })
 });
}
module.exports={createOfflineStoreProductV2,ERROR_CODES,validate};
