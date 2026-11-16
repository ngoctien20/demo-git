import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGE,qaScope,qaContext} from './qa-contract.mjs';
import {SINGLE_CASES,MULTI_PACK,MANIFEST_METADATA} from './manifest-132.mjs';
import {createFaqStudio,faqStudioUiContract} from './faq-studio.mjs';
import {createCostCenter} from './cost-center.mjs';
import {previewQueue,priorityDashboardUiContract} from './priority-dashboard.mjs';
import {createHandoffPreview,shouldHandoff} from './human-handoff.mjs';
import {build132Manifest,planAbLab,evaluationEvidenceGate,aggregateAbRows,CANDIDATES} from './model-ab-lab.mjs';
const qa=(role='owner',store_id='QA_STORE_A',tenant_id='QA_TENANT_ONE',actor_id='QA_OWNER_A')=>
 ({stage:STAGE,enrolled:true,role,store_id,tenant_id,actor_id});
const owner=qa(),manager=qa('manager','QA_STORE_A','QA_TENANT_ONE','QA_MANAGER_A'),
 reviewer=qa('reviewer','QA_STORE_A','QA_TENANT_ONE','QA_REVIEWER_A'),
 system=qa('system','QA_STORE_A','QA_TENANT_ONE','QA_SYSTEM'),
 staff=qa('staff','QA_STORE_A','QA_TENANT_ONE','QA_STAFF_A'),
 ownerB=qa('owner','QA_STORE_B','QA_TENANT_ONE','QA_OWNER_B'),
 systemB=qa('system','QA_STORE_B','QA_TENANT_ONE','QA_SYSTEM_B'),
 reviewerB=qa('reviewer','QA_STORE_B','QA_TENANT_ONE','QA_REVIEWER_A');
