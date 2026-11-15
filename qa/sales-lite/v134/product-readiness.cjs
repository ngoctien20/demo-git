'use strict';
// V13.4 product alignment: commercial package HYPOTHESES, not billing configuration.
const PACKAGES=Object.freeze([
 Object.freeze({code:'SALES_LITE',name:'TIEN404 Sales Lite',priceVndHypothesis:199000,
  pricingStatus:'ASSUMPTION_ONLY',scope:'ONE_SHOP',baseChannelsHypothesis:1,
  aiCallsIncluded:null,monthlyMessageQuota:null,unlimitedAI:false}),
 Object.freeze({code:'SALES_LITE_PLUS',name:'TIEN404 Sales Lite Plus',priceVndHypothesis:349000,
  pricingStatus:'ASSUMPTION_ONLY',scope:'SHOP_SCOPED',baseChannelsHypothesis:null,
  aiCallsIncluded:null,monthlyMessageQuota:null,unlimitedAI:false})
]);
const GATES=Object.freeze([
 'AUTHENTICATED_MERCHANT','HOSTED_SHOP_AB_RLS','SUBSCRIPTION_BACKEND',
 'VERIFIED_CHANNEL_BINDING','CATALOG_PRICE_STOCK','SHARED_SALES_CORE_E2E',
 'ORDER_IDEMPOTENCY_E2E','OWNER_NOTIFICATION_E2E','PAID_REVENUE_RECONCILIATION',
 'RPC_DEFINER_SECURITY_REVIEW','COST_AND_QUOTA_VERIFICATION',
 'OWNER_RELEASE_APPROVAL'
]);
function evaluateReadiness(evidence={}){
 const present=GATES.filter(k=>evidence[k]&&evidence[k].verified===true&&
   typeof evidence[k].evidenceRef==='string'&&evidence[k].evidenceRef.trim().length>=4);
 const missing=GATES.filter(k=>!present.includes(k));
 return Object.freeze({product:'TIEN404_SALES_LITE',stage:'EXPERIMENTAL',
  readyForCandidate:missing.length===0,releaseAuthorized:false,
  verifiedGates:Object.freeze(present),remainingGates:Object.freeze(missing),
  productionChanged:false});
}
const MERCHANT_SECTIONS=Object.freeze([
 'Tổng quan','Đơn hàng','Sản phẩm','Khách hàng','Giá và tồn kho','AI bán hàng',
 'Kênh kết nối','Thông báo','Báo cáo','Gói thuê bao','Hỗ trợ','Cài đặt cửa hàng'
]);
module.exports={PACKAGES,GATES,MERCHANT_SECTIONS,evaluateReadiness};
