// TIEN404 V14.5-LIVE03B — n8n MANUAL QA DEMONSTRATOR ONLY.
// This is NOT the actual HMAC verifier or the GitHub Node.js server guard.
// No webhook, no credentials, no Google Sheets/Meta HTTP/DB/AI Agent.
// A signed context in this test means a SYNTHETIC HARNESS FLAG, never proof
// about an actual Meta webhook. Real crypto/HMAC is tested in GitHub PR #116.
const selected=String($input.first()?.json?.scenario||'ALL').trim().toUpperCase();
const bindings={
 PAGE_QA_A:{tenant:'TENANT_QA_1',store:'SHOP_QA_A',sku:'A002',priceVnd:159000,stock:25},
 PAGE_QA_B:{tenant:'TENANT_QA_1',store:'SHOP_QA_B',sku:'A002',priceVnd:209000,stock:8}
};
const ALLOWED=new Set(['catalog.read','quote.read','qa.order.prepare','qa.order.confirm']);
const blocked=(reason)=>({allowed:false,status:'DENIED',reason});
function env(){
 const pending=new Map(),mockOrders=new Map();
 function gate({tool,context,args={}}){
  if(!context||context.syntheticSignedContext!==true)return blocked('UNVERIFIED_QA_CONTEXT');
  const scope=bindings[context.pageId];
  if(!scope)return blocked('PAGE_NOT_BOUND');
  if(Object.keys(args).some(k=>/^(tenantId|storeId|pageId|role|isAdmin|force|verified|dryRun)$/i.test(k)))
   return blocked('CLIENT_SCOPE_OVERRIDE');
  if(!ALLOWED.has(tool))return blocked('TOOL_NOT_ALLOWLISTED');
  const price=scope.priceVnd,stock=scope.stock;
  if(tool==='catalog.read')return args.sku===scope.sku?{allowed:true,status:'SYNTHETIC_READ',priceVnd:price,stock}:blocked('SKU_NOT_IN_SHOP');
  if(tool==='quote.read'){
   if(args.sku!==scope.sku)return blocked('SKU_NOT_IN_SHOP');
   if(!Number.isSafeInteger(args.quantity)||args.quantity<1)return blocked('INVALID_QUANTITY');
   return {allowed:true,status:'SYNTHETIC_QUOTE',priceVnd:price,total:price*args.quantity,stock};
  }
  if(tool==='qa.order.prepare'){
   if(args.sku!==scope.sku)return blocked('SKU_NOT_IN_SHOP');
   if(!Number.isSafeInteger(args.quantity)||args.quantity<1)return blocked('INVALID_QUANTITY');
   if(args.quantity>stock)return blocked('INSUFFICIENT_STOCK');
   if(args.expectedTotalVnd!==args.quantity*price)return blocked('TOTAL_MISMATCH');
   if(!/^Tôi muốn đặt [1-9]\d*/i.test(context.syntheticSignedText||''))
    return blocked('NO_EXPLICIT_QA_ORDER_INTENT');
   const key=context.pageId+'|'+context.syntheticSender;
   pending.set(key,{confirmation:'QA-DRYRUN-0001',total:args.expectedTotalVnd});
   return {allowed:true,status:'QA_PREPARED_NOT_SAVED',confirmation:'QA-DRYRUN-0001'};
  }
  if(tool==='qa.order.confirm'){
   const key=context.pageId+'|'+context.syntheticSender,p=pending.get(key);
   if(!p)return blocked('NO_PENDING');
   if(args.confirmation!==p.confirmation||context.syntheticSignedText!=='XAC NHAN '+p.confirmation)
    return blocked('EXPLICIT_CONFIRMATION_REQUIRED');
   if(!mockOrders.has(key))mockOrders.set(key,{code:p.confirmation,status:'SIMULATED_ONLY'});
   return {allowed:true,status:'QA_SIMULATED_NOT_SAVED',replay:mockOrders.size===1,
     mockRequestCount:mockOrders.size};
  }
  return blocked('DEFAULT_DENY');
 }
 const context=(pageId='PAGE_QA_A',syntheticSignedText='Tôi muốn đặt 2 áo A002',
   signed=true,sender='QA_BUYER')=>({pageId,syntheticSignedText,
     syntheticSignedContext:signed,syntheticSender:sender});
 return {gate,context,summary:()=>({pending:pending.size,mockRequests:mockOrders.size})};
}
const cases={
 BLOCK_CREATE_ORDER(){const e=env(),r=e.gate({tool:'create_order',context:e.context()});return r.reason==='TOOL_NOT_ALLOWLISTED';},
 BLOCK_MANAGE_ORDER(){const e=env(),r=e.gate({tool:'manage_order',context:e.context()});return r.reason==='TOOL_NOT_ALLOWLISTED';},
 BLOCK_UPDATE_ADDRESS(){const e=env(),r=e.gate({tool:'update_order_address',context:e.context()});return r.reason==='TOOL_NOT_ALLOWLISTED';},
 BLOCK_META_SEND(){const e=env(),r=e.gate({tool:'send_messenger_reply',context:e.context()});return r.reason==='TOOL_NOT_ALLOWLISTED';},
 BLOCK_HTTP(){const e=env(),r=e.gate({tool:'http.request',context:e.context()});return r.reason==='TOOL_NOT_ALLOWLISTED';},
 BLOCK_UNKNOWN(){const e=env(),r=e.gate({tool:'otherAgentTool',context:e.context()});return r.reason==='TOOL_NOT_ALLOWLISTED';},
 BLOCK_UNVERIFIED(){const e=env(),r=e.gate({tool:'quote.read',context:e.context('PAGE_QA_A','Xin chào',false),args:{sku:'A002',quantity:1}});return r.reason==='UNVERIFIED_QA_CONTEXT';},
 BLOCK_FAKE_ADMIN(){const e=env(),r=e.gate({tool:'quote.read',context:e.context(),args:{sku:'A002',quantity:1,isAdmin:true}});return r.reason==='CLIENT_SCOPE_OVERRIDE';},
 BLOCK_STORE_OVERRIDE(){const e=env(),r=e.gate({tool:'quote.read',context:e.context(),args:{sku:'A002',quantity:1,storeId:'SHOP_QA_B'}});return r.reason==='CLIENT_SCOPE_OVERRIDE';},
 READ_CATALOG_A(){const e=env(),r=e.gate({tool:'catalog.read',context:e.context(),args:{sku:'A002'}});return r.allowed&&r.priceVnd===159000&&r.stock===25;},
 QUOTE_SHOP_A(){const e=env(),r=e.gate({tool:'quote.read',context:e.context(),args:{sku:'A002',quantity:2}});return r.allowed&&r.total===318000;},
 ISOLATE_SHOP_B(){const e=env(),r=e.gate({tool:'quote.read',context:e.context('PAGE_QA_B'),args:{sku:'A002',quantity:1}});return r.allowed&&r.priceVnd===209000&&r.stock===8;},
 BLOCK_SHOP_B_PRICE_A(){const e=env(),r=e.gate({tool:'qa.order.prepare',context:e.context('PAGE_QA_B','Tôi muốn đặt 1 áo A002'),args:{sku:'A002',quantity:1,expectedTotalVnd:159000}});return r.reason==='TOTAL_MISMATCH'&&e.summary().mockRequests===0;},
 BLOCK_QUOTE_AS_ORDER(){const e=env(),r=e.gate({tool:'qa.order.prepare',context:e.context('PAGE_QA_A','Báo giá nhé, chưa đặt'),args:{sku:'A002',quantity:2,expectedTotalVnd:318000}});return r.reason==='NO_EXPLICIT_QA_ORDER_INTENT';},
 PREPARE_NO_WRITE(){const e=env(),r=e.gate({tool:'qa.order.prepare',context:e.context(),args:{sku:'A002',quantity:2,expectedTotalVnd:318000}});return r.status==='QA_PREPARED_NOT_SAVED'&&e.summary().mockRequests===0;},
 CONFIRM_MOCK_ONLY(){const e=env();e.gate({tool:'qa.order.prepare',context:e.context(),args:{sku:'A002',quantity:2,expectedTotalVnd:318000}});
 const r=e.gate({tool:'qa.order.confirm',context:e.context('PAGE_QA_A','XAC NHAN QA-DRYRUN-0001'),args:{confirmation:'QA-DRYRUN-0001'}});return r.status==='QA_SIMULATED_NOT_SAVED'&&e.summary().mockRequests===1;},
 BLOCK_CONFIRM_NO_TEXT(){const e=env();e.gate({tool:'qa.order.prepare',context:e.context(),args:{sku:'A002',quantity:2,expectedTotalVnd:318000}});
 const r=e.gate({tool:'qa.order.confirm',context:e.context('PAGE_QA_A','Tôi chưa xác nhận'),args:{confirmation:'QA-DRYRUN-0001'}});return r.reason==='EXPLICIT_CONFIRMATION_REQUIRED';},
 REPLAY_MOCK_NO_DUPLICATE(){const e=env();e.gate({tool:'qa.order.prepare',context:e.context(),args:{sku:'A002',quantity:2,expectedTotalVnd:318000}});
 for(let i=0;i<2;i++)e.gate({tool:'qa.order.confirm',context:e.context('PAGE_QA_A','XAC NHAN QA-DRYRUN-0001'),args:{confirmation:'QA-DRYRUN-0001'}});
 return e.summary().mockRequests===1;},
 BLOCK_INSUFFICIENT_STOCK(){const e=env(),r=e.gate({tool:'qa.order.prepare',context:e.context('PAGE_QA_A','Tôi muốn đặt 26 áo A002'),args:{sku:'A002',quantity:26,expectedTotalVnd:26*159000}});return r.reason==='INSUFFICIENT_STOCK';},
 BLOCK_WRONG_TOTAL(){const e=env(),r=e.gate({tool:'qa.order.prepare',context:e.context(),args:{sku:'A002',quantity:2,expectedTotalVnd:1000}});return r.reason==='TOTAL_MISMATCH';},
 BLOCK_CROSS_SENDER_CONFIRM(){const e=env();e.gate({tool:'qa.order.prepare',context:e.context(),args:{sku:'A002',quantity:2,expectedTotalVnd:318000}});
 const r=e.gate({tool:'qa.order.confirm',context:e.context('PAGE_QA_A','XAC NHAN QA-DRYRUN-0001',true,'QA_OTHER'),args:{confirmation:'QA-DRYRUN-0001'}});return r.reason==='NO_PENDING';}
};
const targets=selected==='ALL'?Object.keys(cases):[selected];
return targets.map(name=>{
 let pass=false;
 try{pass=!!(cases[name]&&cases[name]());}catch(_){pass=false;}
 return {json:{version:'V14.5-LIVE03B',scenario:name,status:pass?'PASS':'FAIL',
 testMode:'INACTIVE_MANUAL_SYNTHETIC_QA_ONLY',
 syntheticSignatureFlagOnly:true,realHmacValidationInThisLab:false,
 externalToolCalls:0,googleSheetsWrites:0,hostedWrites:0,
 orderWrites:0,stockWrites:0,providerSends:0,
 isRealOrder:false,isRealMessengerTest:false,
 note:'QA showcase, not live Messenger enforcement. Crypto HMAC separately tested in GitHub PR #116.'}};
});