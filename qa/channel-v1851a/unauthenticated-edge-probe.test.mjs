import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyUnauthenticatedEdge,runEdgeProbe,EDGE_HOST,PATHS} from './unauthenticated-edge-probe.mjs';

test('Cloudflare Access redirect to team login is classified as intercepted',()=>{
  const r=classifyUnauthenticatedEdge({status:302,location:'https://team.cloudflareaccess.com/cdn-cgi/access/login?k=redacted',path:PATHS[0]});
  assert.equal(r.kind,'UNAUTHENTICATED_ACCESS_LOGIN_REDIRECT');
  assert.equal(r.verified,true);
  assert(!JSON.stringify(r).includes('redacted'));
});

test('Cloudflare dashboard challenge redirect is recognized without copying challenge',()=>{
  const r=classifyUnauthenticatedEdge({status:302,location:'https://dash.cloudflare.com/login?login_challenge=SENSITIVE',path:PATHS[0]});
  assert.equal(r.kind,'UNAUTHENTICATED_ACCESS_LOGIN_REDIRECT');
  assert.equal(r.verified,true);
  assert(!JSON.stringify(r).includes('SENSITIVE'));
});

test('Worker internal Access route redirect is treated as intercepted only on exact host',()=>{
  const a=classifyUnauthenticatedEdge({status:302,location:'https://'+EDGE_HOST+'/cdn-cgi/access/login',path:PATHS[0]});
  const b=classifyUnauthenticatedEdge({status:302,location:'https://attacker.example/cdn-cgi/access/login',path:PATHS[0]});
  assert.equal(a.verified,true);
  assert.equal(b.verified,false);
});

test('403/401 or 200 HTML are not mistaken for verified alternate identity denial',()=>{
  for(const status of [401,403,200]){
    const r=classifyUnauthenticatedEdge({status,bodySample:'<html>Cloudflare login</html>',path:PATHS[0]});
    assert.equal(r.verified,false);
  }
});

test('unauthenticated Canary JSON HTTP 200 is an explicit security stop',()=>{
  const r=classifyUnauthenticatedEdge({
    status:200,path:PATHS[0],
    bodySample:'{"service":"tien404-widget-gateway","canary":"CLOUDFLARE_ACCESS_CONTEXT_VERIFIED"}'
  });
  assert.equal(r.kind,'SECURITY_FAILURE_WORKER_JSON_PUBLIC');
  assert.equal(r.verified,false);
});

test('malicious redirect or invalid redirect are inconclusive',()=>{
  for(const location of ['http://dash.cloudflare.com/login','https://evil.example/login','http://team.cloudflareaccess.com/cdn-cgi/access/login','%%%']){
    const r=classifyUnauthenticatedEdge({status:302,location,path:PATHS[0]});
    assert.equal(r.verified,false);
  }
});

test('probe uses exactly three unauthenticated GETs, without credential headers',async()=>{
  const requests=[];
  const redirect='https://team.cloudflareaccess.com/cdn-cgi/access/login?login_challenge=private';
  const fakeFetch=async(url,options)=>{
    requests.push({url,options});
    return new Response('',{status:302,headers:{location:redirect}});
  };
  const r=await runEdgeProbe(fakeFetch);
  assert.equal(r.length,3);
  assert(r.every(x=>x.kind==='UNAUTHENTICATED_ACCESS_LOGIN_REDIRECT'));
  assert(requests.every(x=>x.options.method==='GET'));
  assert(requests.every(x=>x.options.redirect==='manual'));
  assert(requests.every(x=>!Object.hasOwn(x.options.headers,'Cookie')));
  assert(requests.every(x=>!Object.hasOwn(x.options.headers,'Authorization')));
  assert.deepEqual(requests.map(x=>x.url),PATHS.map(path=>'https://'+EDGE_HOST+path));
  assert(!JSON.stringify(r).includes('login_challenge'));
});

test('network failure produces inconclusive result, not false Pass',async()=>{
  const r=await runEdgeProbe(async()=>{throw Error('DNS unavailable');});
  assert.equal(r.length,3);
  assert(r.every(x=>x.kind==='INCONCLUSIVE_NETWORK_OR_TIMEOUT'));
  assert(r.every(x=>x.verified===false));
});
