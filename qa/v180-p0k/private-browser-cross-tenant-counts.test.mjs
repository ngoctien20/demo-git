import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=new URL('./private-browser-cross-tenant-counts.js',import.meta.url);
const s=readFileSync(file,'utf8');
test('production origin pinned to exact staging account',()=>{
 assert.ok(s.includes("https://tien404-auth-staging.onrender.com"));
 assert.ok(s.includes("location.pathname!=='/account.html'"));
 assert.match(s,/confirm\(/);
});
test('uses current official Auth identity and verified JWT claims',()=>{
 for(const x of ['client.auth.getUser()','client.auth.getClaims()',"c.role!=='authenticated'","c.sub!==uid","c.iss!==ISSUER","UUID.test(c.session_id"])
  assert.ok(s.includes(x),x);
});
test('only RLS count-only SELECT of all six Commerce surfaces',()=>{
 for(const x of ["'products'","'orders'","'order_items'","'customers'","'conversations'","'messages'"])
  assert.ok(s.includes(x),x);
 assert.match(s,/count:'exact',head:true/g);
 assert.ok(s.includes(".neq('tenant_id',ownTenant)"));
 assert.ok(s.includes(".eq('tenant_id',ownTenant)"));
 assert.ok(s.includes(".neq('user_id',uid)"));
});
test('requires nonempty own baseline before negative visibility claims',()=>{
 assert.ok(s.includes("r.count<1"));
 assert.ok(s.includes("r.count!==0"));
 assert.ok(s.includes("AUTH_SUBJECT_CHANGED_DURING_TEST"));
 assert.ok(s.includes("LOCAL_TENANT_RLS_NEGATIVE_OBSERVED"));
});
test('forbid mutating/posting/sending/exfiltration code',()=>{
 for(const bad of [/\.insert\s*\(/,/\.update\s*\(/,/\.delete\s*\(/,
 /\.upsert\s*\(/,/\.rpc\s*\(/,/\bfetch\s*\(/,
 /XMLHttpRequest/,/navigator\.sendBeacon/,/localStorage\s*\./,
 /sessionStorage\s*\./,/document\.cookie/,/getSession\s*\(/,
 /setWebhook\s*\(/,/sendMessage\s*\(/,/service_role/i,
 /console\.(log|warn|error)\s*\(/])
 assert.equal(bad.test(s),false,String(bad));
});
test('local console output never prints raw identity or Auth objects',()=>{
 assert.ok(s.includes("console.info(TAG,"));
 assert.equal(/console\.info\([^\n]*(uid|ownTenant|members\.data|claimsRes|userRes)/.test(s),false);
});
