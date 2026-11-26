import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const config=JSON.parse(readFileSync(resolve(here,'wrangler.hosted.NO_DEPLOY.jsonc'),'utf8'));
const entry=readFileSync(resolve(here,config.main),'utf8');
const claim=readFileSync(resolve(here,'../v1721-zalo-durable/zalo-sqlite-claim-v2.mjs'),'utf8');
const configText=JSON.stringify(config);

test('named private staging script, not live Bot or existing replay worker',()=>{
 assert.equal(config.name,'tien404-v1721h2-zalo-replay-private-nosend-staging');
 assert.ok(config.name.includes('private-nosend-staging'));
 assert.notEqual(config.name,'tien404-v175e2-durable-replay-nosend-staging');
 assert.notEqual(config.name,'tien404-v175e2-ab-gateway-nosend-staging');
});
test('public Workers.dev and preview URL explicitly disabled',()=>{
 assert.equal(config.workers_dev,false);
 assert.equal(config.preview_urls,false);
});
test('no public routes, triggers, domains, cron, custom domains or zones',()=>{
 assert.deepEqual(config.routes,[]);
 for(const p of ['route','custom_domain','custom_domains','triggers','zone_id','zone_name','tail_consumers','placement']){
  assert.equal(Object.hasOwn(config,p),false,'unexpected public/invocation config: '+p);
 }
});
test('no observability log persistence or raw PII metadata',()=>{
 assert.deepEqual(config.observability,{enabled:false});
 assert.ok(!/(customer_id|phone_number|recipient_id|webhook_secret|secret_token|service_role|bearer)/i.test(configText));
});
test('exactly one *new* isolated SQL-backed Durable Object class migration',()=>{
 assert.deepEqual(config.durable_objects.bindings,[{name:'ZALO_REPLAY_V2',class_name:'ZaloBotReplayBucketV2'}]);
 assert.deepEqual(config.migrations,[{tag:'v1',new_sqlite_classes:['ZaloBotReplayBucketV2']}]);
 assert.ok(!configText.includes('ReplayBucket"'));
 assert.ok(!configText.includes('INSTALLATION_REGISTRY'));
});
test('no public fetch handler, HTTP gateway or production path',()=>{
 assert.ok(entry.includes('export class ZaloBotReplayBucketV2 extends DurableObject'));
 assert.ok(entry.includes('ctx.blockConcurrencyWhile'));
 assert.ok(entry.includes('claimReplayV2'));
 const executable=entry.split('\n').filter(line=>!line.trim().startsWith('//')&&!line.trim().startsWith('*')).join('\n');
 assert.ok(!/\bexport\s+default\b/.test(executable));
 assert.ok(!/\basync\s+fetch\s*\(/.test(executable));
 assert.ok(!/\bfetch\s*\(/.test(executable));
 assert.ok(!/\bconsole\./.test(executable));
 assert.ok(!/\bprocess\.env\b/.test(executable));
});
test('claim storage accepts only SHA-256 hex and does not retain raw identifiers',()=>{
 assert.ok(claim.includes('const HEX64=/^[0-9a-f]{64}$/;'));
 assert.ok(claim.includes('INSERT_ATOMIC'));
 assert.ok(claim.includes('CONFLICT'));
 assert.ok(claim.includes('86_400_000'));
 assert.ok(!/\baxios\b|\bXMLHttpRequest\b|\bfetch\s*\(/.test(claim));
});
test('migration named version has no credentials or outbound links',()=>{
 assert.ok(!/https?:\/\//.test(entry));
 assert.ok(!/X-Bot-Api-Secret-Token|X-ZEvent-Signature/.test(entry));
 assert.ok(!/setWebhook|sendMessage|createOrder/.test(entry));
});
test('configuration is deliberately NOT a deployed default config',()=>{
 assert.ok(config.main.startsWith('../v1721-zalo-durable/'));
 assert.equal(config.compatibility_date,'2026-11-17');
});
test('assert no runtime-public endpoint accidentally enabled by comment drift',()=>{
 const forbidden=['workers_dev":true','preview_urls":true','"routes":[{','"route":','"custom_domain":'];
 for (const fragment of forbidden)assert.equal(configText.includes(fragment),false);
});
