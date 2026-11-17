'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=__dirname;
const sql=fs.readFileSync(path.join(dir,'pg17-auth-bound-writer-disposable-only.sql'),'utf8');
const sh=fs.readFileSync(path.join(dir,'ci-pg17-auth-writer-rehearsal.sh'),'utf8');
const ci=fs.readFileSync(path.join(dir,'../../.github/workflows/v152-rpc12-auth-writer-disposable-nosend.yml'),'utf8');
const gate=require('./original-store-ownership-gate.cjs');
const packet=require('./owner-packet-private-template.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const contains=s=>new RegExp(s).test(sql);
for(const re of [
 /RPC12_REFUSES_NONDISPOSABLE_OR_INCOMPLETE_PARENT/,
 /current_database\(\)\s*<>\s*'t404_rpc8_ci'/,
 /RPC8_DISPOSABLE/,
 /NOT BETWEEN 170000 AND 179999/,
 /auth\.uid\(\)/,
 /CREATE ROLE qa_rpc12_writer NOLOGIN NOSUPERUSER NOBYPASSRLS/,
 /CREATE POLICY rpc12_writer_product_insert/,
 /CREATE POLICY rpc12_writer_product_update/,
 /GRANT UPDATE\(active\) ON qa_rpc8\.store_memberships TO qa_rpc12_writer/,
 /GRANT UPDATE\(active\) ON qa_rpc8\.tenant_memberships TO qa_rpc12_writer/,
 /GRANT UPDATE\(active\) ON qa_rpc8\.stores TO qa_rpc12_writer/,
 /CREATE POLICY rpc12_authority_lock_store/,
 /CREATE POLICY rpc12_authority_lock_member/,
 /CREATE POLICY rpc12_authority_lock_tenant/,
 /WITH CHECK\(false\)/,
 /WITH CHECK\(/,
 /FOR SHARE OF s,sm,tm/,
 /GRANT EXECUTE ON FUNCTION qa_rpc12_api\.create_product/,
 /REVOKE ALL ON FUNCTION qa_rpc12_api\.create_product/,
 /ALTER FUNCTION qa_rpc12\.create_product_inner.*OWNER TO qa_rpc12_writer/,
 /SECURITY INVOKER SET search_path = ''/,
 /SECURITY DEFINER SET search_path = ''/,
 /product_id := pg_catalog\.gen_random_uuid\(\)/,
 /WHERE tenant_id=trusted_tenant AND store_id=p_store/,
 /WHERE sm\.tenant_id=products\.tenant_id AND sm\.store_id=products\.store_id/,
 /canWriteHosted:false/ // not present in sql; special marker handled below
].slice(0,-1)){
 test('SQL invariant '+re,()=>assert.match(sql,re));
}
for(const forbidden of [/\bpublic\.(?:products|orders|customers|store_memberships|stores)\b/i,
 /\bservice_role\b/i,/\braw_user_meta_data\b/i,/\bpg_dump\b/i,/\bpg_restore\b/i]){
 test('SQL ban '+forbidden,()=>assert.doesNotMatch(sql.split('\n').filter(x=>!x.trim().startsWith('--')).join('\n'),forbidden));
}
for(const marker of ['RPC12_DISPOSABLE_ONLY','qa/v152-rpc10/pg17-six-surface-atomic-cutover-disposable-only.sql',
 'qa/v152-rpc11/pg17-store-writer-v2-disposable-only.sql','RPC12-SAME','RPC12-REVOKED',
 'AUTH.UID() claim-context contract','qa_rpc12_authenticated',"'RPC12-DIRECT'",'tenant automatically derived']){
 test('Bash rehearsal '+marker,()=>assert.ok(sh.includes(marker)));
}
for(const marker of ['postgres:17','t404_rpc8_ci','contents: read','node --test qa/v152-rpc12/source-only.test.cjs',
 'ci-pg17-auth-writer-rehearsal.sh','NO HOSTED']){
 test('CI invariant '+marker,()=>assert.ok(ci.includes(marker)));
}
test('safe four-row template structurally blocked',()=>{
 const result=gate.inspect(packet);assert.equal(result.status,'ORIGINAL_STORE_OWNER_HOSTED_NO_GO');
 assert.equal(result.coverage.uniqueSlots,4);assert.equal(result.canBackfill,false);
 assert.equal(result.realSupabaseJwtVerified,false);assert.ok(result.issues.length>=20);
});
test('even all-green metadata cannot authorize hosted',()=>{
 const p=clone(packet);for(const r of p.rows){
  r.privateRowBindingHmac='a'.repeat(64);r.privateTenantBindingHmac='b'.repeat(64);
  r.privateCanonicalStoreBindingHmac='c'.repeat(64);r.originalSourceType='VERIFIED_MERCHANT_EXPORT';
  r.originalSourceEvidenceSha256='d'.repeat(64);r.merchantOwnerAttestationSha256='e'.repeat(64);
  r.independentReviewerAttestationSha256='f'.repeat(64);r.sourceReviewedIndependently=true;
 }
 const s=gate.inspect(p);assert.equal(s.canRelease,false);assert.equal(s.canWriteHosted,false);
 assert.equal(s.actualStoreOwnerVerified,false);assert.equal(s.originalPrimarySourceFilesRead,false);
});
for(const bad of [null,{},[],{contract:'wrong',rows:[]}, {contract:gate.CONTRACT,scope:packet.scope,rows:[]}]){
 test('invalid input fail-closed '+JSON.stringify(bad),()=>{
  const r=gate.inspect(bad);assert.equal(r.canBackfill,false);assert.equal(r.canReplaceRls,false);
  assert.equal(r.status,'ORIGINAL_STORE_OWNER_HOSTED_NO_GO');
 });
}
for(const slot of ['P1','P2','O1','O2']){
 test('missing slot blocked '+slot,()=>{
  const p=clone(packet);p.rows=p.rows.filter(r=>r.slot!==slot);
  assert.ok(gate.inspect(p).issues.includes(slot+'_MISSING'));
 });
}
test('duplicate slot blocked',()=>{
 const p=clone(packet);p.rows[1].slot='P1';
 assert.ok(gate.inspect(p).issues.includes('INVALID_OR_DUPLICATE_SLOT'));
});
test('wrong row type blocked',()=>{
 const p=clone(packet);p.rows[0].entity='ORDER';
 assert.ok(gate.inspect(p).issues.includes('INVALID_OR_DUPLICATE_SLOT'));
});
test('no fake authority flags can ever be returned',()=>{
 const r=gate.inspect(packet);for(const key of Object.keys(r).filter(k=>/^can[A-Z]/.test(k)))assert.equal(r[key],false,key);
});
test('offline validator never has a network / process / Supabase client',()=>{
 const s=fs.readFileSync(path.join(dir,'original-store-ownership-gate.cjs'),'utf8');
 for(const f of [/\bfetch\s*\(/,/\bchild_process\b/,/\bcreateClient\s*\(/,/\bprocess\.env\b/,/\bhttps?\.request\s*\(/])
 assert.doesNotMatch(s,f);
});