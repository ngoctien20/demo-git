'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseCsv,corpusReport}=require('./private-dataset-audit.cjs');
test('CSV quoted comma and newline parsed safely',()=>{
 const x='id,text\r\n1,"xin chào, shop"\r\n2,"giá\nhôm nay"\r\n';
 const a=parseCsv(x);assert.equal(a.length,2);assert.equal(a[0].text,'xin chào, shop');assert.equal(a[1].text,'giá\nhôm nay');
});
test('escaped double quote parsed correctly',()=>assert.equal(parseCsv('id,text\n1,"Hi ""Shop"""')[0].text,'Hi "Shop"'));
test('invalid unterminated quote rejected',()=>assert.throws(()=>parseCsv('id,text\n1,"oops'),/UNTERMINATED_QUOTE/));
test('CSV row width mismatch denied',()=>assert.throws(()=>parseCsv('id,text\n1,2,3'),/WIDTH_MISMATCH/));
test('duplicate CSV headers denied',()=>assert.throws(()=>parseCsv('a,a\n1,2'),/DUPLICATE_HEADERS/));
test('UTF-8 BOM safely removed',()=>assert.equal(parseCsv('\uFEFFid,text\n1,ok')[0].id,'1'));
test('private inventory does not return raw customer messages',()=>{
 const single=['case_id,chatInput,expected_behavior,actual_output'];
 for(let i=1;i<=96;i++)single.push('QA'+String(i).padStart(2,'0')+',PRIVATE_SENTINEL_DO_NOT_EXPOSE,readonly,');
 const multi=['case_id,group,mode,turns_json,expected_behavior,status'];
 for(let i=1;i<=36;i++)multi.push('QA'+String(i).padStart(2,'0')+',group,dialogue,"[""hello"",""bye""]",readonly,NOT_RUN');
 const history=['case_id,chatInput,expected_behavior,actual_output'];
 for(let i=1;i<=96;i++)history.push('QA'+String(i).padStart(2,'0')+',historical,readonly,old-output');
 history.push('QA01,historical,readonly,old-output');
 const result=corpusReport(single.join('\n'),multi.join('\n'),history.join('\n'));
 assert.equal(result.corpus_ready_for_model_benchmark,true);
 assert.equal(result.single_turn.rows,96);
 assert.equal(result.multi_turn.total_turns,72);
 assert.equal(result.historical.rows,97);
 assert.equal(result.historical.duplicate_case_id_count,1);
 assert.equal(result.model_api_calls,0);
 assert.ok(!JSON.stringify(result).includes('PRIVATE_SENTINEL_DO_NOT_EXPOSE'));
});
