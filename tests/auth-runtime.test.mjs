import test from 'node:test';
import assert from 'node:assert/strict';
import {withDeadline,isTimeout} from '../assets/auth-runtime.mjs';

test('returns fulfilled auth result without delay', async()=>{
  assert.deepEqual(await withDeadline(Promise.resolve({user:'safe-fixture'}),200),{user:'safe-fixture'});
});
test('returns provider rejection unchanged',async()=>{
  await assert.rejects(withDeadline(Promise.reject(new Error('offline')),200),/offline/);
});
test('unresponsive auth call stops blocking UI within a bounded wait',async()=>{
  const pending = new Promise(()=>{});
  const started=Date.now();
  await assert.rejects(withDeadline(pending,30),error=>isTimeout(error));
  assert.ok(Date.now()-started<1000);
});
test('deferred work remains authorization-neutral when timed out',async()=>{
  let complete;
  const later = new Promise(resolve=>{complete=resolve});
  await assert.rejects(withDeadline(later,15),error=>error.code==='AUTH_TIMEOUT');
  complete({success:true});
  assert.deepEqual(await later,{success:true});
});
