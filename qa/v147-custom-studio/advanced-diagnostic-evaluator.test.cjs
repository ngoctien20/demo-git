'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const intel=require('./advanced-ai-intelligence.js');
const suite=require('./advanced-intent-diagnostic-challenge.json');
const diag=require('./advanced-diagnostic-evaluator.cjs');
test('01 challenge shape valid',()=>assert.equal(diag.validateSuite(suite),true));
test('02 challenge has 68 cases',()=>assert.equal(suite.total,68));
test('03 distinct diagnostic IDs',()=>assert.equal(new Set(suite.cases.map(x=>x.id)).size,68));
test('04 eight normal intents represented',()=>assert.equal(new Set(suite.cases.filter(x=>x.group==='PARAPHRASE').map(x=>x.gold)).size,8));
test('05 all attack cases ask for abstain',()=>{
 for(const c of suite.cases.filter(x=>x.group==='ADVERSARIAL'))assert.equal(c.gold,'ABSTAIN');
});
test('06 all ambiguous cases need review',()=>{
 for(const c of suite.cases.filter(x=>x.group==='MULTI_INTENT_REQUIRES_REVIEW'))assert.equal(c.gold,'ABSTAIN');
});
test('07 no real customer identifiers in fixture',()=>{
 for(const c of suite.cases)assert(!/\b0[3-9]\d{8}\b/.test(c.input),c.id);
});
test('08 independent diagnostic is not model evidence',()=>{
 const r=diag.evaluate();assert.equal(r.liveModelAccuracyCertified,false);
 assert.equal(r.evaluationType,'DETERMINISTIC_HEURISTIC_DIAGNOSTIC_NOT_MODEL');
});
test('09 cannot authorize production from synthetic results',()=>{
 const r=diag.evaluate();assert.equal(r.operationalReleaseGate,'BLOCKED');
 assert.equal(r.canPublish,false);assert.equal(r.providerSends,0);assert.equal(r.orderWrites,0);
});
test('10 heuristic is not guaranteed to generalize to new wording',()=>{
 const r=diag.evaluate();assert(r.correct<r.total,'Diagnostic must be distinct enough to expose gaps');
});
test('11 every challenged case returns auditable disposition',()=>{
 const r=diag.evaluate();assert.equal(r.rows.length,68);
 assert(r.rows.every(x=>typeof x.actual==='string'&&typeof x.exact==='boolean'));
});
test('12 group counts are exactly 48+12+8',()=>{
 const g=diag.evaluate().byGroup;
 assert.equal(g.PARAPHRASE.count,48);assert.equal(g.ADVERSARIAL.count,12);
 assert.equal(g.MULTI_INTENT_REQUIRES_REVIEW.count,8);
});
test('13 all unsupported external outputs reported INVALID',()=>{
 const r=diag.evaluate(()=>({intent:'GIVE_ADMIN_ACCESS',schema_version:intel.SCHEMA_VERSION}));
 assert.equal(r.correct,0);assert.equal(r.byGroup.PARAPHRASE.invalid,48);
});
test('14 external gold oracle does not masquerade as real model',()=>{
 const r=diag.evaluate((_,c)=>({schema_version:intel.SCHEMA_VERSION,intent:c.gold}));
 assert.equal(r.correct,68);assert.equal(r.evaluationType,'EXTERNAL_PREDICTIONS_UNVERIFIED');
 assert.equal(r.liveModelAccuracyCertified,false);
});
test('15 model output with invented price fails schema',()=>{
 const r=diag.evaluate(()=>({...{schema_version:intel.SCHEMA_VERSION,intent:'QUOTE'},price:500}));
 assert.equal(r.correct,0);assert.equal(r.byGroup.ADVERSARIAL.invalid,12);
});
test('16 no model spend in diagnostic',()=>{
 const r=diag.evaluate();assert.equal(r.realModelCalls,0);assert.equal(r.inputTokens,null);
 assert.equal(r.outputTokens,null);
});
test('17 all high risk misclassifications are counted unsafe',()=>{
 const r=diag.evaluate(()=>({schema_version:intel.SCHEMA_VERSION,intent:'QUOTE'}));
 assert.equal(r.unsafeCount,20);
});
test('18 paraphrase mismatch does not imply security unsafe',()=>{
 const r=diag.evaluate(()=>({schema_version:intel.SCHEMA_VERSION,intent:'ABSTAIN'}));
 assert.equal(r.unsafeCount,0);assert.equal(r.byGroup.PARAPHRASE.correct,0);
});
test('19 malformed suite rejected',()=>{
 assert.throws(()=>diag.validateSuite({...suite,ordinary:47}),/ADV3B_COUNTS_INVALID/);
});
test('20 duplicate IDs rejected',()=>{
 const s=structuredClone(suite);s.cases[1].id=s.cases[0].id;
 assert.throws(()=>diag.validateSuite(s),/ADV3B_CASE_INVALID/);
});
test('21 model context is not derived from arbitrary customer labels',()=>{
 const r=diag.evaluate();assert.equal(r.modelUsed,null);assert.equal(r.operationalReleaseGate,'BLOCKED');
});
test('22 distinct from original 76 authored labels',()=>{
 const prior=require('./advanced-presentation-corpus.json');
 const a=new Set(prior.cases.map(x=>x.input.toLowerCase()));
 assert(suite.cases.some(x=>!a.has(x.input.toLowerCase())));
 assert.equal(prior.cases.length,76);
});
test('23 exact user-trusted action demands still stay separate from classifier',()=>{
 const r=diag.evaluate();assert(!('signedActionIssued' in r));
});
test('24 invalid suspicious result never produces executable action',()=>{
 const r=diag.evaluate(()=>({schema_version:intel.SCHEMA_VERSION,intent:'ORDER_REQUEST'}));
 assert.equal(r.orderWrites,0);assert.equal(r.providerSends,0);
});