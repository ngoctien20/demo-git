'use strict';
/** TIEN404 V15 Offline private QA corpus inventory — never sends raw text out. */
const fs=require('node:fs'),crypto=require('node:crypto');
function parseCsv(csv){
 if(typeof csv!=='string')throw Error('INVALID_CSV');
 const text=csv.replace(/^\uFEFF/,'');
 let rows=[],row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else quoted=false;}else cell+=c;continue}
  if(c==='"'){if(cell!=='')throw Error('INVALID_QUOTE_BOUNDARY');quoted=true;continue}
  if(c===','){row.push(cell);cell='';continue}
  if(c==='\r'&&text[i+1]==='\n'){i++;row.push(cell);cell='';rows.push(row);row=[];continue}
  if(c==='\n'||c==='\r'){row.push(cell);cell='';rows.push(row);row=[];continue}
  cell+=c;
 }
 if(quoted)throw Error('UNTERMINATED_QUOTE');
 if(cell!==''||row.length){row.push(cell);rows.push(row)}
 if(rows.length===0)throw Error('EMPTY_CSV');
 const fields=rows.shift();
 if(new Set(fields).size!==fields.length)throw Error('DUPLICATE_HEADERS');
 return rows.filter(r=>r.some(c=>c!=='')).map(r=>{
   if(r.length!==fields.length)throw Error('CSV_WIDTH_MISMATCH');
   return Object.fromEntries(fields.map((k,i)=>[k,r[i]]));
 });
}
function corpusReport(singleText,multiText,historicalText){
 const files=[singleText,multiText,historicalText].map(x=>({rows:parseCsv(x),sha256:crypto.createHash('sha256').update(Buffer.from(x)).digest('hex')}));
 const [single,multi,historical]=files.map(x=>x.rows);
 function unique(rows){return new Set(rows.map(x=>x.case_id)).size}
 const repeated=(rows)=>Object.entries(rows.reduce((a,r)=>(a[r.case_id]=(a[r.case_id]||0)+1,a),{})).filter(([,count])=>count>1).map(([id])=>id);
 let validMulti=0,turnTotal=0,badMulti=0;
 for(const row of multi){try{const t=JSON.parse(row.turns_json);if(!Array.isArray(t)||t.length===0||t.length>50||t.some(s=>typeof s!=='string'||s.length>2500))throw Error('INVALID_TURNS');validMulti++;turnTotal+=t.length;}catch{badMulti++}}
 const goodSingle=single.length===96&&unique(single)===96&&single.every(x=>x.case_id&&typeof x.chatInput==='string'&&x.chatInput.length>0);
 const goodMulti=multi.length===36&&unique(multi)===36&&badMulti===0;
 return {version:'V15.0-07-OFFLINE-PREPARATION',type:'PRIVATE_CORPUS_SCHEMA_ONLY',
  no_raw_messages_exported:true,model_api_calls:0,actual_accuracy_measured:false,
  corpus_ready_for_model_benchmark:goodSingle&&goodMulti,
  single_turn:{rows:single.length,unique_case_ids:unique(single),sha256:files[0].sha256,
    blank_actual_output:single.filter(x=>!x.actual_output?.trim()).length,duplicate_case_id_count:repeated(single).length},
  multi_turn:{rows:multi.length,unique_case_ids:unique(multi),sha256:files[1].sha256,
    valid_turn_json_cases:validMulti,invalid_turn_json_cases:badMulti,total_turns:turnTotal,
    not_run_status_count:multi.filter(x=>x.status==='NOT_RUN').length},
  historical:{rows:historical.length,unique_case_ids:unique(historical),sha256:files[2].sha256,
    duplicate_case_id_count:repeated(historical).length,not_fresh_v15_provider_benchmark:true},
  owner_approval_needed_for_paid_model_trials:true,can_send:false,customer_data_uploaded:false};
}
function run(args=process.argv.slice(2)){
 if(args.length!==3)throw Error('USAGE: node private-dataset-audit.cjs single.csv multi.csv historical.csv');
 const result=corpusReport(...args.map(p=>fs.readFileSync(p,'utf8')));
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
 return result;
}
if(require.main===module)try{run()}catch(e){process.stderr.write('CORPUS_READINESS_BLOCKED: '+e.message+'\n');process.exitCode=1}
module.exports={parseCsv,corpusReport,run};
