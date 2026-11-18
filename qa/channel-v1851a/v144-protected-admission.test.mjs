import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../channel-v1854/worker-v144-access-canary-candidate.mjs';
import { verifyPrivateAccess } from '../channel-v1854/cloudflare-access-context-gate.mjs';

const HOST = 'tien404-widget-gateway-v144-staging.tienmobi208.workers.dev';
const AUD = 'a'.repeat(64);
const OWNER = 'synthetic-owner@example.invalid';
const ENV = Object.freeze({ T404_ACCESS_AUD: AUD, T404_QA_OPERATOR_EMAIL: OWNER });
const goodContext = () => ({ access: { aud: AUD, getIdentity: async () => ({ email: OWNER, id: 'synthetic-personal-id' }) } });
const request = (path, method='GET', headers={}) =>
  new Request('https://' + HOST + path, { method, headers });
const call = (path, method='GET', ctx=goodContext(), headers={}, env=ENV) =>
  worker.fetch(request(path, method, headers), env, ctx);
const getBody = async response => ({ status: response.status, headers: response.headers, body: await response.json() });

test('unauthenticated callers cannot enumerate canary, health, locked Widget or unknown routes', async () => {
  const paths = ['/__v1854/access-canary','/__v144/health','/v1/widget/session','/v1/widget/message','/v1/widget/install','/v1/widget/commerce/read','/unlisted?token=fake'];
  for (const path of paths) {
    const {status,body}=await getBody(await call(path,'GET',{}));
    assert.equal(status,403,path);
    assert.equal(body.error,'ACCESS_CONTEXT_REQUIRED',path);
    assert.equal(body.productionReady,false);
  }
});

test('forged Access JWT header, cookie, Origin and forwarded headers never create ctx.access', async () => {
  const headers = {
    'Cf-Access-Jwt-Assertion':'ey.fake.payload.signature',
    'Cf-Access-Authenticated-User-Email':OWNER,
    'Cookie':'CF_Authorization=forged-cookie',
    'Origin':'https://'+HOST,
    'X-Forwarded-Host':HOST,
    'X-Forwarded-For':'127.0.0.1'
  };
  for (const path of ['/__v1854/access-canary','/v1/widget/session']) {
    const response=await call(path,'GET',{},headers);
    assert.equal(response.status,403);
    assert.equal((await response.json()).error,'ACCESS_CONTEXT_REQUIRED');
    assert.equal(response.headers.get('access-control-allow-origin'),null);
    assert.equal(response.headers.get('access-control-allow-credentials'),null);
  }
});

test('wrong or ambiguous Access AUD is never accepted', async () => {
  for (const aud of ['b'.repeat(64), [AUD, 'b'.repeat(64)], [], null, undefined, 'abc']) {
    const ctx={access:{aud,getIdentity:async()=>({email:OWNER})}};
    const verdict=await verifyPrivateAccess(ctx,ENV);
    assert.equal(verdict.ok,false);
    assert.equal(verdict.code,'ACCESS_AUDIENCE_MISMATCH');
  }
});

test('missing or malformed server Access AUD/owner settings fail closed', async () => {
  for (const env of [{},{...ENV,T404_ACCESS_AUD:'not-an-aud'},{...ENV,T404_QA_OPERATOR_EMAIL:'x'}, {...ENV,T404_QA_OPERATOR_EMAIL:''}]) {
    const r=await call('/__v1854/access-canary','GET',goodContext(),{},env);
    assert.equal(r.status,503);
    assert.equal((await r.json()).error,'ACCESS_CONFIGURATION_INVALID');
  }
});

test('Access identity lookup errors and missing identity fail closed', async () => {
  for (const getIdentity of [async()=>{throw Error('private');},async()=>({}),async()=>({email:''})]) {
    const r=await call('/__v1854/access-canary','GET',{access:{aud:AUD,getIdentity}});
    assert.notEqual(r.status,200);
    assert.equal(r.headers.get('cache-control'),'no-store, max-age=0');
  }
});

test('a second non-allowlisted identity is denied even with valid AUD in synthetic QA', async () => {
  for(const email of ['other@example.invalid','synthetic-owner+alias@example.invalid']) {
    const ctx={access:{aud:AUD,getIdentity:async()=>({email})}};
    const r=await call('/__v1854/access-canary','GET',ctx);
    assert.equal(r.status,403);
    assert.equal((await r.json()).error,'ACCESS_OPERATOR_NOT_ALLOWLISTED');
  }
});

test('approved owner can access private Canary with no leaked identity or customer data', async () => {
  const r=await call('/__v1854/access-canary');
  const body=await r.json();
  assert.equal(r.status,200);
  assert.equal(body.canary,'CLOUDFLARE_ACCESS_CONTEXT_VERIFIED');
  assert.equal(body.principalType,'CLOUDFLARE_ACCESS_PRIVATE_QA_OPERATOR');
  assert.equal(body.audienceVerified,true);
  assert.equal(body.operatorAllowlisted,true);
  assert.equal(body.privateOrderAccess,false);
  assert.equal(body.orderWrites,0);
  assert.equal(body.providerSends,0);
  assert.equal(body.productionReady,false);
  assert.equal(body.commerce,'LOCKED_PENDING_READONLY_ADAPTER');
  const serialized=JSON.stringify(body);
  for (const forbidden of [OWNER,AUD,'synthetic-personal-id','tenantId','storeId','customerId','credential','authorization']) {
    assert.equal(serialized.includes(forbidden),false,forbidden);
  }
});

