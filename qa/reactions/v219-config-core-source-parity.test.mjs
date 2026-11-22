// V21.9: golden SELECT-only hosted audit must stay tied to exact repo source.
// Offline only; NO Supabase or Meta access.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const core=readFileSync(new URL('../../db/config-core/10_config_core.sql',import.meta.url),'utf8');
const audit=readFileSync(new URL('./v219-config-core-source-parity.sql',import.meta.url),'utf8');
const tables=['action_types','industry_templates','assistants','assistant_config_versions','channel_connections'];
const functions=[
'app_private.t404_acv_guard','app_private.t404_cfg_lock_assistant','app_private.t404_cfg_manager_tenant',
'app_private.t404_cfg_sha','app_private.t404_cfg_validate','public.create_assistant',
'public.publish_assistant_config','public.resolve_channel_assistant',
'public.rollback_assistant_config','public.save_assistant_draft'
];
const digest=(str)=>createHash('md5').update(str,'utf8').digest('hex');
test('hosted Config Core audit is SELECT only and never returns permissions to deploy',()=>{
 assert.ok(audit.includes("'T404_V219_SOURCE_PARITY_READONLY'"));
 assert.match(audit,/false AS authorization_to_apply_migration/);
 assert.match(audit,/false AS authorization_to_enable_meta_reactions/);
 const withoutComments=audit.split('\n').filter(x=>!x.trimStart().startsWith('--')).join('\n');
 assert.match(withoutComments,/^WITH expected_cols/);
 assert.doesNotMatch(withoutComments,/\b(?:CREATE|DROP|ALTER|TRUNCATE|REVOKE|GRANT|INSERT|UPDATE|DELETE)\s+(?:TABLE|FUNCTION|POLICY|INDEX|INTO|FROM|ON)\b/i);
});
test('45 expected table columns exactly match source names, types and nullability',()=>{
 let count=0;
 for(const table of tables){
  const a=core.indexOf('CREATE TABLE public.'+table+'('),b=core.indexOf('\n);',a);
  assert.ok(a>0&&b>a,table+' source exists');
  for(const line of core.slice(a,b).split('\n').slice(1)){
   const m=line.match(/^\s+([a-z][a-z0-9_]*)\s+(uuid|text|int|jsonb|timestamptz)\b(.*)/);
   if(!m)continue;
   const ty={int:'integer',timestamptz:'timestamp with time zone'}[m[2]]||m[2];
   const required=/\bNOT NULL\b|\bPRIMARY KEY\b/.test(m[3]);
   assert.ok(audit.includes("('"+table+"','"+m[1]+"','"+ty+"',"+(required?'true':'false')+")"),table+'.'+m[1]);
   count++;
  }
 }
 assert.equal(count,45);
});
test('each fingerprint is pinned to the exact 10 function source bodies',()=>{
 for(const fn of functions){
  const a=core.indexOf('CREATE FUNCTION '+fn+'(');
  const start=core.indexOf('AS $f$',a);
  const end=core.indexOf('$f$;',start+6);
  assert.ok(a>=0&&start>a&&end>start,fn);
  const body=core.slice(start+6,end);
  const [schema,name]=fn.split('.');
  assert.ok(audit.includes("('"+schema+"','"+name+"','"+digest(body)+"')"),fn+' body fingerprint changed');
 }
});
test('audit enforces constraints, triggers, forced RLS, privileged RPC grants, and migration provenance',()=>{
 for(const name of [
 'assistants_scope_key','assistants_store_fk','assistants_template_fk',
 'acv_assistant_fk','acv_version_key','acv_published_meta',
 'acv_one_draft','acv_one_published','t404_acv_guard',
 'channel_connections_account_key','channel_connections_store_fk','channel_connections_assistant_fk',
 'action_types_auth_read','industry_templates_auth_read','assistants_store_member_read',
 'acv_store_member_read','channel_connections_store_member_read'
 ])assert.ok(audit.includes("'"+name+"'"),name);
 assert.ok(audit.includes('config_core_tracked_names'));
 assert.ok(audit.includes('has_function_privilege'));
 assert.ok(audit.includes('relforcerowsecurity'));
 assert.ok(audit.includes('source_expected_function_bodies'));
});
