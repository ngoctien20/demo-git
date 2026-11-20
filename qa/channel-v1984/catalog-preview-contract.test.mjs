import assert from 'node:assert/strict';
import {formatCatalogCandidate} from './catalog-preview-contract.mjs';

const nowMs = Date.parse('2026-11-19T11:00:00.000Z');
const T='00000000-0000-0000-0000-000000000001';
const A='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
function base() {
 return {
  mode:'SYNTHETIC_OFFLINE_ONLY',readerProof:'EPHEMERAL_PG_MOCK_RLS',nowMs,
  scope:{source:'SYNTHETIC_SERVER_FIXTURE',tenantId:T,storeId:A},
  query:{sku:'F01',quantity:1},
  rows:[{tenant_id:T,store_id:A,sku:'F01',price_vnd:159000,stock_on_hand:5,
    verified_at:new Date(nowMs-60000).toISOString(),currency:'VND',source_revision:'V1984_A_001'}]
 };
}
const cases = [
 ['valid unit quote',x=>{},'OFFLINE_PREVIEW'],
 ['multiple quantity allowed',x=>{x.query.quantity=5},'OFFLINE_PREVIEW'],
 ['insufficient stock',x=>{x.query.quantity=6},'INSUFFICIENT_STOCK'],
 ['zero stock, no order',x=>{x.rows[0].stock_on_hand=0},'INSUFFICIENT_STOCK'],
 ['missing request object',x=>{delete x.mode},'DENY'],
 ['forged runtime mode',x=>{x.mode='LIVE_ZALO'},'DENY'],
 ['fake reader proof',x=>{x.readerProof='REAL_AUTH'},'DENY'],
 ['missing scope',x=>{delete x.scope},'DENY'],
 ['untrusted scope source',x=>{x.scope.source='CUSTOMER_PAYLOAD'},'DENY'],
 ['tenant scope invalid',x=>{x.scope.tenantId='tenant-a'},'DENY'],
 ['store scope invalid',x=>{x.scope.storeId='store-b'},'DENY'],
 ['missing query',x=>{delete x.query},'DENY'],
 ['missing sku',x=>{delete x.query.sku},'DENY'],
 ['lowercase sku',x=>{x.query.sku='f01'},'DENY'],
 ['sku injection',x=>{x.query.sku="F01' OR 1=1"},'DENY'],
 ['quantity zero',x=>{x.query.quantity=0},'DENY'],
 ['quantity negative',x=>{x.query.quantity=-1},'DENY'],
 ['quantity decimal',x=>{x.query.quantity=2.5},'DENY'],
 ['quantity max exceeded',x=>{x.query.quantity=101},'DENY'],
 ['zero rows',x=>{x.rows=[]},'DENY'],
 ['multiple rows ambiguous',x=>{x.rows.push({...x.rows[0]})},'DENY'],
 ['null row',x=>{x.rows=[null]},'DENY'],
 ['cross tenant catalog',x=>{x.rows[0].tenant_id='ffffffff-ffff-ffff-ffff-ffffffffffff'},'DENY'],
 ['cross store catalog',x=>{x.rows[0].store_id=B},'DENY'],
 ['wrong sku catalog',x=>{x.rows[0].sku='G01'},'DENY'],
 ['wrong currency',x=>{x.rows[0].currency='USD'},'DENY'],
 ['unverified revision',x=>{x.rows[0].source_revision='WRONG_SOURCE'},'DENY'],
 ['price float',x=>{x.rows[0].price_vnd=159000.5},'DENY'],
 ['price zero',x=>{x.rows[0].price_vnd=0},'DENY'],
 ['price negative',x=>{x.rows[0].price_vnd=-1000},'DENY'],
 ['price beyond VND cap',x=>{x.rows[0].price_vnd=9000000000000001},'DENY'],
 ['negative stock',x=>{x.rows[0].stock_on_hand=-1},'DENY'],
 ['decimal stock',x=>{x.rows[0].stock_on_hand=2.5},'DENY'],
 ['absurd stock cap',x=>{x.rows[0].stock_on_hand=10000001},'DENY'],
 ['clock missing',x=>{delete x.nowMs},'DENY'],
 ['clock invalid',x=>{x.nowMs=NaN},'DENY'],
 ['verified timestamp missing',x=>{delete x.rows[0].verified_at},'DENY'],
 ['stale data',x=>{x.rows[0].verified_at=new Date(nowMs-300001).toISOString()},'DENY'],
 ['future data',x=>{x.rows[0].verified_at=new Date(nowMs+1000).toISOString()},'DENY'],
 ['VND total overflow',x=>{x.rows[0].price_vnd=9000000000000000;x.query.quantity=2;x.rows[0].stock_on_hand=2},'DENY'],
 ['missing currency',x=>{delete x.rows[0].currency},'DENY'],
 ['object instead of rows',x=>{x.rows={}},'DENY'],
 ['bad timestamp format',x=>{x.rows[0].verified_at='not-a-date'},'DENY'],
 ['missing source revision',x=>{delete x.rows[0].source_revision},'DENY']
];
let passed=0;
for (const [label,change,expected] of cases) {
 const x=base();change(x);
 const out=formatCatalogCandidate(x);
 assert.equal(out.decision,expected,label);
 assert.equal(out.canReadHosted,false,label+' read');
 assert.equal(out.canSend,false,label+' send');
 assert.equal(out.canWrite,false,label+' write');
 assert.equal(out.orderCommitted,false,label+' order');
 assert.equal(out.stockReserved,false,label+' reserve');
 assert.equal(/TOKEN|SECRET|JWT|service_role/.test(out.replyPreview),false,label+' no credential');
 if (out.decision!=='DENY') {
  assert.ok(out.replyPreview.startsWith('[TIEN404 QA — DỮ LIỆU MẪU]'),label);
  assert.ok(out.replyPreview.includes('Chưa '),label);
 }
 passed++;
}
console.log('TIEN404_V1984_OFFLINE_PREVIEW_PASS='+passed);
