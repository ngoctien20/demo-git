'use strict';
/*
 * ADV.3B independent diagnostic report (synthetic paraphrase challenge).
 * This is NOT a live/model score, and a PASS means evaluator integrity,
 * NOT AI accuracy. No network, paid inference, business tools or secrets.
 */
const fs=require('node:fs'),path=require('node:path');
const intelligence=require('./advanced-ai-intelligence.js');
const suite=require('./advanced-intent-diagnostic-challenge.json');
function validateSuite(data){
 if(!data||data.schema!=='TIEN404_ADV3B_CHALLENGE_V1'||data.synthetic!==true||
  data.notBlindHoldout!==true||!Array.isArray(data.cases)||data.cases.length!==68)
  throw Error('ADV3B_DIAGNOSTIC_INVALID');
 const seen=new Set();
 for(const c of data.cases){
  if(!c||seen.has(c.id)||typeof c.input!=='string'||c.input.length<3||
   !intelligence.INTENTS.includes(c.gold)||!['PARAPHRASE','ADVERSARIAL','MULTI_INTENT_REQUIRES_REVIEW'].includes(c.group))
   throw Error('ADV3B_CASE_INVALID');
  seen.add(c.id);
  if((c.group==='PARAPHRASE')===(c.highRisk===true))throw Error('ADV3B_RISK_LABEL_INVALID');
 }
 if(data.ordinary!==48||data.adversarial!==12||data.ambiguous!==8||
   data.total!==68||seen.size!==68)throw Error('ADV3B_COUNTS_INVALID');
 return true;
}
function evaluate(predict=intelligence.heuristic){
 validateSuite(suite);
 const byGroup={},rows=[];
 for(const item of suite.cases){
  let got='INVALID',error=null;
  try{got=intelligence.validateModelOutput(predict(item.input,item)).intent}
  catch(e){error=e.message}
  const exact=got===item.gold,unsafe=item.highRisk&&got!=='ABSTAIN';
  byGroup[item.group]??={count:0,correct:0,unsafe:0,invalid:0};
  const group=byGroup[item.group];
  group.count++;if(exact)group.correct++;if(unsafe)group.unsafe++;if(got==='INVALID')group.invalid++;
  rows.push({id:item.id,expected:item.gold,actual:got,group:item.group,exact,unsafe,error});
 }
 const correct=rows.filter(x=>x.exact).length,unsafe=rows.filter(x=>x.unsafe).length;
 return {
  reportVersion:'TIEN404_ADV3B_DIAGNOSTIC_V1',
  source:'SYNTHETIC_AUTHOR_CRAFTED_SEPARATE_CHALLENGE_NOT_BLIND',
  evaluationType:predict===intelligence.heuristic?'DETERMINISTIC_HEURISTIC_DIAGNOSTIC_NOT_MODEL':'EXTERNAL_PREDICTIONS_UNVERIFIED',
  total:rows.length,correct,accuracy:correct/rows.length,
  unsafeCount:unsafe,byGroup,
  modelUsed:null,realModelCalls:0,inputTokens:null,outputTokens:null,providerSends:0,
  orderWrites:0,canPublish:false,liveModelAccuracyCertified:false,
  operationalReleaseGate:'BLOCKED',rows
 };
}
if(require.main===module){
 const args=process.argv.slice(2);
 if(args.length>1)throw Error('ADV3B_ONE_PREDICTION_FILE_MAX');
 let report;
 if(args.length===1){
  const raw=JSON.parse(fs.readFileSync(path.resolve(args[0]),'utf8'));
  if(!Array.isArray(raw)||raw.length!==68)throw Error('ADV3B_PREDICTIONS_COUNT');
  const map=new Map();
  for(const item of raw){
   if(!item||typeof item.id!=='string'||map.has(item.id)||item.output===undefined)
    throw Error('ADV3B_PREDICTIONS_ROW');
   map.set(item.id,item.output);
  }
  report=evaluate((_,row)=>map.get(row.id));
 }else report=evaluate();
 const dir='qa-artifacts-v152-adv3b';
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'diagnostic.json'),JSON.stringify(report,null,2)+'\n');
 console.log('ADV3B diagnostic '+report.correct+'/'+report.total+
   ', high-risk unsafe '+report.unsafeCount+'/20. NOT AI model benchmark. RELEASE BLOCKED.');
 // CI must not fake accuracy or transform an identified weakness into green release approval.
 if(report.operationalReleaseGate!=='BLOCKED'||report.realModelCalls!==0)process.exitCode=2;
}
module.exports={validateSuite,evaluate};