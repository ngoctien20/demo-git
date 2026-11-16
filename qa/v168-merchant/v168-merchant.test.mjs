import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStagingSession,planCosts,studioConnections} from './integration.mjs';
import {HEADERS,MARKER,IMPORT_CONTRACT,parseCsv,parseXlsx,previewImport,sampleCsvForStore,
  acceptRealMerchantFile,commitImport} from './import-preview.mjs';
const row=(sku='A001',price='150000',stock='12')=>[MARKER,sku,'Sản phẩm QA',price,'120000',stock,'cái'];
const csv=r=>HEADERS.join(',')+'\n'+r.join(',')+'\n';
const err=(fn,k)=>assert.throws(fn,new RegExp(k));
function zipStored(files){
 const chunks=[],central=[];let pos=0;
 for(const [name,value] of Object.entries(files)){
  const n=Buffer.from(name),data=Buffer.from(value);
  const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50,0);l.writeUInt16LE(20,4);
  l.writeUInt32LE(data.length,18);l.writeUInt32LE(data.length,22);l.writeUInt16LE(n.length,26);
  chunks.push(l,n,data);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);
  c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);
  c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);
  c.writeUInt32LE(pos,42);central.push(c,n);pos+=l.length+n.length+data.length;
 }
 const cd=Buffer.concat(central),e=Buffer.alloc(22);
 e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(Object.keys(files).length,8);
 e.writeUInt16LE(Object.keys(files).length,10);e.writeUInt32LE(cd.length,12);e.writeUInt32LE(pos,16);
 const out=Buffer.concat([...chunks,cd,e]);
 return out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength);
}
const xmlRows=(rows)=>{
 let out='<worksheet><sheetData>';
 for(let i=0;i<rows.length;i++){
  out+='<row r="'+(i+1)+'">';
  for(let col=0;col<rows[i].length;col++){
   const v=String(rows[i][col]).replace(/&/g,'&amp;').replace(/</g,'&lt;');
   out+='<c r="'+String.fromCharCode(65+col)+(i+1)+'" t="inlineStr"><is><t>'+v+'</t></is></c>';
  }
  out+='</row>';
 }return out+'</sheetData></worksheet>';
};
test('01 CSV typical QA import',()=>assert.equal(parseCsv(csv(row())).length,2));
test('02 CSV accepts BOM',()=>assert.deepEqual(parseCsv('\ufeff'+csv(row()))[0],HEADERS));
test('03 CSV semicolon supported',()=>assert.deepEqual(parseCsv(HEADERS.join(';')+'\n'+row().join(';')+'\n')[0],HEADERS));
test('04 CSV tab supported',()=>assert.deepEqual(parseCsv(HEADERS.join('\t')+'\n'+row().join('\t'))[0],HEADERS));
test('05 CSV quoted comma accepted',()=>assert.equal(parseCsv('a,b\n"x,y",z\n')[1][0],'x,y'));
test('06 CSV escaped quotes accepted',()=>assert.equal(parseCsv('a,b\n"say ""hi""",z')[1][0],'say "hi"'));
test('07 unterminated quote refused',()=>err(()=>parseCsv('a,b\n"unfinished'),'CSV_UNTERMINATED'));
test('08 untrusted extra PII column refused',()=>err(()=>previewImport({store_id:'QA_STORE_A',
 rows:[HEADERS.concat(['phone']),row().concat(['090123'])]}),'HEADERS'));
