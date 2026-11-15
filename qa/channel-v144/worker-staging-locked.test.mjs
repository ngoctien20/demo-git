import assert from 'node:assert/strict';
import {test} from 'node:test';
import gateway from './worker-staging-locked.mjs';
const base='https://v144-staging.invalid';
for(const [method,path,expected] of [
  ['GET','/__v144/health',200],
  ['POST','/v1/widget/session',423],
  ['POST','/v1/widget/message',423],
  ['POST','/v1/widget/install',423],
  ['GET','/v1/widget/catalog',423],
  ['OPTIONS','/v1/widget/message',423],
  ['GET','/nonexistent',404]
])test(`V14.4 ${method} ${path} => ${expected}`,async()=>{
  const response=await gateway.fetch(new Request(base+path,{method,headers:{origin:'https://untrusted.invalid','x-store-id':'shop-b'}}));
  assert.equal(response.status,expected);
  assert.equal(response.headers.get('access-control-allow-origin'),null);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(response.headers.get('content-security-policy'),/default-src 'none'/);
  const result=await response.json();
  assert.equal(result.token,undefined);
  if(expected===423)assert.equal(result.error,'V144_WIDGET_GATE_CLOSED');
  if(path==='/__v144/health'){
    assert.equal(result.productionReady,false);
    assert.equal(result.aiCallsEnabled,false);
    assert.equal(result.providerSendsEnabled,false);
    assert.equal(result.orderWritesEnabled,false);
  }
});