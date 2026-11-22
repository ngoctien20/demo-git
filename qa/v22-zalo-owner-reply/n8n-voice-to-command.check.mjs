import fs from 'fs';
const src=fs.readFileSync(new URL('./n8n-voice-to-command-v22_5.js', import.meta.url),'utf8');
const run=(json)=>new Function('$input',src)({first:()=>({json})})[0].json;
const g=(o)=>({candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}]});
const c=[
 [g({transcript:'Mua F01 hai cái',intent:'buy',sku:'F01',quantity:2,confidence:'high'}),'quote 2 agree'],
 [g({transcript:'MOF01',intent:'buy',sku:'F01',quantity:null,confidence:'medium'}),'ask agree'],
 [g({transcript:'1F01 hai cái',intent:'buy',sku:'F01',quantity:2,confidence:'medium'}),'quote2 agree'],
 [g({transcript:'F01 một bộ nhiêu',intent:'price',sku:'F01',quantity:null,confidence:'high'}),'price'],
 [g({transcript:'ừm không biết',intent:'unknown',sku:null,quantity:null,confidence:'low'}),'none'],
 [g({transcript:'Mua F01 năm hai cái',intent:'buy',sku:'F01',quantity:2,confidence:'medium'}),'none (conflict)'],
 [{error:{message:'timeout of 15000ms exceeded'}},'error'],
];
for(const [i,l] of c){const r=run(i);console.log(l,'=>',r.understood,r.how,JSON.stringify(r.command&&[r.command.action,r.command.quantity]),r.echo.transcript)}
