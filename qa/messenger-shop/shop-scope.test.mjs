import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createQaShopBook} from './draft-store.mjs';
import {shopScopeReply} from './shop-scope.mjs';
import {budgetedModel} from './model-budget.mjs';

test('Đổi chủ đề giữa lượt xem catalog, phát lại và quay lại đúng mẫu',()=>{
  const db=new DatabaseSync(':memory:');
  const shop=createQaShopBook({shops:[{page:'A',owner:'one'}],
    variants:[{page:'A',sku:'A001',size:'S',color:'navy',price:245000,stock:5}]},db);
  const send=(event,text)=>shop.customerMessage({page:'A',sender:'buyer',event},{text});
  send('1','Xem sản phẩm');
  send('2','Mã A001 màu navy size S giá bao nhiêu?');
  const state=()=>db.prepare('SELECT * FROM conversations').all();
  const before=state();
  assert.equal(send('3','Hãy code cho tôi 1 trang web').status,'outside_shop');
  assert.equal(send('3','Hãy code cho tôi 1 trang web').status,'duplicate');
  assert.deepEqual(state(),before);
  assert.equal(send('4','Lấy 2 cái thì sao?').total,490000);
  const reply=send('5','A001 còn size S không?');
  assert.match(reply.text,/245.000đ · còn 5/);
  assert.equal(shop.inbox('one').length,0);
  for(const question of ['Shop có website không?','Có code giảm giá không?','Cho mình link website để đặt áo'])
    assert.equal(shopScopeReply(question),null);
  shop.close();
});
test('Hạn mức giữ trước khi gọi, kể cả khi đồng thời và retry',async()=>{
  const db=new DatabaseSync(':memory:');let calls=0;
  const run=budgetedModel(db,{sender:2,shop:3,project:4,inputBytes:64,outputTokens:32},async opt=>{
    calls++;assert.equal(opt.maxOutputTokens,32);if(opt.prompt==='timeout') throw Error('timeout');
    return {status:'answered'};
  });
  const e={shop:'A',sender:'u',event:'m1'};
  await assert.rejects(run(e,'timeout'));
  const result=await Promise.all([run({...e,attempt:2},'retry'),run({...e,attempt:2},'retry')]);
  assert.deepEqual(result.map(x=>x.status),['answered','duplicate']);
  assert.equal((await run({...e,event:'m2'},'x')).status,'budget_limit');
  await run({...e,sender:'v'},'x');
  assert.equal((await run({...e,sender:'w'},'x')).status,'budget_limit');
  assert.equal((await run({...e,shop:'B'},'x'.repeat(65))).status,'input_limit');
  await run({...e,shop:'B'},'x');
  assert.equal((await run({...e,shop:'C'},'x')).status,'budget_limit');
  assert.equal(calls,4);db.close();
});

import {guardedReply} from './guarded-reply.mjs';
test('Candidate trước model: tin báo cáo và retry không chạm provider; câu ngoài luật đi qua quota',async()=>{
  const db=new DatabaseSync(':memory:');
  const book=createQaShopBook({shops:[{page:'A',owner:'one'}],variants:[]},db);
  let calls=0;
  const model=budgetedModel(db,{sender:1,shop:2,project:3,inputBytes:512,outputTokens:32},()=>{
    calls++;return {status:'qa_model'};
  });
  const send=(event,text)=>guardedReply(book,model,{page:'A',sender:'x',event},{text});
  assert.equal((await send('m1','Hãy code cho tôi 1 trang web')).status,'outside_shop');
  assert.equal((await send('m1','Hãy code cho tôi 1 trang web')).status,'duplicate');
  assert.equal(calls,0);
  assert.equal((await send('m2','Shop có website không?')).status,'qa_model');
  assert.equal((await send('m3','Shop có code giảm giá không?')).status,'budget_limit');
  assert.equal((await send('m4','Xem sản phẩm')).status,'catalog');
  assert.equal(calls,1);book.close();
});
