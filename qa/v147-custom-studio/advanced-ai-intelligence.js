'use strict';
/* V15.2 ADV.3 — supervised presentation-intent EVALUATION, not trained LLM.
 * Source-only, no network, model, credentials or production data. Browser + Node UMD.
 * AI output MUST pass validateModelOutput() and legacy store-scoped policy compiler.
 */
(function(factory){
 const exported=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=exported;
 if(typeof window!=='undefined')Object.defineProperty(window,'T404PresentationIntelligence',{value:exported,writable:false});
})(function(){
 const SCHEMA_VERSION='t404-adv3-intent-v1';
 const INTENTS=Object.freeze(['GREETING','DISCOVER','QUOTE','LOW_STOCK','POLICY',
  'ORDER_REQUEST','ORDER_LOOKUP','SUPPORT','ABSTAIN']);
 const OUTPUT_SCHEMA=Object.freeze({
  $schema:'https://json-schema.org/draft/2020-12/schema',
  title:'T404 ADV3 Untrusted AI Intent Proposal',
  type:'object',additionalProperties:false,
  properties:{
   schema_version:{type:'string',const:SCHEMA_VERSION},
   intent:{type:'string',enum:INTENTS.slice()}
  },
  required:['schema_version','intent']
 });
 const fail=s=>{throw Error(s)};
 function validateModelOutput(value){
  let raw=value;
  if(typeof raw==='string'){
   if(raw.length>512)fail('MODEL_OUTPUT_TOO_LARGE');
   try{raw=JSON.parse(raw)}catch{fail('MODEL_JSON_INVALID')}
  }
  if(raw===null||typeof raw!=='object'||Array.isArray(raw))fail('MODEL_OBJECT_REQUIRED');
  const keys=Object.keys(raw).sort();
  if(keys.length!==2||keys[0]!=='intent'||keys[1]!=='schema_version')
   fail('MODEL_EXTRA_OR_MISSING_FIELDS'); // no free text / action IDs / URLs / prices / store IDs
  if(raw.schema_version!==SCHEMA_VERSION)fail('MODEL_SCHEMA_VERSION_DENIED');
  if(!INTENTS.includes(raw.intent))fail('MODEL_INTENT_NOT_ALLOWED');
  return Object.freeze({schema_version:SCHEMA_VERSION,intent:raw.intent});
 }
 function heuristic(input){
  if(typeof input!=='string'||input.length===0||input.length>1000)fail('INPUT_TEXT_INVALID');
  const s=input.trim().toLocaleLowerCase('vi-VN');
  if(!s)fail('INPUT_TEXT_INVALID');
  // A deterministic safety gate BEFORE intent routing; not a prompt injection detector for production.
  const injection=/ignore previous|override|bypass|system prompt|private key|credential|create_order|giả mạo|bỏ qua|đổi store_id|đưa cho tôi.*token|xóa mọi quy tắc|xuất toàn bộ token|toàn bộ token|tiết lộ bí mật|thi hành action/u;
  let intent='ABSTAIN';
  if(injection.test(s))intent='ABSTAIN';
  else if(/mã đơn|tra cứu đơn|tra đơn|kiểm tra đơn|theo dõi đơn|trạng thái đơn|đơn.*(ở đâu|tới đâu|xử lý|trạng thái)/u.test(s))intent='ORDER_LOOKUP';
  else if(/tồn kho|kho còn|sắp hết|hết hàng|còn hàng|còn bao nhiêu|kiểm tra tồn|số lượng còn/u.test(s))intent='LOW_STOCK';
  else if(/đặt hàng|đặt mua|đặt đơn|muốn mua|chốt đơn|mua \d+|lấy \d+|yêu cầu đặt hàng/u.test(s))intent='ORDER_REQUEST';
  else if(/chính sách|đổi trả|giao hàng|bảo hành|vận chuyển|phí ship|phí giao|quy định bảo hành/u.test(s))intent='POLICY';
  else if(/gặp nhân viên|gặp tư vấn viên|tư vấn viên|nhân viên|khiếu nại|người thật|hỗ trợ chuyển/u.test(s))intent='SUPPORT';
  else if(/giá|bao nhiêu tiền|mấy tiền|chi phí|đơn giá/u.test(s))intent='QUOTE';
  else if(/sản phẩm|gợi ý|danh mục|có bán|tìm .*hàng|tìm giúp|mặt hàng|giới thiệu|mẫu|xem hàng|catalog|loại/u.test(s))intent='DISCOVER';
  else if(/xin chào|chào|hello|^hi\b|^alo\b/u.test(s))intent='GREETING';
  return validateModelOutput({schema_version:SCHEMA_VERSION,intent});
 }
 function verifyCorpus(corpus){
  if(!corpus||corpus.synthetic!==true||
     corpus.schema!=='TIEN404_ADV3_PRESENTATION_LABELLED_CORPUS_V1'||!Array.isArray(corpus.cases))
    fail('SYNTHETIC_CORPUS_CONTRACT_REQUIRED');
  const ids=new Set();
  for(const c of corpus.cases){
   if(!c||typeof c.id!=='string'||ids.has(c.id)||typeof c.input!=='string'||
      c.input.length>1000||!INTENTS.includes(c.gold)||c.source!=='SYNTHETIC_LABELLED_BY_SPEC')
      fail('CORPUS_ROW_INVALID');
   ids.add(c.id);
   if((c.kind==='adversarial')!==(c.gold==='ABSTAIN'))fail('CORPUS_NEGATIVE_MISMATCH');
  }
  if(ids.size!==corpus.singleTurnCases||ids.size!==corpus.ordinaryCount+corpus.adversarialCount)
   fail('CORPUS_COUNT_MISMATCH');
  return true;
 }
 function evaluate(corpus,predict=heuristic){
  verifyCorpus(corpus);
  if(typeof predict!=='function')fail('PREDICTOR_REQUIRED');
  const mistakes=[],confusion={},passed={};let correct=0,abstained=0,negativePassed=0,negativeUnsafe=0;
  for(const c of corpus.cases){
   let intent,err=null;
   try{intent=validateModelOutput(predict(c.input,c)).intent}catch(e){intent='INVALID';err=e.message}
   if(intent===c.gold)correct++;
   if(intent==='ABSTAIN')abstained++;
   if(c.kind==='adversarial'){
    if(intent==='ABSTAIN')negativePassed++;
    else negativeUnsafe++;
   }
   if(intent!==c.gold)mistakes.push({id:c.id,expected:c.gold,got:intent,error:err});
   confusion[c.gold]??={};confusion[c.gold][intent]=(confusion[c.gold][intent]||0)+1;
   passed[c.id]=intent===c.gold;
  }
  return Object.freeze({
   evaluationType:predict===heuristic?'HEURISTIC_OFFLINE_NOT_MODEL':'EXTERNAL_PREDICTIONS_UNVERIFIED',
   datasetVersion:corpus.version,total:corpus.cases.length,correct,
   accuracy:corpus.cases.length?correct/corpus.cases.length:null,
   abstained,negativePassed,negativeUnsafe,mistakes,confusion,
   realModelCalls:0,providerSends:0,orderWrites:0,
   tokenCostMeasured:false,liveModelAccuracyCertified:false
  });
 }
 function proposeFromValidatedOutput({modelOutput,registry,policy,studio,studioApi,shop,channel}={}){
  const parsed=validateModelOutput(modelOutput);
  if(parsed.intent==='ABSTAIN'){
   return Object.freeze({contract:'T404_ADV3_SAFE_ABSTAIN',
    render:{type:'TEXT',text:'Mình chưa chắc đã hiểu yêu cầu. Bạn có thể mô tả rõ hơn được không?'},
    requiresHumanReview:true,providerSends:0,orderWrites:0,canPublish:false});
  }
  if(!registry||typeof registry.compose!=='function')fail('TRUSTED_REGISTRY_REQUIRED');
  const out=registry.compose({studio,studioApi,policy,shop,channel,proposal:{intent:parsed.intent}});
  if(out.providerSends!==0||out.orderWrites!==0||out.canSend!==false)
   fail('UNSAFE_REGISTRY_OUTPUT');
  return out;
 }
 return Object.freeze({SCHEMA_VERSION,INTENTS,OUTPUT_SCHEMA,validateModelOutput,heuristic,
  verifyCorpus,evaluate,proposeFromValidatedOutput});
});