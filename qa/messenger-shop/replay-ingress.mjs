// Reads the project's CSV via Python's CSV parser and replays only genuine dialogue turns.
// Output contains case IDs and routing outcomes, never contact details, message bodies or raw provider logs.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const csvPath=process.argv[2];
if (!csvPath) throw Error('Usage: node replay-ingress.mjs <multi-turn.csv>');
const cases=JSON.parse(execFileSync('python3',['-c',
  "import csv,json,sys; print(json.dumps(list(csv.DictReader(open(sys.argv[1],encoding='utf-8-sig')))))",csvPath
],{encoding:'utf8'}));
const source=readFileSync(new URL('../../config-core/n8n/messenger-extract-text.v27-7.code.js',import.meta.url),'utf8');
const extract=new vm.Script('(function(){'+source+'})()');
const page='2379295362359912';
const seen=new Set();
console.log('case_id,mode,turn,ingress,reply_and_db,n8n_staging,android,ios,messenger_web');
for (const row of cases) {
  if(seen.has(row.case_id)) throw Error('Duplicate case ID: '+row.case_id);
  seen.add(row.case_id);
  const state={};
  for (const [i,text] of JSON.parse(row.turns_json).entries()) {
    let outcome='NOT_APPLICABLE';
    if(row.mode==='dialogue') {
      const sender='80000'+row.case_id.slice(2);
      const mid='qa_'+row.case_id+'_'+i;
      const body={object:'page',entry:[{id:page,messaging:[{sender:{id:sender},recipient:{id:page},
        message:{mid,text},timestamp:Date.now()}]}]};
      const items=extract.runInNewContext({$:()=>({first:()=>({json:{body}})}),$getWorkflowStaticData:()=>state},{timeout:1000});
      outcome=items.length===1 && items[0].json.messageId===mid && items[0].json.sessionId==='messenger:'+page+':'+sender
        ? 'ROUTED_'+items[0].json.mediaType : 'ROUTE_MISMATCH';
    }
    console.log([row.case_id,row.mode,i+1,outcome,'NOT_RUN','NOT_RUN','NOT_RUN','NOT_RUN','NOT_RUN'].join(','));
  }
}