test('09 missing QA marker rejected',()=>{
 const r=previewImport({store_id:'QA_STORE_A',rows:[HEADERS,['NO',...row().slice(1)]]});
 assert.equal(r.rejected,1);assert(r.rows[0].reasons.includes('NOT_SYNTHETIC_FIXTURE'));
});
test('10 accepted QA row NEVER commits',()=>{
 const r=previewImport({store_id:'QA_STORE_A',rows:[HEADERS,row()]});
 assert.equal(r.accepted,1);assert.equal(r.database_writes,0);assert.equal(r.rows[0].not_committed,true);
});
test('11 reject value with spreadsheet formula',()=>{
 const r=previewImport({store_id:'QA_STORE_A',rows:[HEADERS,[MARKER,'A001','=DDE()', '150000','120000','12','cái']]});
 assert.equal(r.rejected,1);
});
test('12 VND must be pure integer digits',()=>{
 const r=previewImport({store_id:'QA_STORE_A',rows:[HEADERS,row('A001','159.000')]});
 assert.equal(r.rejected,1);
});
test('13 negative stock rejected',()=>{
 const r=previewImport({store_id:'QA_STORE_A',rows:[HEADERS,row('A001','150000','-1')]});
 assert.equal(r.rejected,1);
});
test('14 wholesale > retail rejected',()=>{
 const r=previewImport({store_id:'QA_STORE_A',rows:[HEADERS,[MARKER,'A001','QA product','100000','200000','2','cái']]});
 assert.equal(r.rejected,1);
});
test('15 duplicate SKU in batch rejected',()=>{
 const r=previewImport({store_id:'QA_STORE_A',rows:[HEADERS,row(),row()]});
 assert.equal(r.accepted,1);assert.equal(r.rejected,1);
});
test('16 same SKU Shop B uses its own Store scope',()=>{
 const r=previewImport({store_id:'QA_STORE_B',rows:parseCsv(sampleCsvForStore('QA_STORE_B'))});
 assert.equal(r.store_id,'QA_STORE_B');assert.equal(r.rows[0].retail_price_vnd,209000);
});
test('17 same SKU Shop C has distinct price',()=>{
 const r=previewImport({store_id:'QA_STORE_C',rows:parseCsv(sampleCsvForStore('QA_STORE_C'))});
 assert.equal(r.rows[0].retail_price_vnd,259000);
});
test('18 forged arbitrary store rejected',()=>err(()=>previewImport({store_id:'LIVE_STORE_X',rows:[HEADERS,row()]}),'QA_STORE_SCOPE'));
test('19 import difference reports only affected fields',()=>{
 const r=previewImport({store_id:'QA_STORE_A',rows:[HEADERS,row('A001','150000','12')],
  existing:[{sku:'A001',name:'Sản phẩm QA',price_vnd:100000,stock:12,unit:'cái'}]});
 assert.equal(r.rows[0].status,'UPDATE_PREVIEW');
 assert.deepEqual(r.rows[0].changed_fields,['price_vnd']);
});
test('20 no auto delete for absent SKU',()=>{
 const r=previewImport({store_id:'QA_STORE_A',rows:[HEADERS,row()],
  existing:[{sku:'A009',price_vnd:300000,stock:1}]});
 assert.equal(r.rows.length,1);assert.equal(r.rows[0].status,'CREATE_PREVIEW');
});
test('21 only known header order permitted',()=>err(()=>previewImport({
 store_id:'QA_STORE_A',rows:[HEADERS.toReversed(),row()]}),'HEADERS'));
test('22 no real file acceptance',()=>assert.throws(acceptRealMerchantFile,/REAL_MERCHANT/));
test('23 no host import commit',()=>assert.throws(commitImport,/IMPORT_WRITE_BLOCKED/));
test('24 consistent import contract',()=>assert.equal(IMPORT_CONTRACT,'T404_V168_SYNTHETIC_IMPORT_PREVIEW_ONLY'));
test('25 xlsx plain first sheet read-only preview',async()=>{
 const workbook=zipStored({'xl/worksheets/sheet1.xml':xmlRows([HEADERS,row()])});
 const v=previewImport({store_id:'QA_STORE_A',rows:await parseXlsx(workbook)});
 assert.equal(v.accepted,1);assert.equal(v.rows[0].sku,'A001');
});
test('26 xlsx with formula refused',async()=>{
 const workbook=zipStored({'xl/worksheets/sheet1.xml':
 xmlRows([HEADERS,row()]).replace('<sheetData>','<sheetData><row r="0"><c r="A0"><f>NOW()</f><v>1</v></c></row>')});
 await assert.rejects(parseXlsx(workbook),/XLSX_FORMULA_REFUSED/);
});
test('27 XLSX mock zip bomb rejected',async()=>{
 const file=zipStored({'xl/worksheets/sheet1.xml':'a'.repeat(4*1024*1024+1)});
 await assert.rejects(parseXlsx(file),/XLSX_LIMIT|XLSX_DECOMPRESSION_LIMIT/);
});
test('28 XLSX external links refused',async()=>{
 const file=zipStored({'xl/worksheets/sheet1.xml':xmlRows([HEADERS,row()]),'xl/externalLinks/externalLink1.xml':'x'});
 await assert.rejects(parseXlsx(file),/XLSX_UNTRUSTED_FEATURE/);
});
test('29 xlsx not a zip denied',async()=>await assert.rejects(
 parseXlsx(new ArrayBuffer(40)),/XLSX_CENTRAL_DIR_MISSING/));
