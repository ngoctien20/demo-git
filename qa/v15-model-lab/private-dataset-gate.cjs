'use strict';
/** TIEN404 V15.0-07 PREP — private CSV STRUCTURE/INTEGRITY ONLY.
 * No network, model, provider, DB, sends or customer-data output.
 * Private user CSV files stay local; public CI uses synthetic fixtures only.
 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const SINGLE = ['case_id','chatInput','expected_behavior','actual_output'];
const MULTI = ['case_id','group','mode','turns_json','expected_behavior','status'];
const MODES = new Set(['dialogue','direct','parallel']);
function parseCsv(input) {
  if (typeof input !== 'string' || input.length > 2_000_000) throw Error('INVALID_CSV_SIZE');
  const src = input.replace(/^\uFEFF/, '');
  const rows=[];let row=[],cell='',quoted=false,closedQuote=false;
  for (let i=0;i<src.length;i++) {
    const ch=src[i];
    if(quoted){
      if(ch==='"' && src[i+1]==='"'){cell+='"';i++;}
      else if(ch==='"'){quoted=false;closedQuote=true;}
      else cell+=ch;
    } else if(ch==='"'){
      if(cell!=='' || closedQuote) throw Error('INVALID_CSV_QUOTE');
      quoted=true;
    } else if(ch===','){
      row.push(cell);cell='';closedQuote=false;
    } else if(ch==='\r' || ch==='\n'){
      if(ch==='\r' && src[i+1]==='\n')i++;
      row.push(cell);
      if(row.some(v=>v!=='')) rows.push(row);
      row=[];cell='';closedQuote=false;
    } else {
      if(closedQuote)throw Error('INVALID_CSV_TRAILING_TEXT');
      cell+=ch;
    }
  }
  if(quoted)throw Error('UNCLOSED_CSV_QUOTE');
  if(row.length||cell){row.push(cell);if(row.some(v=>v!==''))rows.push(row);}
  if(!rows.length)throw Error('EMPTY_CSV');
  const header=rows.shift();
  if(rows.some(r=>r.length!==header.length))throw Error('INCONSISTENT_CSV_COLUMNS');
  return {header,rows:rows.map(r=>Object.fromEntries(header.map((k,i)=>[k,r[i]])))};
}
function inspect(bytes,{kind,expectedSha,expectedCount}={}){
  if(!Buffer.isBuffer(bytes)||!['single','multi'].includes(kind))throw Error('INVALID_GATE_INPUT');
  const sha=crypto.createHash('sha256').update(bytes).digest('hex');
  if(!/^[a-f\d]{64}$/.test(expectedSha||'') || sha!==expectedSha)throw Error('DATASET_HASH_MISMATCH');
  const {header,rows}=parseCsv(bytes.toString('utf8'));
  const need=kind==='single'?SINGLE:MULTI;
  if(JSON.stringify(header)!==JSON.stringify(need))throw Error('DATASET_SCHEMA_MISMATCH');
  if(!Number.isInteger(expectedCount)||rows.length!==expectedCount)throw Error('DATASET_ROW_COUNT_MISMATCH');
  const seen=new Set(),groups=new Map();
  for (const row of rows){
    if(!/^QA\d{2,3}$/.test(row.case_id)||seen.has(row.case_id))throw Error('DUPLICATE_OR_INVALID_CASE_ID');
    seen.add(row.case_id);
    if(!row.expected_behavior.trim())throw Error('MISSING_EXPECTATION');
    if(kind==='single'){
      if(!row.chatInput.trim() || row.actual_output.trim())throw Error('INVALID_SINGLE_CASE_STATE');
    }else{
      if(!row.group.trim()||!MODES.has(row.mode)||row.status!=='NOT_RUN')throw Error('INVALID_MULTI_CASE_STATE');
      let turns;try{turns=JSON.parse(row.turns_json)}catch{throw Error('INVALID_TURNS_JSON')}
      if(!Array.isArray(turns)||turns.length===0||turns.length>30||turns.some(t=>typeof t!=='string'||!t.trim()||t.length>4000))throw Error('INVALID_TURN_LIST');
      groups.set(row.group,(groups.get(row.group)||0)+1);
    }
  }
  return Object.freeze({kind,sha256:sha,row_count:rows.length,unique_case_count:seen.size,
    group_count:groups.size,model_evaluations:0,pass_model_quality:null,
    status:'DATASET_STRUCTURAL_READY_NOT_MODEL_TESTED',raw_text_exported:false});
}
function checkPrivateUploads({singlePath,multiPath,manifestPath}){
  if(![singlePath,multiPath,manifestPath].every(x=>typeof x==='string'&&x))throw Error('MISSING_LOCAL_FILE_PATH');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const get=name=>manifest.datasets.find(x=>x.name===name);
  const single=get('AI_SALES_QA_96_SINGLE_TURN.csv');
  const multi=get('AI_SALES_36_MULTI_TURN_FOR_LATER.csv');
  if(!single||!multi)throw Error('DATASET_MANIFEST_INCOMPLETE');
  if(path.basename(singlePath)!==single.name||path.basename(multiPath)!==multi.name)throw Error('LOCAL_DATASET_NAME_MISMATCH');
  const s=inspect(fs.readFileSync(singlePath),{kind:'single',expectedSha:single.sha256,expectedCount:single.rows});
  const m=inspect(fs.readFileSync(multiPath),{kind:'multi',expectedSha:multi.sha256,expectedCount:multi.rows});
  return Object.freeze({version:'V15.0-07-prep',scope:'PRIVATE_LOCAL_INTEGRITY_ONLY',single:s,multi:m,
    total_unique_cases:s.row_count+m.row_count,model_quality_tested:false,paid_api_calls:0,
    catalog_frozen:false,provider_credentials_accessed:false,no_send:true});
}
if(require.main===module){
 try{
   const [singlePath,multiPath,manifestPath]=process.argv.slice(2);
   process.stdout.write(JSON.stringify(checkPrivateUploads({singlePath,multiPath,manifestPath}),null,2)+'\n');
 }catch(e){process.stderr.write(JSON.stringify({status:'BLOCKED',reason:e.message})+'\n');process.exitCode=1;}
}
module.exports={parseCsv,inspect,checkPrivateUploads};
