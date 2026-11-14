'use strict';
// V12.4 tenant-scoped QA catalog reader. Never use client-provided tenant/store.
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const safeName=s=>typeof s==='string'&&s.trim().length>0&&s.length<=90&&!/[\r\n<>{}\u0000-\u001f]/.test(s);
async function readFreshQaProduct({repository,context,sku,clock=()=>Date.now(),maxAgeMs=120000}={}){
 if(!repository||typeof repository.readProduct!=='function')fail('CATALOG_REPOSITORY_REQUIRED');
 if(!context||context.trust!=='SIGNED_INTERNAL_QA_FIXTURE'||
    !/^[A-Za-z0-9:_-]{2,128}$/.test(context.tenantId||'')||
    !/^[A-Za-z0-9:_-]{2,128}$/.test(context.storeId||''))
    fail('CATALOG_SCOPE_DENIED');
 if(typeof sku!=='string'||!/^[A-Z]{1,4}\d{2,5}$/.test(sku))fail('CATALOG_SKU_INVALID');
 // The backend adapter MUST use these three server-resolved values as query filters.
 const record=await repository.readProduct({tenantId:context.tenantId,storeId:context.storeId,sku});
 if(!record)return Object.freeze({status:'NOT_FOUND'});
 if(record.tenantId!==context.tenantId||record.storeId!==context.storeId||
    record.sku!==sku||record.source!=='QA_BACKEND_READBACK')fail('CATALOG_CROSS_SCOPE_REJECTED');
 const now=clock(),at=Date.parse(record.readAt);
 if(!Number.isFinite(now)||!Number.isFinite(at)||at>now||now-at>maxAgeMs)
    return Object.freeze({status:'STALE'});
 if(!safeName(record.name)||!Number.isSafeInteger(record.priceVnd)||record.priceVnd<=0||
    !Number.isSafeInteger(record.stock)||record.stock<0)
    return Object.freeze({status:'INVALID'});
 return Object.freeze({status:'OK',product:Object.freeze({
  sku:record.sku,name:record.name,priceVnd:record.priceVnd,stock:record.stock
 })});
}
module.exports={readFreshQaProduct};