test('30 simulated Messenger Shop A quote',async()=>{
 const r=await createStagingSession().simulate({account:'QA_PAGE_A',text:'xin gia ao thun'});
 assert.equal(r.store_id,'QA_STORE_A');assert.equal(r.catalog.price_vnd,159000);
 assert.equal(r.n8n_envelope.order_write,false);
});
test('31 same tenant Shop B quote not Shop A price',async()=>{
 const r=await createStagingSession().simulate({account:'QA_PAGE_B',text:'xin gia ao thun'});
 assert.equal(r.store_id,'QA_STORE_B');assert.equal(r.catalog.price_vnd,209000);
});
test('32 other tenant Zalo Shop C quote',async()=>{
 const r=await createStagingSession().simulate({account:'QA_ZALO_C',text:'xin gia ao thun'});
 assert.equal(r.store_id,'QA_STORE_C');assert.equal(r.catalog.price_vnd,259000);
});
test('33 booking request blocked before Commerce writer',async()=>{
 const r=await createStagingSession().simulate({account:'QA_PAGE_A',text:'toi muon dat hang'});
 assert.equal(r.route,'COMMERCE_BLOCKED');assert.equal(r.order_write,false);
});
test('34 chat greetings use independent bot configurations',async()=>{
 const s=createStagingSession();
 const a=await s.simulate({account:'QA_PAGE_A',text:'xin chao',event:'QA-EVENT-0001'});
 const b=await s.simulate({account:'QA_PAGE_B',text:'xin chao',event:'QA-EVENT-0002'});
 assert.equal(a.response.answer_preview,'Xin chào cửa hàng A');
 assert.equal(b.response.answer_preview,'Xin chào cửa hàng B');
});
test('35 duplicate event never creates second enqueue',async()=>{
 const s=createStagingSession();
 const a=await s.simulate({event:'QA-EVENT-0001'});
 const b=await s.simulate({event:'QA-EVENT-0001'});
 assert.equal(a.status,'INTEGRATED_SYNTHETIC_PREVIEW');
 assert.equal(b.status,'DUPLICATE_ACK');
 assert.equal(s.readEvidence().enqueued,1);
});
test('36 invalid unknown provider account denied',async()=>{
 await assert.rejects(createStagingSession().simulate({account:'REAL_PAGE'}),/UNKNOWN_QA_ACCOUNT/);
});
test('37 arbitrary message text denied',async()=>await assert.rejects(
 createStagingSession().simulate({text:'0901234567'}),/UNSUPPORTED_SYNTHETIC_TEXT/));