const fail=(fn,re)=>assert.throws(fn,re);
test('01 contract: enrolled synthetic only',()=>fail(()=>qaContext({...owner,enrolled:false}),/INDEPENDENT/));
test('02 contract: Store IDs are QA-only',()=>fail(()=>qaContext({...owner,store_id:'real123'}),/QA_SCOPE/));
test('03 contract: role denied',()=>fail(()=>qaContext({...owner,role:'admin'}),/QA_ROLE/));
test('04 contract: one actor cannot cross Store scopes',()=>assert.notEqual(qaScope(owner),qaScope(ownerB)));
test('05 FAQ: draft preview not verified',()=>{const s=createFaqStudio();s.edit(owner,{key:'GREETING',value:'Xin chao tu Shop QA A',expected_version:0});assert.equal(s.preview(owner,{key:'GREETING',now_ms:100}).reply,null)});
test('06 FAQ: verified review returns synthetic fact',()=>{const s=createFaqStudio();s.edit(owner,{key:'GREETING',value:'Xin chao tu Shop QA A',expected_version:0});s.review(reviewer,{key:'GREETING',version:1,approved:true,now_ms:1,valid_until_ms:500});assert.equal(s.preview(owner,{key:'GREETING',now_ms:100}).reply,'Xin chao tu Shop QA A')});
test('07 FAQ: expired verification denied',()=>{const s=createFaqStudio();s.edit(owner,{key:'HOURS',value:'QA_OPEN_08_20',expected_version:0});s.review(reviewer,{key:'HOURS',version:1,approved:true,now_ms:1,valid_until_ms:20});assert.equal(s.preview(owner,{key:'HOURS',now_ms:20}).status,'NOT_VERIFIED_OR_EXPIRED')});
test('08 FAQ: independent reviewer required',()=>{const s=createFaqStudio();s.edit(owner,{key:'GREETING',value:'Xin chao tu Shop QA A',expected_version:0});fail(()=>s.review(qa('reviewer','QA_STORE_A','QA_TENANT_ONE','QA_OWNER_A'),{key:'GREETING',version:1,approved:true,now_ms:1,valid_until_ms:100}),/INDEPENDENT_REVIEW/)});
test('09 FAQ: optimistic version check',()=>{const s=createFaqStudio();s.edit(owner,{key:'HOURS',value:'QA_OPEN_09_18',expected_version:0});fail(()=>s.edit(owner,{key:'HOURS',value:'QA_OPEN_08_20',expected_version:0}),/VERSION_CONFLICT/)});
test('10 FAQ: per-key revisions coexist',()=>{const s=createFaqStudio();s.edit(owner,{key:'HOURS',value:'QA_OPEN_09_18',expected_version:0});s.edit(owner,{key:'SHOP_STATUS',value:'QA_PAUSED',expected_version:0});assert.equal(s.history(owner,{key:'HOURS'}).version,1);assert.equal(s.history(owner,{key:'SHOP_STATUS'}).version,1)});
test('11 FAQ: cross-store never reads Shop A fact',()=>{const s=createFaqStudio();s.edit(owner,{key:'HOURS',value:'QA_OPEN_09_18',expected_version:0});s.review(reviewer,{key:'HOURS',version:1,approved:true,now_ms:1,valid_until_ms:100});assert.equal(s.preview(ownerB,{key:'HOURS',now_ms:2}).status,'NO_VERIFIED_FAQ')});
test('12 FAQ: reject price/inventory as verified FAQ',()=>{const s=createFaqStudio();fail(()=>s.edit(owner,{key:'STOCK',value:'100',expected_version:0}),/FAQ_KEY/);fail(()=>s.edit(owner,{key:'HOURS',value:'0901234567',expected_version:0}),/FAQ_SYNTHETIC/)});
test('13 FAQ: denied review cannot be previewed',()=>{const s=createFaqStudio();s.edit(owner,{key:'SHOP_STATUS',value:'QA_PAUSED',expected_version:0});s.review(reviewer,{key:'SHOP_STATUS',version:1,approved:false,now_ms:1,valid_until_ms:100});assert.equal(s.preview(owner,{key:'SHOP_STATUS',now_ms:10}).reply,null)});
test('14 FAQ: reviewer cannot create owner draft',()=>fail(()=>createFaqStudio().edit(reviewer,{key:'HOURS',value:'QA_OPEN_09_18',expected_version:0}),/QA_ROLE/));
test('15 FAQ: UI contract is not production CMS',()=>assert.equal(faqStudioUiContract().host_data_cms_integrated,false));
test('16 Cost: missing policy fails closed',()=>fail(()=>createCostCenter().reserve(system,{event_id:'QA_EVT_A',max_micro_usd:1}),/NOT_CONFIGURED/));
test('17 Cost: owner configures synthetic shop budget',()=>{const c=createCostCenter();assert.equal(c.configure(owner,{cap_micro_usd:1000}).version,1)});
test('18 Cost: reserved amount never exceeds hard cap in one mock process',()=>{const c=createCostCenter();c.configure(owner,{cap_micro_usd:1000});assert.equal(c.reserve(system,{event_id:'QA_EVT_A',max_micro_usd:800}).accepted,true);assert.equal(c.reserve(system,{event_id:'QA_EVT_B',max_micro_usd:300}).accepted,false)});
test('19 Cost: shop B budget isolated',()=>{const c=createCostCenter();c.configure(owner,{cap_micro_usd:100});c.configure(ownerB,{cap_micro_usd:500});c.reserve(system,{event_id:'QA_EVT_A',max_micro_usd:100});assert.equal(c.snapshot(ownerB).headroom_micro_usd,500)});
test('20 Cost: duplicate reservation does not charge again',()=>{const c=createCostCenter();c.configure(owner,{cap_micro_usd:100});c.reserve(system,{event_id:'QA_EVT_A',max_micro_usd:70});assert.equal(c.reserve(system,{event_id:'QA_EVT_A',max_micro_usd:70}).status,'DUPLICATE_RESERVATION');assert.equal(c.snapshot(owner).reserved_micro_usd,70)});
test('21 Cost: threshold 70% generated once',()=>{const c=createCostCenter();c.configure(owner,{cap_micro_usd:100});assert.deepEqual(c.reserve(system,{event_id:'QA_EVT_A',max_micro_usd:70}).alerts,[70]);assert.deepEqual(c.reserve(system,{event_id:'QA_EVT_B',max_micro_usd:1}).alerts,[])});
test('22 Cost: threshold 90% and 100%',()=>{const c=createCostCenter();c.configure(owner,{cap_micro_usd:100});c.reserve(system,{event_id:'QA_EVT_A',max_micro_usd:70});assert.deepEqual(c.reserve(system,{event_id:'QA_EVT_B',max_micro_usd:30}).alerts,[90,100])});
test('23 Cost: unused estimate refunded on settlement',()=>{const c=createCostCenter();c.configure(owner,{cap_micro_usd:100});c.reserve(system,{event_id:'QA_EVT_A',max_micro_usd:90});assert.equal(c.settle(system,{event_id:'QA_EVT_A',used_micro_usd:20}).refund_micro_usd,70);assert.equal(c.snapshot(owner).headroom_micro_usd,80)});
test('24 Cost: cannot settle over reservation',()=>{const c=createCostCenter();c.configure(owner,{cap_micro_usd:100});c.reserve(system,{event_id:'QA_EVT_A',max_micro_usd:20});fail(()=>c.settle(system,{event_id:'QA_EVT_A',used_micro_usd:21}),/EXCEEDS/)});
test('25 Cost: duplicate settlement idempotent',()=>{const c=createCostCenter();c.configure(owner,{cap_micro_usd:100});c.reserve(system,{event_id:'QA_EVT_A',max_micro_usd:20});c.settle(system,{event_id:'QA_EVT_A',used_micro_usd:10});assert.equal(c.settle(system,{event_id:'QA_EVT_A',used_micro_usd:10}).charged_again,false)});
test('26 Cost: release on timeout refund',()=>{const c=createCostCenter();c.configure(owner,{cap_micro_usd:100});c.reserve(system,{event_id:'QA_EVT_A',max_micro_usd:30});assert.equal(c.release(system,{event_id:'QA_EVT_A'}).refund_micro_usd,30);assert.equal(c.snapshot(owner).headroom_micro_usd,100)});
test('27 Cost: unauthorized role cannot modify budget',()=>fail(()=>createCostCenter().configure(staff,{cap_micro_usd:100}),/QA_ROLE/));
test('28 Cost: no actual expense claimed',()=>{const c=createCostCenter();c.configure(owner,{cap_micro_usd:100});assert.equal(c.snapshot(owner).actual_cost_usd,null)});
test('29 Cost: optimistic budget version',()=>{const c=createCostCenter();c.configure(owner,{cap_micro_usd:100});fail(()=>c.configure(owner,{cap_micro_usd:50,expected_version:0}),/VERSION_CONFLICT/)});
const qjob=(id,store_id='QA_STORE_A',tier='Economy',state='PENDING_QA',t=1,tenant_id='QA_TENANT_ONE')=>({id,store_id,tenant_id,tier,state,enqueued_at_ms:t});
test('30 Queue: synthetic queue depth only',()=>{const o=previewQueue(owner,{jobs:[qjob('QA_JOB_A')],now_ms:10});assert.equal(o.pending_total,1);assert.equal(o.actual_queue_depth,null)});
test('31 Queue: manager sees only own Shop',()=>{const a=previewQueue(manager,{jobs:[qjob('QA_JOB_A'),qjob('QA_JOB_B','QA_STORE_B')],now_ms:10});assert.equal(a.pending_total,1)});
test('32 Queue: reviewer sees anonymized same-tenant total',()=>{const a=previewQueue(reviewer,{jobs:[qjob('QA_JOB_A'),qjob('QA_JOB_B','QA_STORE_B')],now_ms:10});assert.equal(a.pending_total,2);assert.equal(a.store_scope,null)});
test('33 Queue: cross-tenant not visible even to reviewer',()=>{const a=previewQueue(reviewer,{jobs:[qjob('QA_JOB_C','QA_STORE_C','Priority','PENDING_QA',1,'QA_TENANT_TWO')],now_ms:10});assert.equal(a.pending_total,0)});
test('34 Queue: raw message payload refused',()=>fail(()=>previewQueue(owner,{jobs:[{...qjob('QA_JOB_A'),message:'private text'}],now_ms:10}),/METADATA_ONLY/));
test('35 Queue: invalid time refused',()=>fail(()=>previewQueue(owner,{jobs:[qjob('QA_JOB_A','QA_STORE_A','Economy','PENDING_QA',100)],now_ms:10}),/QUEUE_TIME/));
test('36 Queue: failed node not counted pending',()=>{const a=previewQueue(owner,{jobs:[qjob('QA_JOB_A','QA_STORE_A','Economy','FAILED_QA')],now_ms:10});assert.equal(a.lanes.Economy.failed,1);assert.equal(a.pending_total,0)});
test('37 Queue: p95 is queue age, not delivery',()=>{const a=previewQueue(owner,{jobs:[qjob('QA_JOB_A','QA_STORE_A','Economy','PENDING_QA',1),qjob('QA_JOB_B','QA_STORE_A','Economy','PENDING_QA',5)],now_ms:10});assert.equal(a.lanes.Economy.p95_pending_age_ms,9);assert.equal(a.actual_customer_p95_ms,null)});
test('38 Queue: queue UI not connected',()=>assert.equal(priorityDashboardUiContract().queue_provider_connected,false));
test('39 Handoff: customer consent mandatory',()=>fail(()=>createHandoffPreview().open(system,{case_id:'QA_TICKET_A',reason:'HUMAN_REQUEST',customer_consent:false}),/CONSENT/));
test('40 Handoff: synthetic open is not staff notification',()=>{const h=createHandoffPreview();assert.equal(h.open(system,{case_id:'QA_TICKET_A',reason:'HUMAN_REQUEST',customer_consent:true}).staff_notified,false)});
test('41 Handoff: duplicate request not duplicate ticket',()=>{const h=createHandoffPreview();h.open(system,{case_id:'QA_TICKET_A',reason:'HUMAN_REQUEST',customer_consent:true});assert.equal(h.open(system,{case_id:'QA_TICKET_A',reason:'HUMAN_REQUEST',customer_consent:true}).status,'DUPLICATE_PREVIEW_CASE')});
test('42 Handoff: owner assigns staff ID',()=>{const h=createHandoffPreview();h.open(system,{case_id:'QA_TICKET_A',reason:'COMPLAINT',customer_consent:true});assert.equal(h.assign(owner,{case_id:'QA_TICKET_A',staff_id:'QA_STAFF_A'}).status,'QA_ASSIGNED')});
test('43 Handoff: wrong Store cannot assign',()=>{const h=createHandoffPreview();h.open(system,{case_id:'QA_TICKET_A',reason:'COMPLAINT',customer_consent:true});fail(()=>h.assign(ownerB,{case_id:'QA_TICKET_A',staff_id:'QA_STAFF_A'}),/NOT_IN_SHOP/)});
test('44 Handoff: staff must match assignee',()=>{const h=createHandoffPreview();h.open(system,{case_id:'QA_TICKET_A',reason:'COMPLAINT',customer_consent:true});h.assign(owner,{case_id:'QA_TICKET_A',staff_id:'QA_STAFF_A'});fail(()=>h.resolve(qa('staff','QA_STORE_A','QA_TENANT_ONE','QA_STAFF_B'),{case_id:'QA_TICKET_A',resolution:'RESOLVED_QA'}),/ASSIGNEE_ONLY/)});
test('45 Handoff: assigned staff can resolve preview only',()=>{const h=createHandoffPreview();h.open(system,{case_id:'QA_TICKET_A',reason:'COMPLAINT',customer_consent:true});h.assign(owner,{case_id:'QA_TICKET_A',staff_id:'QA_STAFF_A'});assert.equal(h.resolve(staff,{case_id:'QA_TICKET_A',resolution:'RESOLVED_QA'}).customer_notified,false)});
test('46 Handoff: complaint triggers preview',()=>assert.equal(shouldHandoff({intent:'COMPLAINT',confidence:.91}).route,'HANDOFF_PREVIEW_ONLY'));
test('47 Handoff: low confidence triggers preview',()=>assert(shouldHandoff({intent:'CONSULT',confidence:.2}).reasons.includes('LOW_CONFIDENCE')));
test('48 Handoff: repeated failures trigger preview',()=>assert(shouldHandoff({intent:'CONSULT',confidence:.95,failed_attempts:2}).reasons.includes('REPEATED_FAILURE')));
test('49 Handoff: fake admin instruction not route permission',()=>fail(()=>shouldHandoff({intent:'admin; DROP TABLE',confidence:.9}),/INTENT_CODE/));
test('50 Handoff: PII text cannot be reason code',()=>fail(()=>createHandoffPreview().open(system,{case_id:'QA_TICKET_A',reason:'0901234567',customer_consent:true}),/UNSAFE_HANDOFF/));
const single=SINGLE_CASES;
const multi=MULTI_PACK;
test('51 Lab: manifest has 132 scoped cases',()=>{const m=build132Manifest({single,multi});assert.equal(m.count,132);assert.equal(m.total_turns,167)});
test('52 Lab: QA01 single and QA01 multi are distinct',()=>{const m=build132Manifest({single,multi});assert(m.cases.some(x=>x.case_key==='SINGLE:QA01'));assert(m.cases.some(x=>x.case_key==='MULTI:QA01'))});
test('53 Lab: duplicate single case rejected',()=>fail(()=>build132Manifest({single:[...single.slice(0,95),single[0]],multi}),/DUPLICATE/));
test('54 Lab: raw prompts prohibited in manifest',()=>fail(()=>build132Manifest({single:[{...single[0],chatInput:'secret'},...single.slice(1)],multi}),/METADATA_ONLY/));
test('55 Lab: 3 candidate labels yield 396 plans',()=>{const p=planAbLab({manifest:build132Manifest({single,multi})});assert.equal(p.rows.length,396);assert.equal(p.actual_api_calls,0)});
test('56 Lab: planned rows never PASS',()=>{const p=planAbLab({manifest:build132Manifest({single,multi})});assert.equal(aggregateAbRows(p.rows).NOT_RUN,396)});
test('57 Lab: unknown provider candidate rejected',()=>fail(()=>planAbLab({manifest:build132Manifest({single,multi}),candidates:['unknown','baseline_small']}),/NOT_ENROLLED/));
test('58 Lab: duplicate candidates rejected',()=>fail(()=>planAbLab({manifest:build132Manifest({single,multi}),candidates:['baseline_small','baseline_small']}),/NOT_ENROLLED/));
test('59 Lab: empty observation remains NOT_RUN',()=>{const p=planAbLab({manifest:build132Manifest({single,multi})});assert.equal(evaluationEvidenceGate(p.rows[0],null).status,'NOT_RUN')});
test('60 Lab: raw output payload forbidden',()=>{const p=planAbLab({manifest:build132Manifest({single,multi})});fail(()=>evaluationEvidenceGate(p.rows[0],{output:'raw text'}),/NO_RAW_OUTPUT/)});
test('61 Lab: self-asserted reviewer does not PASS',()=>{const p=planAbLab({manifest:build132Manifest({single,multi})});const o={output_hash:'a'.repeat(64),latency_ms:100,input_tokens:12,output_tokens:5,tool_trace_verified:true,reviewer_approved:true,fixture_snapshot_verified:true};assert.equal(evaluationEvidenceGate(p.rows[0],o).status,'BLOCKED')});
test('62 Lab: unverified PASS claim never certified',()=>assert.equal(aggregateAbRows([{status:'PASS'}]).certified_pass,0));
test('63 Lab: too few cases rejected',()=>fail(()=>build132Manifest({single:single.slice(1),multi}),/COUNT_MISMATCH/));
test('64 Lab: no model ID is verified',()=>{const p=planAbLab({manifest:build132Manifest({single,multi})});assert(p.rows.every(x=>x.model_id_verified===false))});

