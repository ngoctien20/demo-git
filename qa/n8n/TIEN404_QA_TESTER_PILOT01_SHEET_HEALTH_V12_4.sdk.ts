
import {workflow,trigger,node,newCredential} from '@n8n/workflow-sdk';
const start=trigger({type:'n8n-nodes-base.manualTrigger',version:1,config:{name:'Manual QA Sheet Probe',position:[240,300]},output:[{}]});
const read=node({type:'n8n-nodes-base.googleSheets',version:4.7,config:{
  name:'Read QA Google Products LIVE',
  parameters:{resource:'sheet',operation:'read',authentication:'oAuth2',
    documentId:{__rl:true,mode:'id',value:'17rjkZV_u9ye17BLimCePYC7EyZML2GlXSHfX8dFVTgM',cachedResultName:'TIEN404 QA Model Sandbox'},
    sheetName:{__rl:true,mode:'name',value:'Products'},
    options:{outputFormatting:{values:{general:'UNFORMATTED_VALUE',date:'FORMATTED_STRING'}}}
  },
  credentials:{googleSheetsOAuth2Api:newCredential('Google Sheets account')},
  position:[520,300]
},output:[{sku:'A002',name:'Áo thun nam trắng basic size M',price:'159.000đ',stock:25,price_clean:159000}]});
const audit=node({type:'n8n-nodes-base.code',version:2,config:{
  name:'Verify QA Schema and Stock/Price',
  parameters:{mode:'runOnceForAllItems',language:'javaScript',
  jsCode:"const input=$input.all().map(x=>x.json||{});const skus=new Set();const errors=[];let sum=0;for(const r of input){const sku=String(r.sku||'').trim();const name=String(r.name||'').trim();const pc=Number(r.price_clean);const stock=Number(r.stock);const formatted=String(r.price||'').replace(/[.\\sđ₫,]/g,'');if(!/^[A-Z][0-9]{3}$/.test(sku))errors.push('invalid_sku');if(skus.has(sku))errors.push('duplicate_sku');skus.add(sku);if(name.length<3)errors.push('empty_name');if(!Number.isSafeInteger(pc)||pc<0)errors.push('invalid_price_clean');if(!Number.isInteger(stock)||stock<0)errors.push('invalid_stock');if(formatted!==String(pc))errors.push('price_mismatch');sum+=Number.isSafeInteger(pc)?pc:0;}const a=input.find(r=>r.sku==='A002');return [{json:{dataSource:'QA Google Sheets / Products',records:input.length,uniqueSku:skus.size,healthy:errors.length===0,violations:[...new Set(errors)].slice(0,8),a002Present:!!a,a002Price:a?Number(a.price_clean):null,a002Stock:a?Number(a.stock):null,hasOrdersOrCustomers:false,checkedAt:new Date().toISOString()}}];"
  },position:[810,300]
},output:[{dataSource:'QA Google Sheets / Products',records:21,uniqueSku:21,healthy:true,violations:[],a002Present:true,a002Price:159000,a002Stock:25,hasOrdersOrCustomers:false}]});
export default workflow('tien404-qa-tester-pilot01-sheet-health-v12-4','TIEN404_QA_TESTER_PILOT01_SHEET_HEALTH_V12_4').add(start).to(read).to(audit);
