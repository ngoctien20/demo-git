'use strict';
const {randomBytes,createHmac} = require('node:crypto');
const api = require('./index.cjs');

function fixture(options={}) {
  const internalKey=randomBytes(32), clock=options.clock || Date.now;
  let sequence=0;
  const registry=['a','b'].map(shop=>({channel:'qa-fixture',botRef:'qa-bot-'+shop,mode:'qa-preview',
    active:true,tenantId:'qa-tenant-'+shop,storeId:'qa-store-'+shop}));
  const ingress=api.createQaIngressVerifier({registry,internalKey,clock});
  function event(text, overrides={}) {
    const env = {version:1,channel:'qa-fixture',botRef:'qa-bot-a',senderRef:'qa-customer',eventRef:'event-'+(++sequence),
      eventType:'message.text.received',chatType:'PRIVATE',text,issuedAt:new Date(clock()).toISOString(),...overrides};
    return {...env,signature:createHmac('sha256',internalKey).update(api.canonical(env)).digest('hex')};
  }
  const row = {tenantId:'qa-tenant-a',storeId:'qa-store-a',sku:'F01',name:'Áo trắng QA',priceVnd:159000,stock:3,
    source:'QA_BACKEND_READBACK',readAt:new Date(clock()).toISOString(),...options.row};
  const core=api.createReadOnlyReplyCore({ingress,clock,repository:options.repository || api.createQaMemoryCatalog([row]),
    receipts:api.createQaMemoryReceipts({clock}),limiter:api.createQaRateLimiter({clock,max:50}),
    classifier:options.classifier || api.createFixtureIntentClassifier(),sessions:options.sessions,modelTimeoutMs:options.modelTimeoutMs});
  return {ingress,core,event,registry,row,preview:(text,fields)=>core.preview(event(text,fields))};
}
module.exports = {fixture};
