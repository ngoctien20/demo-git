import { workflow, trigger, node, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const ingress = trigger({
 type:'n8n-nodes-base.webhook',version:2.2,
 config:{name:'STAGING POST Header Auth — Read Only',position:[240,300],
  credentials:{httpHeaderAuth:newCredential('TIEN404_V1855_READONLY_ADAPTER_AUTH_STAGING')},
  parameters:{httpMethod:'POST',path:'t404-v1855-protected-readonly-commerce-staging',
    authentication:'headerAuth',responseMode:'responseNode',
    options:{allowedOrigins:'https://tien404-widget-gateway-v144-staging.tienmobi208.workers.dev'}}},
 output:[{headers:{'content-type':'application/json'},query:{},body:{installationId:'v1855-materials-sandbox',operation:'catalog.search',query:'VL-101',limit:5,requestId:'v1855-ingress-fixture-01',issuedAt:1795000000000}}]
});
const validate=node({
 type:'n8n-nodes-base.code',version:2,
 config:{name:'Validate Ingress Envelope',position:[530,300],
  parameters:{mode:'runOnceForAllItems',jsCode:"'use strict';\nconst event=$input.first()?.json||{};\nconst body=event.body;\nconst rejected=(reason,httpStatus=400)=>[{json:{accepted:false,reason,httpStatus,body:{success:false,reason,environment:'sandbox',readOnly:true,canWrite:false,canConfirm:false,privateOrderAccess:false}}}];\nif(!body||typeof body!=='object'||Array.isArray(body))return rejected('invalid_json_body');\nconst keys=Object.keys(body);\nconst permitted=['installationId','operation','query','limit','cartJson','requestId','issuedAt'];\nif(keys.some(k=>!permitted.includes(k)))return rejected('unexpected_or_authority_field');\nif(event.query&&typeof event.query==='object'&&Object.keys(event.query).length)return rejected('query_parameters_forbidden');\nconst h=event.headers||{};\nconst contentType=String(h['content-type']??h['Content-Type']??'').toLowerCase();\nif(!contentType.startsWith('application/json'))return rejected('json_required',415);\nconst installationId=typeof body.installationId==='string'?body.installationId.trim():'';\nif(!['v1855-materials-sandbox','v1855-grocery-sandbox'].includes(installationId))return rejected('unknown_installation',404);\nconst operation=typeof body.operation==='string'?body.operation.trim():'';\nif(!['catalog.search','cart.preview'].includes(operation))return rejected('operation_not_allowed',403);\nconst requestId=typeof body.requestId==='string'?body.requestId.trim():'';\nif(!/^[A-Za-z0-9_-]{12,80}$/.test(requestId))return rejected('invalid_request_id');\nif(!Number.isSafeInteger(body.issuedAt)||Math.abs(Date.now()-body.issuedAt)>60000)return rejected('request_timestamp_expired');\nif(operation==='catalog.search'){\n const query=typeof body.query==='string'?body.query.trim():'';\n const limit=body.limit===undefined?5:body.limit;\n if(!query||query.length>240||!Number.isInteger(limit)||limit<1||limit>8||'cartJson'in body)return rejected('invalid_catalog_request');\n return [{json:{accepted:true,installationId,operation,query,limit,cartJson:'',requestId,issuedAt:body.issuedAt}}];\n}\nif('query'in body||'limit'in body||typeof body.cartJson!=='string'||body.cartJson.length>4096)return rejected('invalid_cart_request');\nlet arr;\ntry{arr=JSON.parse(body.cartJson)}catch{return rejected('invalid_cart_json')}\nif(!Array.isArray(arr)||arr.length<1||arr.length>30)return rejected('invalid_cart_size');\nconst ids=new Set(),cart=[];\nfor(const l of arr){\n if(!l||typeof l!=='object'||Array.isArray(l)||Object.keys(l).some(k=>!['sku','quantity'].includes(k)))return rejected('invalid_cart_line');\n const sku=typeof l.sku==='string'?l.sku.trim():'';\n const quantity=l.quantity;\n if(!sku||sku.length>64||!Number.isFinite(quantity)||quantity<=0||quantity>50000||Math.round(quantity*1000)!==quantity*1000)return rejected('invalid_cart_line');\n if(ids.has(sku))return rejected('duplicate_sku');\n ids.add(sku);cart.push({sku,quantity});\n}\nreturn [{json:{accepted:true,installationId,operation,query:'',limit:5,cartJson:JSON.stringify(cart),requestId,issuedAt:body.issuedAt}}];"}},
 output:[{accepted:true,installationId:'v1855-materials-sandbox',operation:'catalog.search',query:'VL-101',limit:5,cartJson:'',requestId:'v1855-ingress-fixture-01',issuedAt:1795000000000}]
});
const allowed=ifElse({
 version:2.2,config:{name:'Only Safe Read Operations?',position:[820,300],
  parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict'},conditions:[{leftValue:expr('{{ $json.accepted }}'),operator:{type:'boolean',operation:'true'}}],combinator:'and'}}}
});
const callAdapter=node({
 type:'n8n-nodes-base.executeWorkflow',version:1.3,
 config:{name:'Call Restricted V18.5.5 Adapter',position:[1110,180],
  parameters:{source:'database',
   workflowId:{__rl:true,mode:'id',value:'rYwrJfJavcaZcjUI',cachedResultName:'TIEN404 V18.5.5 Protected Read-Only Commerce Adapter'},
   workflowInputs:{mappingMode:'defineBelow',
      value:{installationId:expr('{{ $json.installationId }}'),operation:expr('{{ $json.operation }}'),query:expr('{{ $json.query }}'),limit:expr('{{ $json.limit }}'),cartJson:expr('{{ $json.cartJson }}'),requestId:expr('{{ $json.requestId }}'),issuedAt:expr('{{ $json.issuedAt }}')},
      schema:[
       {id:'installationId',displayName:'installationId',type:'string'},
       {id:'operation',displayName:'operation',type:'string'},
       {id:'query',displayName:'query',type:'string'},
       {id:'limit',displayName:'limit',type:'number'},
       {id:'cartJson',displayName:'cartJson',type:'string'},
       {id:'requestId',displayName:'requestId',type:'string'},
       {id:'issuedAt',displayName:'issuedAt',type:'number'}
      ]},mode:'once',options:{waitForSubWorkflow:true}}}
});
const sanitize=node({
 type:'n8n-nodes-base.code',version:2,
 config:{name:'Enforce Safe Readback Response',position:[1380,180],
  parameters:{mode:'runOnceForAllItems',jsCode:"'use strict';\nconst raw=$input.first()?.json||{};\nconst req=$('Validate Ingress Envelope').first().json||{};\nconst fail=(reason,status=502)=>[{json:{httpStatus:status,body:{success:false,reason,environment:'sandbox',readOnly:true,canWrite:false,canConfirm:false,privateOrderAccess:false}}}];\nconst disallowed=['tenantId','storeId','accountId','channelType','customerId','orderId','phone','email','address','userId','recipientId','credential','token'];\nif(Object.keys(raw).some(k=>disallowed.includes(k)))return fail('unsafe_adapter_response');\nif(raw.operation!==req.operation||raw.requestId!==req.requestId||raw.environment!=='sandbox'||raw.readOnly!==true||raw.canWrite!==false||raw.canConfirm!==false||raw.privateOrderAccess!==false)return fail('adapter_contract_mismatch');\nif(raw.success===false)return fail('adapter_read_rejected',403);\nif(raw.success!==true)return fail('adapter_invalid_success');\nconst common={success:true,operation:req.operation,requestId:req.requestId,environment:'sandbox',readOnly:true,canWrite:false,canConfirm:false,privateOrderAccess:false,shopName:String(raw.shopName??'').slice(0,120)};\nconst price=n=>Number.isSafeInteger(n)&&n>=0;\nif(req.operation==='catalog.search'){\n if(!Array.isArray(raw.products)||raw.products.length>8)return fail('invalid_catalog_response');\n const products=[];\n for(const p of raw.products){\n   if(!p||typeof p!=='object'||typeof p.sku!=='string'||typeof p.name!=='string'||!price(p.priceVnd)||!price(p.stock))return fail('invalid_catalog_product');\n   const attrs={};const wh=['size','color','material','weightKg','packSize','volumeMl','minOrder','quoteRequired','deliveryQuoteRequired','demoOnly'];\n   if(p.attributes&&typeof p.attributes==='object'&&!Array.isArray(p.attributes)){\n      for(const k of wh)if(Object.prototype.hasOwnProperty.call(p.attributes,k)){const v=p.attributes[k];if(typeof v==='string')attrs[k]=v.slice(0,80);else if(typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v)))attrs[k]=v;}\n   }\n   products.push({sku:p.sku.slice(0,64),name:p.name.slice(0,180),category:String(p.category??'').slice(0,80),unit:String(p.unit??'').slice(0,30),priceVnd:p.priceVnd,stock:p.stock,attributes:attrs});\n }\n return [{json:{httpStatus:200,body:{...common,products,count:products.length,limited:raw.limited===true,note:'Dữ liệu Sandbox — chưa tạo đơn hàng.'}}}];\n}\nif(raw.previewOnly!==true||!Array.isArray(raw.lines)||raw.lines.length>30)return fail('invalid_cart_response');\nconst lines=[];\nfor(const l of raw.lines){\n if(!l||typeof l!=='object'||typeof l.sku!=='string'||typeof l.name!=='string'||!Number.isFinite(l.quantity)||l.quantity<=0||!price(l.unitPriceVnd)||!price(l.lineTotalVnd)||!price(l.stock))return fail('invalid_cart_line_response');\n lines.push({sku:l.sku.slice(0,64),name:l.name.slice(0,180),unit:String(l.unit??'').slice(0,30),quantity:l.quantity,unitPriceVnd:l.unitPriceVnd,lineTotalVnd:l.lineTotalVnd,stock:l.stock,needsQuote:l.needsQuote===true});\n}\nif(raw.subtotalVnd!==null&&!price(raw.subtotalVnd))return fail('invalid_cart_total_response');\nreturn [{json:{httpStatus:200,body:{...common,lines,subtotalVnd:raw.subtotalVnd,errors:[],requiresHumanQuote:raw.requiresHumanQuote===true,previewOnly:true}}}];"}}
});
const respondSuccess=node({
 type:'n8n-nodes-base.respondToWebhook',version:1.5,
 config:{name:'Respond Verified Read Only JSON',position:[1660,180],
  parameters:{respondWith:'json',responseBody:expr('{{ JSON.stringify($json.body) }}'),
   options:{responseCode:expr('{{ $json.httpStatus }}'),responseHeaders:{"entries":[{"name":"Cache-Control","value":"no-store, max-age=0"},{"name":"X-Content-Type-Options","value":"nosniff"},{"name":"Referrer-Policy","value":"no-referrer"}]}}}}
});
const respondReject=node({
 type:'n8n-nodes-base.respondToWebhook',version:1.5,
 config:{name:'Respond Denied JSON — No Adapter',position:[1120,500],
  parameters:{respondWith:'json',responseBody:expr('{{ JSON.stringify($json.body) }}'),
   options:{responseCode:expr('{{ $json.httpStatus }}'),responseHeaders:{"entries":[{"name":"Cache-Control","value":"no-store, max-age=0"},{"name":"X-Content-Type-Options","value":"nosniff"},{"name":"Referrer-Policy","value":"no-referrer"}]}}}}
});
export default workflow('t404-v1855-headerauth-webhook-ingress-staging','TIEN404 V18.5.5 — Header Auth Read-Only Webhook Ingress STAGING')
 .add(ingress)
 .to(validate)
 .to(allowed.onTrue(callAdapter.to(sanitize.to(respondSuccess))).onFalse(respondReject))
 .group('Read-only Webhook Admission',[validate,allowed],{description:'Header Auth at ingress, strict Sandbox operation/body scope; reject caller-selected Store/Tenant.'})
 .group('Protected Adapter Readback',[callAdapter,sanitize,respondSuccess],{description:'Internal adapter only; verify and strip all authority/PII fields from the response.'});