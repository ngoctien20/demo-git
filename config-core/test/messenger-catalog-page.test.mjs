// V21 Pager acceptance: run the exact n8n Code source in an isolated VM.
// Synthetic catalog only; no Page tokens, API calls, Google Sheets writes or orders.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { decide } from '../lib/bot-bridge.mjs';
import { templateConfig } from '../lib/templates.mjs';

const code = fs.readFileSync(new URL('../n8n/messenger-catalog-page.code.mjs', import.meta.url), 'utf8');
const DEMO_PAGE = '2379295362359912', SENDER = '33333333333';
const menu = () => { const m = templateConfig('shop'); return {
  ...m, version_no: 7, config_sha256: 'synthetic', menu: m.menu.filter(x=>x.enabled) }; };
const products = Array.from({ length: 21 }, (_, i) => {
  const isA = i < 11;
  const n = isA ? i + 1 : i - 9;
  return { sku: (isA ? 'A' : 'B') + String(n).padStart(3,'0'),
    name: (isA ? 'Áo thun' : 'Quần jean') + ' mẫu kiểm thử ' + i,
    price: isA ? 159000 : 450000, stock: i === 10 ? 0 : 20 - (i % 17) };
});
function render({rows=products,page=1,category=null,itemId='catalog',version=7,pageId=DEMO_PAGE,senderId=SENDER,mediaType='catalog_page',digest=null}={}) {
  const current = {pageId,senderId,mediaType,catalogPage:page,
    catalogCategory:category,catalogItemId:itemId,catalogVersion:version,catalogDigest:digest};
  const $ = (name) => {
    assert.equal(name, 'Loop One Message');
    return { first: () => ({json:current}), context: {currentRunIndex:0} };
  };
  const $input = {all:()=>rows.map(r=>({json:r}))};
  return JSON.parse(JSON.stringify(vm.runInNewContext('(function(){\n'+code+'\n})()',{$,$input},{timeout:1000})))
    .map(x=>x.json);
}
function msg(data){return data[0]?.catalogMessage}
function buttons(m){return m?.attachment?.payload?.buttons??[]}
function text(m){return m?.attachment?.payload?.text??m?.text??''}
function next(m){return m.quick_replies?.find(q=>q.title==='Trang tiếp')?.payload}
function previous(m){return m.quick_replies?.find(q=>q.title==='Trang trước')?.payload}

test('all 21 synthetic products are selectable across 7 pages, stable and non-duplicated',()=>{
  const seen=[];
  const digest=render({page:1})[0].catalogDigest;
  assert.match(digest,/^[0-9a-f]{8}$/);
  for(let page=1;page<=7;page++){
    const result=render({page,digest:page===1?null:digest});
    assert.equal(result.length,1);
    assert.equal(result[0].catalogPage,page);
    assert.equal(result[0].catalogPages,7);
    assert.equal(result[0].catalogCount,21);
    const m=msg(result);
    assert.equal(m.attachment.payload.template_type,'button');
    assert.ok(text(m).length<=640);
    assert.equal(buttons(m).length,3);
    assert.ok(buttons(m).every(b=>b.type==='postback'&&/^TIEN404:VIEW:[AB][0-9]{3}$/.test(b.payload)));
    seen.push(...buttons(m).map(b=>b.payload));
    if(page===1)assert.equal(previous(m),undefined);
    else assert.equal(previous(m),'T404:C:catalog:7:'+digest+':'+(page-1));
    if(page===7)assert.equal(next(m),undefined);
    else assert.equal(next(m),'T404:C:catalog:7:'+digest+':'+(page+1));
    assert.ok((m.quick_replies??[]).length<=2);
  }
  assert.equal(new Set(seen).size,21);
  assert.ok(seen.includes('TIEN404:VIEW:A001'));
  assert.ok(seen.includes('TIEN404:VIEW:B011'));
});

test('a button cursor is resolved by published menu and rejects stale versions',()=>{
  const m=menu();
  assert.equal(decide(m,{payload:'T404:M:catalog'}).mode,'catalog');
  assert.equal(decide(m,{payload:next(msg(render({page:1})))}).catalogPage,2);
  assert.equal(decide(m,{payload:'T404:C:catalog:6:2'}).reason,'catalog_version_stale');
  const disabled=menu();disabled.menu.find(x=>x.id==='catalog').enabled=false;
  assert.equal(decide(disabled,{payload:'T404:C:catalog:7:2'}).mode,'rejected');
});