test('65 file structure: 9 one-turn cases in alleged multi pack',()=>assert.equal(MANIFEST_METADATA.multi_pack_one_turn,9));
test('66 file structure: 27 genuinely multi-turn cases',()=>assert.equal(MANIFEST_METADATA.multi_pack_true_multi,27));
test('67 file structure: 71 dialogue turns, not 72',()=>assert.equal(MANIFEST_METADATA.total_turns_in_multi_pack,71));
test('68 Lab: flags one-turn pack cases, no invented memory evaluation',()=>{const m=build132Manifest({single,multi});assert.equal(m.single_turn_cases_in_multi_pack,9);assert.equal(m.true_multi_turn_count,27)});
test('69 Lab: malformed zero-turn case denied',()=>fail(()=>build132Manifest({single,multi:[{...multi[0],turn_count:0},...multi.slice(1)]}),/INVALID_TURN_COUNT/));

test('70 FAQ: cannot cross-assign Shop A greeting to B',()=>{const s=createFaqStudio();fail(()=>s.edit(ownerB,{key:'GREETING',value:'Xin chao tu Shop QA A',expected_version:0}),/CROSS_STORE_GREETING/) });

test('71 QA context cannot include JWT or unexpected fields',()=>fail(()=>qaContext({...owner,jwt:'DO_NOT_STORE'}),/EXTRA_FIELD/));
test('72 FAQ audit trail retains draft and reviewed synthetic version',()=>{
 const f=createFaqStudio();f.edit(owner,{key:'HOURS',value:'QA_OPEN_08_20',expected_version:0});
 f.review(reviewer,{key:'HOURS',version:1,approved:true,now_ms:1,valid_until_ms:100});
 assert.deepEqual(f.revisions(owner,{key:'HOURS'}).map(x=>x.status),['DRAFT_QA','QA_REVIEWED']);
});
test('73 Safety intent routes to human, never sends notification',()=>{
 assert(shouldHandoff({intent:'SAFETY',confidence:1}).reasons.includes('SAFETY'));
 assert.equal(shouldHandoff({intent:'SAFETY',confidence:1}).send_notification,false);
});
test('74 QA role context cannot include raw customer text',()=>fail(()=>qaContext({...owner,customer_message:'hello'}),/EXTRA_FIELD/));
test('75 FAQ revisions isolated across Store scopes',()=>{
 const f=createFaqStudio();f.edit(owner,{key:'HOURS',value:'QA_OPEN_08_20',expected_version:0});
 assert.equal(f.revisions(ownerB,{key:'HOURS'}).length,0);
});
