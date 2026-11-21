const fs=require('node:fs');
const path=require('node:path');
const locations=[
path.resolve('qa/qa-results/results.json'),
path.resolve('qa-results/results.json')
];
const file=locations.find(x=>fs.existsSync(x));
if(!file){console.log('### TIEN404 QA\n\nNo Playwright JSON file found; inspect execution logs.');process.exit(0);}
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const stats=data.stats||{};
const passed=stats.expected??0,failed=stats.unexpected??0,flaky=stats.flaky??0,skipped=stats.skipped??0;
const t=passed+failed+flaky+skipped;
console.log('## TIEN404 AI · Full-browser QA');
console.log('\n| Result | Count |\n|---|---:|\n| Passed | '+passed+' |\n| Failed | '+failed+' |\n| Flaky | '+flaky+' |\n| Skipped | '+skipped+' |\n| Total | '+t+' |');
const errors=[];
function visit(s){
 for(const spec of s.specs||[]){
  for(const test of spec.tests||[]){
   if(test.status==='unexpected'||test.status==='flaky'){
    errors.push(spec.title+' — '+(test.results||[]).map(r=>r.error?.message?.split('\n')[0]).filter(Boolean).join('; '));
   }
  }
 }
 for(const child of s.suites||[])visit(child);
}
for(const suite of data.suites||[])visit(suite);
if(errors.length) {
 console.log('\n### Tests requiring attention');
 errors.slice(0,12).forEach(e=>console.log('- '+e.replaceAll('|','/').slice(0,280)));
}else console.log('\nNo automated failures detected in this run.');
console.log('\n**Scope note:** AI chat and account/payment features remain demo; a green run does not certify production readiness.');
