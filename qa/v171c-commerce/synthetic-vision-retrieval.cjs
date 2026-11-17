'use strict';
/**
 * V17.1C synthetic image-embedding retrieval benchmark.
 * Vectors are authored QA numbers, NOT extracted from real images.
 * Actual image decoder, embedding model, model cost and image rights NOT tested.
 * Store-bound catalog returned by trusted readback. Selection/ordering only.
 */
const CONTRACT='T404_V171C_SYNTHETIC_VISION_RETRIEVAL_V1';
const fail=c=>{throw Error(c)};
const id=x=>typeof x==='string'&&/^[a-z0-9_-]{2,90}$/i.test(x);
const vector=v=>Array.isArray(v)&&v.length>=3&&v.length<=128&&
  v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1);
const norm=v=>Math.hypot(...v);
function cosine(a,b){
 if(!vector(a)||!vector(b)||a.length!==b.length)fail('EMBEDDING_DIMENSION_INVALID');
 const aa=norm(a),bb=norm(b);
 if(aa<1e-10||bb<1e-10)fail('EMBEDDING_ZERO_DENIED');
 return a.reduce((v,x,i)=>v+x*b[i],0)/(aa*bb);
}
function buildIndex({snapshot,tenantId,storeId,embeddingVersion='qa-v1'}={}){
 if(!id(tenantId)||!id(storeId)||!id(embeddingVersion)||
  !snapshot||snapshot.source!=='TRUSTED_STORE_IMAGE_CATALOG'||
  snapshot.verified!==true||snapshot.tenantId!==tenantId||
  snapshot.storeId!==storeId||!Number.isSafeInteger(snapshot.revision)||
  snapshot.revision<=0||!Array.isArray(snapshot.items)||snapshot.items.length>1000)
  fail('IMAGE_CATALOG_STORE_SCOPE_UNVERIFIED');
 const entries=[],seen=new Set();
 for(const p of snapshot.items){
  if(!p||p.tenantId!==tenantId||p.storeId!==storeId||
   p.catalogRevision!==snapshot.revision||
   p.embeddingVersion!==embeddingVersion||p.imageApproval!=='MERCHANT_APPROVED'||
   p.active!==true||!id(p.sku)||!id(p.itemId)||!id(p.imageId)||
   !vector(p.embedding)||norm(p.embedding)<1e-10)
    fail('UNAPPROVED_IMAGE_OR_EMBEDDING');
  const key=p.itemId+'|'+p.imageId;
  if(seen.has(key))fail('DUPLICATE_IMAGE_ID');
  seen.add(key);
  entries.push(Object.freeze({itemId:p.itemId,sku:p.sku,imageId:p.imageId,
    embedding:p.embedding.slice()}));
 }
 return Object.freeze({tenantId,storeId,revision:snapshot.revision,
  embeddingVersion,entries:Object.freeze(entries),mode:'QA_SYNTHETIC_VECTORS_ONLY'});
}
function retrieve({index,tenantId,storeId,queryEmbedding,topK=3,minScore=0.7}={}){
 if(!index||index.mode!=='QA_SYNTHETIC_VECTORS_ONLY'||
  index.tenantId!==tenantId||index.storeId!==storeId||
  !vector(queryEmbedding)||!Number.isSafeInteger(topK)||
  topK<1||topK>5||typeof minScore!=='number'||
  !Number.isFinite(minScore)||minScore<0||minScore>1)
  fail('VISION_QUERY_SCOPE_INVALID');
 const ranking=new Map();
 for(const p of index.entries){
  const c=cosine(p.embedding,queryEmbedding);
  // No negative or weak similarity treated as probable match.
  if(c<minScore)continue;
  const old=ranking.get(p.itemId);
  if(!old||c>old.score)
   ranking.set(p.itemId,{itemId:p.itemId,sku:p.sku,
    score:Number(c.toFixed(6))});
 }
 const matches=[...ranking.values()].sort((a,b)=>b.score-a.score||
  a.itemId.localeCompare(b.itemId)).slice(0,topK);
 return Object.freeze({contract:CONTRACT,mode:'SYNTHETIC_QA_ONLY',
  status:matches.length?'CANDIDATES_NEED_CUSTOMER_SKU_SELECTION':'NO_RELIABLE_MATCH',
  matches,tenantId,storeId,catalogRevision:index.revision,
  requiresCustomerSkuSelection:true,requiresFinalOrderConfirmation:true,
  canCreateOrder:false,realImageDecoded:false,realModelInference:false,
  recallOnRealImagesCertified:false,providerSends:0,hostedWrites:0});
}
function benchmark({indices,queries,topK=3,minScore=0.7}={}){
 if(!Array.isArray(queries)||queries.length===0||queries.length>500||
   !indices||typeof indices!=='object')fail('QA_BENCHMARK_INVALID');
 let positives=0,recall1=0,recallK=0,negatives=0,falseAccepts=0;
 const results=[];
 for(const q of queries){
  if(!q||!id(q.storeId)||!id(q.tenantId)||!id(q.caseId)||
   !(q.expectedItemId===null||id(q.expectedItemId))||
   !vector(q.embedding))fail('QA_BENCHMARK_LABEL_INVALID');
  const index=indices[q.storeId];
  if(!index)fail('MISSING_STORE_INDEX');
  const r=retrieve({index,tenantId:q.tenantId,storeId:q.storeId,
   queryEmbedding:q.embedding,topK,minScore});
  if(q.expectedItemId===null){
   negatives++;if(r.matches.length)falseAccepts++;
  }else{
   positives++;
   if(r.matches[0]?.itemId===q.expectedItemId)recall1++;
   if(r.matches.some(x=>x.itemId===q.expectedItemId))recallK++;
  }
  results.push({caseId:q.caseId,top1:r.matches[0]?.itemId||null,
   trueItemReturned:q.expectedItemId===null?null:
    r.matches.some(x=>x.itemId===q.expectedItemId),
   falseCandidateOnUnknown:q.expectedItemId===null&&r.matches.length>0});
 }
 return Object.freeze({contract:CONTRACT,dataset:'HAND_LABELED_SYNTHETIC_VECTOR_FIXTURES',
  queryCount:queries.length,positives,negatives,recallAt1:positives?recall1/positives:null,
  recallAtK:positives?recallK/positives:null,
  falsePositiveQueryRate:negatives?falseAccepts/negatives:null,
  actualVisualRecognitionBenchmarked:false,
  canSetProductionSimilarityThreshold:false,
  details:results});
}
module.exports=Object.freeze({CONTRACT,cosine,buildIndex,retrieve,benchmark});