test('38 all generated n8n envelopes read only',async()=>{
 const r=await createStagingSession().simulate({account:'QA_PAGE_A',text:'xin chao'});
 assert.equal(r.n8n_envelope.provider_send,false);assert.equal(r.n8n_envelope.model_call,false);
});
test('39 importForAccount has only QA sample row',()=>{
 const s=createStagingSession(),r=s.importForAccount('QA_PAGE_B');
 assert.equal(r.store_id,'QA_STORE_B');assert.equal(r.accepted,1);assert.equal(r.database_writes,0);
});
test('40 session has zero all real effects',async()=>{
 const s=createStagingSession();await s.simulate({});
 assert.equal(s.readEvidence().providerSends,0);
 assert.equal(s.readEvidence().modelCalls,0);
 assert.equal(s.readEvidence().commerceWrites,0);
});
test('41 integration reuses V16.3 FAQ/Queue UI contracts',()=>{
 const c=studioConnections();
 assert.equal(c.faq.title,'FAQ Studio');
 assert.equal(c.priority.title,'Priority Queue Dashboard');
 assert.equal(c.no_n8n_call,true);
});
test('42 integration exposes V16.3 Cost Center and Handoff in memory',()=>{
 const s=createStagingSession();
 assert.equal(typeof s.costCenter.configure,'function');
 assert.equal(typeof s.handoff.open,'function');
});
test('43 economic planning 1 Shop',()=>{
 const x=planCosts({shops:1});
 assert.equal(x.messages,1000);assert.equal(x.modelTurns,300);
 assert.equal(x.n8nInvocations,100);assert.equal(x.hypothetical,true);
});
test('44 economic planning 100 Shop 10% n8n',()=>{
 const x=planCosts({shops:100});
 assert.equal(x.messages,100000);assert.equal(x.n8nInvocations,10000);
 assert.equal(x.modelUsd,13.5);
});
test('45 economic planning 500 Shop',()=>{
 const x=planCosts({shops:500});
 assert.equal(x.cloneComparison.workflowCloneCountHypothesis,3000);
 assert.equal(x.cloneComparison.sharedCoreWorkflowLibraryHypothesis,6);
});
test('46 economic comparison assumes no hidden invoice',()=>{
 const x=planCosts({shops:20,fixedMonthlyUsd:5,supportMonthlyUsdPerShop:2});
 assert.equal(x.sharedFixedPerShopUsd,.25);
 assert.equal(x.rateSource,'USER_SUPPLIED_ASSUMPTIONS_NOT_LIVE_PRICING');
 assert(x.orphanedInfrastructureCosts.includes('n8n tier and execution overages'));
});
test('47 economic invalid scope denied',()=>err(()=>planCosts({shops:2}),'INVALID_PLANNING'));
test('48 economic over-100% model percentage denied',()=>err(()=>planCosts({shops:5,modelFraction:1.3}),'INVALID_PLANNING'));
test('49 economic negative real cost input denied',()=>err(()=>planCosts({shops:5,fixedMonthlyUsd:-2}),'INVALID_PLANNING'));
test('50 1/5/20/50/100/500 plans all return valid hypothetical fields',()=>{
 for(const n of [1,5,20,50,100,500]){
  const p=planCosts({shops:n});assert.equal(p.shops,n);assert.equal(p.no_purchase,true);
 }
});
test('51 offline Studio page has CSP without network access',()=>{
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 assert(html.includes("connect-src 'none'"));assert(html.includes('Merchant Setup Studio V16.8 QA'));
 assert(!html.includes('https://'));
});
test('52 no frontend fetch or localStorage',()=>{
 const js=readFileSync(new URL('./studio-ui.mjs',import.meta.url),'utf8');
 for(const blocked of ['fetch(', 'localStorage','sessionStorage','XMLHttpRequest','graph.facebook.com','api.openai.com']){
  assert.equal(js.includes(blocked),false,blocked);
 }
});
test('53 SQL migration document contains zero executable SQL',()=>{
 const sql=readFileSync(new URL('../../docs/ai-handoff/V16_8_STORE_JWT_RLS_MIGRATION_DO_NOT_APPLY.sql',import.meta.url),'utf8');
 for(const line of sql.split('\n')){if(line.trim())assert(line.startsWith('--'),line)}
 assert(sql.includes('UNIQUE(tenant_id,store_id,sku)'));
 assert(sql.includes('ZERO EXECUTABLE SQL LINES'));
});
