#!/usr/bin/env node
// TIEN404 AI V5 safe static audit. Zero network, zero credentials, zero writes.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const errors=[];
const requireFile=p=>{
 const file=path.join(root,p);
 if(!fs.existsSync(file)){errors.push('missing '+p);return ''}
 return fs.readFileSync(file,'utf8');
};
const charter=requireFile('AGENTS.md');
const prompt=requireFile('docs/AI_CTO_MASTER_PROMPT_V5.md');
const status=requireFile('docs/PROJECT_STATUS_V5.md');
const gates=requireFile('docs/RELEASE_GATES_V5.md');
const registryText=requireFile('data/workflow-registry.v5.json');
for(const [name,content] of [['AGENTS',charter],['prompt',prompt],['status',status],['gates',gates]]){
 if(content.length<500)errors.push(name+' is unexpectedly short');
}
if(!charter.includes('AI_SALES_DEMO')||!prompt.includes('Commerce'))errors.push('legacy vs commerce separation missing');
let registry={workflows:[]};
try{registry=JSON.parse(registryText)}catch{errors.push('invalid workflow registry JSON')}
if(registry.snapshot_date!=='2026-11-10')errors.push('registry snapshot date incorrect');
const flows=Array.isArray(registry.workflows)?registry.workflows:[];
if(flows.length!==29)errors.push('workflow inventory expected snapshot count 29, got '+flows.length);
const ids=new Set();
const allowedRisk=new Set(['read_only','mock','unknown','may_write_orders','writes_orders','may_send_and_write','restricted','writes_tickets','may_send_email']);
const allowedDomains=new Set(['website','qa','commerce','demo','messenger']);
for(const w of flows){
 if(!w.id||ids.has(w.id))errors.push('missing or duplicate workflow id '+w.id);
 ids.add(w.id);
 if(typeof w.active!=='boolean'||!allowedDomains.has(w.domain)||!allowedRisk.has(w.risk))errors.push('invalid classification '+w.id);
}
for(const [id,domain] of [['v6PBwcqSapVzACMW','demo'],['wgkkmT7q4lm4HyuA','website'],['Z7FdV7uDvApfbURQ','messenger'],['iyfGUiEsZlNTBWOR','commerce']]){
 const w=flows.find(f=>f.id===id);
 if(!w||w.domain!==domain)errors.push('critical workflow missing or misclassified: '+id);
}
const active=flows.filter(w=>w.active).length;
if(active!==16)errors.push('snapshot 16 active workflows expected, got '+active);
const home=requireFile('index.html'),demo=requireFile('demo.html');
const widget=requireFile('assets/ai-consultant.js');
const css=requireFile('assets/live-chat.css');
for(const [name,html] of [['index.html',home],['demo.html',demo]]){
 if((html.match(/id="tien404-chat-panel"/g)||[]).length!==1)errors.push(name+' must have exactly one floating chat panel');
 if((html.match(/id="n8n-chat"/g)||[]).length!==1)errors.push(name+' must have exactly one chat mount');
 if(!html.includes('id="tien404-message"'))errors.push(name+' missing independent Android-friendly composer');
 if(!html.includes('id="tien404-chat-close"'))errors.push(name+' missing chat close control');
}
if(!demo.includes('id="ai-live"')||!demo.includes('data-tien404-open-chat'))errors.push('demo CTA anchor or button missing');
if(!widget.includes("data-tien404-open-chat")||!widget.includes("toggle(true)"))errors.push('demo open-chat behavior missing');
if(!widget.includes('c29c6398-04d1-467f-ab23-8d679cdd7133/chat'))errors.push('website AI webhook changed unexpectedly: review manually');
if(widget.includes('KrSn4DNR9ALX5ng4')||widget.includes('v6PBwcqSapVzACMW'))errors.push('public widget must not use legacy order workflow IDs');
if(!css.includes('#tien404-message')||!css.includes('tien404-chat-panel'))errors.push('widget accessibility/composer styles missing');
if(home.includes('id="tien404-super-admin"')||demo.includes('id="tien404-super-admin"'))errors.push('privileged admin UI must not ship on public Pages');
if(errors.length){
 errors.forEach(e=>console.error('FAIL: '+e));
 process.exit(1);
}
console.log('PASS: V5 charter, status, release gates, 29-workflow snapshot, legacy isolation, floating widget and CTA static contracts.');
console.log('NOTE: no real-browser, n8n runtime, payment, data writes or admin auth checks performed.');
