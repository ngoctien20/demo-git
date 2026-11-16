/** V16.2 scenario modeling only. USD and tokens are external input; no charge/call. */
const safe=(n)=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
export function scenario({shops,messagesPerShop,aiFraction,callsPerAiTurn,inputTokensPerCall,outputTokensPerCall,inputUsdPerMillion,outputUsdPerMillion,retryMultiplier=1}){
 const vals=[shops,messagesPerShop,aiFraction,callsPerAiTurn,inputTokensPerCall,outputTokensPerCall,inputUsdPerMillion,outputUsdPerMillion,retryMultiplier];
 if(vals.some(v=>!safe(v))||!Number.isSafeInteger(shops)||!Number.isSafeInteger(messagesPerShop)||shops===0||aiFraction>1||callsPerAiTurn<1||retryMultiplier<1)throw Error('INVALID_FINOPS_SCENARIO');
 const messages=shops*messagesPerShop,aiTurns=messages*aiFraction,modelCalls=aiTurns*callsPerAiTurn*retryMultiplier;
 const apiUsd=modelCalls*(inputTokensPerCall*inputUsdPerMillion+outputTokensPerCall*outputUsdPerMillion)/1e6;
 return {shops,messagesPerShop,aiFraction,messages,aiTurns,modelCalls,apiUsd:+apiUsd.toFixed(6),
  apiUsdPerShop:+(apiUsd/shops).toFixed(6),nonModelCogsUsd:null,grossMargin:null,realSpendUsd:null,status:'ILLUSTRATIVE_SCENARIO_ONLY'};
}
export function fullGrid(config){
 const rows=[];
 for(const shops of [1,5,20,50,100])for(const messagesPerShop of [500,2000,10000,50000])for(const aiFraction of [.2,.5,.8])
 rows.push(scenario({...config,shops,messagesPerShop,aiFraction}));
 return rows;
}
export function grossMargin(revenueUsd,verifiedCogsUsd){
 if(!safe(revenueUsd)||revenueUsd<=0||!safe(verifiedCogsUsd))return null;
 return (revenueUsd-verifiedCogsUsd)/revenueUsd;
}
