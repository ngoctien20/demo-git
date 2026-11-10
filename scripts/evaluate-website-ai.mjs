#!/usr/bin/env node
// TIEN404 Website AI V4.2 read-only regression evaluator.
// Usage: node scripts/evaluate-website-ai.mjs <results.json>
// results.json: [{ "id":"WEB-01", "execution_id":"1605", "output":"..." }, ...]
// Does not call n8n, write orders, or publish workflows.
import fs from 'node:fs';
const fixture=JSON.parse(fs.readFileSync(new URL('../data/website-ai-qa-cases.v1.json',import.meta.url),'utf8'));
const file=process.argv[2];
if(!file){console.error('Usage: node scripts/evaluate-website-ai.mjs <results.json>');process.exit(2)}
const results=JSON.parse(fs.readFileSync(file,'utf8'));
if(!Array.isArray(results)){throw Error('results must be an array')}
const normalize=x=>String(x||'').normalize('NFC').toLowerCase();
const rows=fixture.map(t=>{
 const matches=results.filter(r=>r.id===t.id);
 const r=matches.length===1?matches[0]:null;
 const output=normalize(r?.output);
 const any=(t.must_include_any||[]).some(x=>output.includes(normalize(x)));
 const forbidden=(t.must_not_include||[]).filter(x=>output.includes(normalize(x)));
 const status=!r?'NOT_RUN':!r.execution_id?'NO_EVIDENCE':any&&forbidden.length===0?'HEURISTIC_PASS':'REVIEW';
 return {id:t.id,status,execution_id:r?.execution_id||'',reason:!r?'Missing result':forbidden.length?'Forbidden phrase: '+forbidden.join(', '):!any?'Missing expected topic':'Requires human review for semantic correctness'};
});
console.table(rows);
const summary=Object.fromEntries(['HEURISTIC_PASS','REVIEW','NO_EVIDENCE','NOT_RUN'].map(s=>[s,rows.filter(x=>x.status===s).length]));
console.log(JSON.stringify(summary,null,2));
if(rows.some(x=>x.status!=='HEURISTIC_PASS'))process.exitCode=1;
// A heuristic pass is never proof of production readiness.
