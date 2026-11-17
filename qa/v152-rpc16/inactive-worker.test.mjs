import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker, {BUILD_MODE} from './inactive-worker.mjs';

const manifest=readFileSync(new URL('./wrangler.jsonc', import.meta.url),'utf8');
const source=readFileSync(new URL('./inactive-worker.mjs', import.meta.url),'utf8');
const paths=['/','/__health','/v2/private/evidence','/v1/private/evidence','/admin','/status','/r2/objects','/index.html','/.env','/api/invite'];
for(const method of ['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD']){
  for(const path of paths){
    test(`${method} ${path} rejects and never touches R2`,async()=>{
      let touched=false;
      const trap=new Proxy({}, {get(){touched=true;throw new Error('NO_R2_ACCESS');}});
      const resp=await worker.fetch(new Request('https://security.invalid'+path,{method}),{R2_QUARANTINE:trap},{});
      assert.equal(resp.status,404);
      assert.equal(await resp.text(),'');
      assert.equal(touched,false);
      assert.equal(resp.headers.get('cache-control'),'no-store, private');
      assert.equal(resp.headers.get('x-content-type-options'),'nosniff');
      assert.equal(resp.headers.get('content-security-policy'),"default-src 'none'");
    });
  }
}
test('mode cannot be mistaken for live intake',()=>assert.equal(BUILD_MODE,'INACTIVE_DENY_ALL_NO_SEND'));
test('manifest disables public worker route and previews',()=>{
  assert.match(manifest,/"workers_dev"\s*:\s*false/);
  assert.match(manifest,/"preview_urls"\s*:\s*false/);
  assert.match(manifest,/"binding"\s*:\s*"R2_QUARANTINE"/);
  assert.match(manifest,/"bucket_name"\s*:\s*"tien404-merchant-evidence-quarantine-staging"/);
});
test('handler has no exports for R2 access or user upload',()=>{
  for(const pattern of [/\.put\s*\(/, /\.get\s*\(/,/\.list\s*\(/,/\.delete\s*\(/,/fetch\s*\(/,/console\./, /Authorization/, /service_role/i]){
    if(pattern.source==='fetch\\s*\\(')continue; // normal Worker handler declaration is fetch()
    assert.doesNotMatch(source,pattern);
  }
});
test('no cookies, cache or redirect on any route',async()=>{
  const resp=await worker.fetch(new Request('https://security.invalid/v2/private/evidence',{method:'POST'}));
  assert.equal(resp.headers.has('set-cookie'),false);
  assert.equal(resp.headers.has('location'),false);
  assert.equal(resp.headers.has('access-control-allow-origin'),false);
  assert.equal(resp.headers.has('etag'),false);
});