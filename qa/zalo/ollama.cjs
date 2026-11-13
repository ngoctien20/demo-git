// Local-only adapter for consult(). An operator provisions the model separately.
function ollamaInference(model,request=fetch) {
  if(typeof model!=='string'||!/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(model)||model.includes('cloud')) throw Error('LOCAL_MODEL_REQUIRED');
  return async ({systemPrompt,text,candidates,signal})=>{
    if(typeof text!=='string'||text.length>512||!candidates.length||candidates.length>16) throw Error('INPUT_LIMIT');
    const res=await request('http://127.0.0.1:11434/api/chat',{method:'POST',redirect:'error',signal,
      headers:{'content-type':'application/json'},body:JSON.stringify({model,stream:false,think:false,
      options:{temperature:0,num_predict:48,num_ctx:2048},
      format:{type:'object',properties:{sku:{enum:[...candidates,null]}},required:['sku'],additionalProperties:false},
      messages:[{role:'system',content:systemPrompt},{role:'user',content:JSON.stringify({text,candidates})}]})});
    if(!res.ok) throw Error('MODEL_HTTP');
    const data=await res.json();
    if(data.done!==true||data.message?.role!=='assistant'||data.eval_count>48||typeof data.message.content!=='string'||data.message.content.length>200) throw Error('MODEL_OUTPUT');
    const proposal=JSON.parse(data.message.content);
    if(!proposal||Object.keys(proposal).length!==1||!candidates.includes(proposal.sku)) throw Error('NO_GROUNDED_SKU');
    return proposal;
  };
}
module.exports={ollamaInference};

// Composition entry point. The caller supplies fixture catalog IDs, never user tools.
async function consultLocal(shop,state,text,candidates,model) {
  const {consult}=require('./model.cjs');
  return consult(shop,state,text,candidates,ollamaInference(model),1500);
}
module.exports.consultLocal=consultLocal;
