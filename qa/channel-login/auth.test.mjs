import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from './registry.mjs';
import { callbackUrl, chooseShop, returnRoute } from '../../apps/owner/src/loginFlow.mjs';

test('Callback tại gốc staging và /demo-git/app/ bỏ query và hash',()=>{
  for(const base of ['https://qa.invalid/','https://qa.invalid/demo-git/app/'])
    assert.equal(callbackUrl(base+'?code=fixture#/kenh-ban'),base);
  assert.equal(returnRoute('#/kenh-ban'),'/kenh-ban');
  for(const url of ['//outside.invalid','https://outside.invalid','#/kenh-ban?next=outside']) assert.equal(returnRoute(url),'/');
});
test('Chọn theo danh sách membership: mới, chủ cũ, nhiều shop, mã không thuộc chủ',()=>{
  const a={id:'A'}, b={id:'B'};
  assert.equal(chooseShop([],null),null);
  assert.equal(chooseShop([a],null),a);
  assert.equal(chooseShop([a,b],null),null);
  assert.equal(chooseShop([a,b],'B'),b);
  assert.equal(chooseShop([a,b],'C'),null);
});
test('Cấp quyền, đổi tab, phát lại, trùng tài sản, thu hồi quyền, ngắt riêng, hết hạn',()=>{
  let time=0;
  const r=createRegistry(()=>time);
  try {
    r.member('one','A','owner'); r.member('one','B','manager'); r.member('two','B','owner'); r.member('staff','A','staff');
    assert.throws(()=>r.start('staff','A','zalo_oa'),/forbidden/);
    const a=r.start('one','A','messenger'), b=r.start('one','B','messenger');
    assert.throws(()=>r.finish('two',a,'messenger','page1'),/invalid/);
    assert.throws(()=>r.finish('one',a,'zalo_oa','page1'),/invalid/);
    assert.equal(r.finish('one',a,'messenger','page1'),'A');
    r.finish('one',a,'messenger','page1'); assert.equal(r.links('A').length,1);
    assert.throws(()=>r.finish('one',b,'messenger','page1'),/already/);
    r.finish('one',b,'messenger','page2');
    const oa=r.start('one','A','zalo_oa');
    r.member('one','A','staff');
    assert.throws(()=>r.finish('one',oa,'zalo_oa','oa1'),/forbidden/);
    r.member('one','A','owner'); r.finish('one',oa,'zalo_oa','oa1');
    r.disconnect('one','A','messenger','page1');
    assert.equal(r.links('A')[0].kind,'zalo_oa'); assert.equal(r.links('B').length,1);
    assert.throws(()=>r.finish('one',a,'messenger','page1'),/used/);
    const expired=r.start('one','A','messenger'); time=600001;
    assert.throws(()=>r.finish('one',expired,'messenger','page1'),/invalid/);
  } finally {r.close();}
});