test('private health is locked and contains no customer, billing or tenant data', async () => {
  const r=await call('/__v144/health');
  const b=await r.json();
  assert.equal(r.status,200);
  for (const key of ['state','environment','accessRequired','sessionIssuanceEnabled','aiCallsEnabled','orderWritesEnabled','providerSendsEnabled','productionReady']) {
    assert.ok(Object.hasOwn(b,key),key);
  }
  assert.equal(b.state,'LOCKED');
  assert.equal(b.accessRequired,true);
  assert.equal(b.sessionIssuanceEnabled,false);
  assert.equal(b.aiCallsEnabled,false);
  assert.equal(b.orderWritesEnabled,false);
  assert.equal(b.providerSendsEnabled,false);
  assert.equal(b.productionReady,false);
});

test('all Commerce/session/message/install paths stay locked for approved operator', async () => {
  for(const path of ['/v1/widget/session','/v1/widget/message','/v1/widget/install','/v1/widget/commerce/read','/v1/widget/foo','/v1/widget/']) {
    for(const method of ['GET','POST','OPTIONS']) {
      const r=await call(path,method);
      assert.equal(r.status,423,method+' '+path);
      const b=await r.json();
      assert.equal(b.error,'COMMERCE_READONLY_ADAPTER_NOT_ADMITTED');
      assert.equal(b.productionReady,false);
      assert.equal(r.headers.get('access-control-allow-origin'),null);
    }
  }
});

test('OPTIONS preflight cannot bypass native Access or CORS gate', async () => {
  const denied=await call('/__v1854/access-canary','OPTIONS',{});
  assert.equal(denied.status,403);
  const blocked=await call('/__v1854/access-canary','OPTIONS');
  assert.equal(blocked.status,405);
  assert.equal((await blocked.json()).error,'CORS_DISABLED_PRIVATE_SAME_ORIGIN_ONLY');
  const widget=await call('/v1/widget/message','OPTIONS');
  assert.equal(widget.status,423);
  for(const r of [denied,blocked,widget]) {
    assert.equal(r.headers.get('access-control-allow-origin'),null);
    assert.equal(r.headers.get('access-control-allow-credentials'),null);
  }
});

test('unsupported routes are 404 only after Access and never reflect query secrets', async () => {
  const url='/arbitrary-private?customer=do-not-echo-me';
  const owner=await call(url);
  assert.equal(owner.status,404);
  assert.equal(JSON.stringify(await owner.json()).includes('do-not-echo-me'),false);
  const anonymous=await call(url,'GET',{});
  assert.equal(anonymous.status,403);
});

test('Canary and health GET only; HEAD/POST do not open an alternate admission route', async () => {
  for (const path of ['/__v1854/access-canary','/__v144/health']) {
    const post=await call(path,'POST');
    assert.equal(post.status,404,path);
    const head=await call(path,'HEAD');
    assert.equal(head.status,404,path);
    const anonymousPost=await call(path,'POST',{});
    assert.equal(anonymousPost.status,403,path);
  }
});

test('responses include strict private-cache and browser security headers', async () => {
  for(const path of ['/__v1854/access-canary','/__v144/health','/v1/widget/session','/unknown']) {
    const r=await call(path);
    assert.equal(r.headers.get('cache-control'),'no-store, max-age=0');
    assert.equal(r.headers.get('x-content-type-options'),'nosniff');
    assert.equal(r.headers.get('referrer-policy'),'no-referrer');
    assert.equal(r.headers.get('x-frame-options'),'DENY');
    assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(r.headers.get('access-control-allow-origin'),null);
  }
});

test('source gate has no external HTTP, secret/token read, billing or Write capability', () => {
  const access=fs.readFileSync(new URL('../channel-v1854/cloudflare-access-context-gate.mjs',import.meta.url),'utf8');
  const code=fs.readFileSync(new URL('../channel-v1854/worker-v144-access-canary-candidate.mjs',import.meta.url),'utf8');
  assert.match(access,/ctx&&ctx\.access/);
  assert.match(access,/access\.getIdentity\(\)/);
  assert.match(access,/ACCESS_AUDIENCE_MISMATCH/);
  assert.match(code,/verifyPrivateAccess\(ctx,env\)/);
  assert.match(code,/COMMERCE_READONLY_ADAPTER_NOT_ADMITTED/);
  assert.equal(/await\s+fetch\s*\(/.test(code),false);
  assert.equal(/https:\/\/ngoctien20\.app\.n8n\.cloud/.test(code),false);
  assert.equal(/T404_N8N_READONLY_ADAPTER_TOKEN/.test(code),false);
  assert.equal(/T404_READ_ADMISSION/.test(code),false);
});

test('source-only regression cannot substitute for real alternate-account Cloudflare denial', () => {
  // This check prevents accidentally treating this unit fixture as a Cloudflare edge test.
  const report=JSON.parse(fs.readFileSync(new URL('./v144-protected-admission-evidence.json',import.meta.url),'utf8'));
  assert.equal(report.realUserOwnerLogin.verified,true);
  assert.equal(report.alternateIdentityDenied.verified,false);
  assert.equal(report.externalUnauthenticatedEdgeTest.verified,false);
  assert.equal(report.n8nLiveHttpAuth.verified,false);
  assert.equal(report.cloudflareDeployedWorkerChange,false);
  assert.equal(report.productionRelease,false);
});