test('a configured custom item id/category remains in cursors and applies only category rows',()=>{
  const m=menu();m.menu[0].id='ao_nam';m.menu[0].action_config={category:'áo'};
  const first=decide(m,{payload:'T404:M:ao_nam'});
  assert.equal(first.mode,'catalog');
  const r=render({category:first.catalogCategory,itemId:first.itemId});
  assert.equal(r[0].catalogCount,11);
  assert.equal(r[0].catalogPages,4);
  assert.equal(next(msg(r)),'T404:C:ao_nam:7:'+r[0].catalogDigest+':2');
  assert.equal(decide(m,{payload:next(msg(r))}).catalogCategory,'áo');
  const q=render({category:'quần'});
  assert.equal(q[0].catalogCount,10);
  assert.equal(q[0].catalogPages,4);
  assert.ok(buttons(msg(q)).every(b=>b.payload.includes('B')));
});

test('out-of-range page and unsupported category fail safely; do not reveal other items',()=>{
  assert.match(text(msg(render({page:8,digest:render()[0].catalogDigest}))),/Danh mục đã thay đổi/);
  assert.match(text(msg(render({category:'bí mật'}))),/chưa khả dụng/);
  assert.match(text(msg(render({page:100}))),/chưa khả dụng/);
  assert.match(text(msg(render({version:0}))),/chưa khả dụng/);
  assert.match(text(msg(render({itemId:'../../'}))),/chưa khả dụng/);
  assert.equal(buttons(msg(render({page:8}))).length,0);
});

test('Page A only: never read DEMO catalog from other Page or empty PSID',()=>{
  assert.deepEqual(render({pageId:'22222222222'}),[]);
  assert.deepEqual(render({senderId:'other'}),[]);
});

test('duplicate SKU and invalid/negative/fractional price or stock are excluded',()=>{
  const rows=[
    {sku:'A002',name:'Áo QA',price:159000,stock:25},
    {sku:'A002',name:'Áo QA',price:100,stock:25},
    {sku:'A003',name:'Áo QA',price:159000,stock:-1},
    {sku:'A004',name:'Áo QA',price:159.5,stock:4},
    {sku:'A005',name:'Áo QA',price:'159.000',stock:3},
    {sku:'A006',name:'Áo QA',price:289000,stock:0},
    {sku:'A007',name:'Áo QA',price:289000,stock:3},
  ];
  const r=render({rows}),payloads=buttons(msg(r)).map(b=>b.payload);
  assert.deepEqual(payloads,['TIEN404:VIEW:A006','TIEN404:VIEW:A007']);
  assert.match(text(msg(r)),/Hết hàng/);
  assert.doesNotMatch(text(msg(r)),/A002|A003|A004|A005/);
});

test('catalog list with no eligible rows gives safe retry, not fake inventory',()=>{
  const r=render({rows:[{}]});
  assert.match(text(msg(r)),/chưa xác minh được/);
  assert.equal(buttons(msg(r)).length,0);
});

test('long catalog product names are clipped and cannot create oversized template or 4th button',()=>{
  const rows=products.map(r=>({...r,name:r.name+' x'.repeat(85)}));
  const result=render({rows,page:1});
  assert.equal(buttons(msg(result)).length,3);
  assert.ok(text(msg(result)).length<=640);
  assert.ok(text(msg(result)).length>20);
});

test('a product price, stock or SKU-list change invalidates an in-flight next-page cursor',()=>{
  const digest=render({page:1})[0].catalogDigest;
  const changedPrice=products.map(p=>({...p,...(p.sku==='A002'?{price:p.price+1000}:{})}));
  const changedStock=products.map(p=>({...p,...(p.sku==='A003'?{stock:0}:{})}));
  const removed=products.filter(p=>p.sku!=='A001');
  for(const rows of [changedPrice,changedStock,removed]){
    const r=render({page:2,digest,rows});
    assert.match(text(msg(r)),/Danh mục đã thay đổi/);
    assert.equal(buttons(msg(r)).length,0);
    assert.equal(next(msg(r)),undefined);
  }
});

test('catalog paging without a current snapshot fingerprint fails closed after first page',()=>{
  const r=render({page:2});
  assert.match(text(msg(r)),/hết hiệu lực/);
  assert.equal(buttons(msg(r)).length,0);
  assert.match(text(msg(render({page:2,digest:'ffffffff'}))),/Danh mục đã thay đổi/);
});

test('unchanged catalogue fingerprint supports both back/forward without fake pricing',()=>{
  const first=render({page:1});
  const digest=first[0].catalogDigest;
  const second=render({page:2,digest});
  assert.equal(second[0].catalogDigest,digest);
  const returned=render({page:1,digest});
  assert.deepEqual(buttons(msg(returned)).map(b=>b.payload),buttons(msg(first)).map(b=>b.payload));
  assert.equal(previous(msg(returned)),undefined);
});
