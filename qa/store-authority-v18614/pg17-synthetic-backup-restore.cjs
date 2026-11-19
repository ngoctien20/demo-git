'use strict';
/** V18.6.14: isolated disposable PG17 logical backup + restore validation.
 * Never invoke with a real database or real Supabase credentials.
 * CI step explicitly opts in, and all Pg calls run in postgres:17 Docker
 * against fixed local ephemeral GitHub Actions PostgreSQL service.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const DB_SOURCE = 't404_v18614_source';
const DB_RESTORE = 't404_v18614_restore';
const READER_ROLE = 't404_v18614_reader';
const REQUIRED_ENV = Object.freeze({
  CI: 'true',
  GITHUB_ACTIONS: 'true',
  V1863_DISPOSABLE_POSTGRES: 'true',
  V18614_DISPOSABLE_RESTORE: 'true',
  PGHOST: '127.0.0.1',
  PGPORT: '5432',
  PGUSER: 'postgres',
  PGDATABASE: 'tien404_v1863_qa',
  PGPASSWORD: 'v1863-disposable-only', // synthetic credential only
});
const BANNED_ENV = Object.freeze(['DATABASE_URL','SUPABASE_DB_URL','SUPABASE_ACCESS_TOKEN','SUPABASE_SERVICE_ROLE_KEY']);
const OUTSIDE_SCOPE = Object.freeze([
  'LIVE_SUPABASE_BACKUP', 'LIVE_SUPABASE_RESTORE', 'AUTH_STORAGE_VAULT_RECOVERY',
  'REAL_OWNER_AB_AUTH', 'REAL_STORE_RLS', 'PRODUCTION_READINESS'
]);
function assertDisposable(env) {
  for (const [name,value] of Object.entries(REQUIRED_ENV)) {
    assert.equal(env[name], value, `NO_GO: ${name} must match the disposable CI fixture`);
  }
  for (const name of BANNED_ENV) assert(!env[name], `NO_GO: forbidden external credential/env variable ${name}`);
  return true;
}
function run(cmd,args,{input}={}) {
  assert.equal(cmd,'docker');
  const r=spawnSync(cmd,args,{encoding:'utf8',input,timeout:90000,maxBuffer:1024*1024*10,
    env:{PATH:process.env.PATH,HOME:process.env.HOME,DOCKER_HOST:process.env.DOCKER_HOST}});
  if(r.error||r.status!==0) {
    // Never print stderr; executable failures can include connection details.
    throw Error(`DISPOSABLE_DOCKER_STEP_FAILED: ${args.find(x=>['psql','pg_dump','pg_dumpall','pg_restore'].includes(x))||'unknown'} (${r.error?.code||r.status})`);
  }
  return (r.stdout||'').trim();
}
function dockerTool(tool,args,workDir) {
  assert(['psql','pg_dump','pg_restore','pg_dumpall'].includes(tool));
  const base=['run','--rm','--network=host','--env','PGPASSWORD=v1863-disposable-only',
    '--volume',`${workDir}:/work:rw`, 'postgres:17',tool];
  return run('docker',base.concat(args));
}
function pg(db,sql,workDir) {
  assert(['postgres',DB_SOURCE,DB_RESTORE].includes(db));
  return dockerTool('psql',['--no-psqlrc','-X','-q','-t','-A','-v','ON_ERROR_STOP=1',
    '-h','127.0.0.1','-p','5432','-U','postgres','-d',db,'-c',sql],workDir);
}
const FIXTURE = `
CREATE SCHEMA commerce;
CREATE TABLE commerce.stores (
  tenant_id text NOT NULL, store_id text NOT NULL,
  PRIMARY KEY (tenant_id,store_id)
);
CREATE TABLE commerce.products (
  tenant_id text NOT NULL, store_id text NOT NULL, sku text NOT NULL,
  price_vnd integer NOT NULL CHECK (price_vnd >= 0), stock integer NOT NULL CHECK (stock >= 0),
  PRIMARY KEY (tenant_id,store_id,sku),
  FOREIGN KEY (tenant_id,store_id) REFERENCES commerce.stores(tenant_id,store_id)
);
CREATE TABLE commerce.orders (
  id text PRIMARY KEY, tenant_id text NOT NULL, store_id text NOT NULL,
  total_vnd integer NOT NULL CHECK (total_vnd >= 0),
  UNIQUE(tenant_id,store_id,id),
  FOREIGN KEY (tenant_id,store_id) REFERENCES commerce.stores(tenant_id,store_id)
);
CREATE TABLE commerce.order_items (
  id text PRIMARY KEY, tenant_id text NOT NULL, store_id text NOT NULL,
  order_id text NOT NULL, sku text NOT NULL, quantity integer NOT NULL CHECK(quantity > 0),
  FOREIGN KEY (tenant_id,store_id,order_id) REFERENCES commerce.orders(tenant_id,store_id,id),
  FOREIGN KEY (tenant_id,store_id,sku) REFERENCES commerce.products(tenant_id,store_id,sku)
);
CREATE FUNCTION commerce.current_store() RETURNS text LANGUAGE sql STABLE
AS $$ SELECT current_setting('t404.store_id',true) $$;
INSERT INTO commerce.stores VALUES ('TENANT_1','STORE_A'),('TENANT_1','STORE_B');
INSERT INTO commerce.products VALUES
('TENANT_1','STORE_A','SKU-001',159000,11),
('TENANT_1','STORE_B','SKU-001',189000,9);
INSERT INTO commerce.orders VALUES
('ORDER_A','TENANT_1','STORE_A',159000),
('ORDER_B','TENANT_1','STORE_B',189000);
INSERT INTO commerce.order_items VALUES
('LINE_A','TENANT_1','STORE_A','ORDER_A','SKU-001',1),
('LINE_B','TENANT_1','STORE_B','ORDER_B','SKU-001',1);
ALTER TABLE commerce.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.products FORCE ROW LEVEL SECURITY;
CREATE POLICY products_member_read ON commerce.products AS PERMISSIVE FOR SELECT
 TO ${READER_ROLE} USING (true);
CREATE POLICY products_store_boundary ON commerce.products AS RESTRICTIVE FOR SELECT
 TO ${READER_ROLE}
 USING (tenant_id = current_setting('t404.tenant_id',true)
    AND store_id = current_setting('t404.store_id',true));
GRANT USAGE ON SCHEMA commerce TO ${READER_ROLE};
GRANT SELECT ON commerce.products TO ${READER_ROLE};
`;
const DATA_SNAPSHOT = `
SELECT jsonb_build_object(
 'stores',(SELECT jsonb_agg(jsonb_build_array(tenant_id,store_id) ORDER BY store_id) FROM commerce.stores),
 'products',(SELECT jsonb_agg(jsonb_build_array(tenant_id,store_id,sku,price_vnd,stock) ORDER BY store_id,sku) FROM commerce.products),
 'orders',(SELECT jsonb_agg(jsonb_build_array(id,tenant_id,store_id,total_vnd) ORDER BY id) FROM commerce.orders),
 'lines',(SELECT jsonb_agg(jsonb_build_array(id,tenant_id,store_id,order_id,sku,quantity) ORDER BY id) FROM commerce.order_items)
)::text;
`;
const STRUCTURE_SNAPSHOT = `
SELECT jsonb_build_object(
  'constraints', (SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid)) ORDER BY c.conname)
    FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='commerce'),
  'policies', (SELECT jsonb_agg(jsonb_build_array(tablename,policyname,permissive,cmd,qual) ORDER BY policyname)
    FROM pg_policies WHERE schemaname='commerce'),
  'functions', (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='commerce' AND p.proname='current_store'),
  'rls', (SELECT jsonb_agg(jsonb_build_array(c.relname,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='commerce' AND c.relkind='r')
)::text;
`;
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function runDrill(env=process.env) {
  assertDisposable(env);
  const workDir=fs.mkdtempSync(path.join(os.tmpdir(),'t404-v18614-synthetic-'));
  let sourceCreated=false,restoreCreated=false,roleCreated=false;
  try {
    assert.equal(pg('postgres',`SELECT count(*) FROM pg_roles WHERE rolname='${READER_ROLE}';`,workDir), '0',
      'NO_GO: role from previous or concurrent session already exists');
    pg('postgres',`CREATE ROLE ${READER_ROLE} NOLOGIN;`,workDir); roleCreated=true;
    pg('postgres',`CREATE DATABASE ${DB_SOURCE};`,workDir); sourceCreated=true;
    pg('postgres',`CREATE DATABASE ${DB_RESTORE};`,workDir); restoreCreated=true;
    fs.writeFileSync(path.join(workDir,'fixture.sql'),FIXTURE,{mode:0o600});
    dockerTool('psql',['--no-psqlrc','-X','-q','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-U','postgres',
      '-d',DB_SOURCE,'-f','/work/fixture.sql'],workDir);
    const sourceData=pg(DB_SOURCE,DATA_SNAPSHOT,workDir);
    const sourceSchema=pg(DB_SOURCE,STRUCTURE_SNAPSHOT,workDir);
    assert(sourceData.includes('159000')&&sourceData.includes('189000'));
    assert(sourceSchema.includes('products_store_boundary'));
    dockerTool('pg_dump',['-h','127.0.0.1','-U','postgres','-d',DB_SOURCE,
      '--format=custom','--no-owner','--file=/work/source.dump'],workDir);
    dockerTool('pg_dumpall',['-h','127.0.0.1','-U','postgres','--roles-only',
      '--file=/work/roles.sql'],workDir);
    const backup=fs.readFileSync(path.join(workDir,'source.dump'));
    const roles=fs.readFileSync(path.join(workDir,'roles.sql'),'utf8');
    assert(backup.length>2000,'archive too small');
    assert(roles.includes(READER_ROLE),'role export missing');
    const archiveHash=sha256(backup);
    dockerTool('pg_restore',['-h','127.0.0.1','-U','postgres','-d',DB_RESTORE,
      '--exit-on-error','--no-owner','/work/source.dump'],workDir);
    assert.equal(sha256(fs.readFileSync(path.join(workDir,'source.dump'))),archiveHash);
    const restoredData=pg(DB_RESTORE,DATA_SNAPSHOT,workDir);
    const restoredSchema=pg(DB_RESTORE,STRUCTURE_SNAPSHOT,workDir);
    assert.equal(sha256(restoredData),sha256(sourceData),'data digest differs');
    assert.equal(sha256(restoredSchema),sha256(sourceSchema),'schema, RLS or FK digest differs');
    const rls=pg(DB_RESTORE,`BEGIN;SET LOCAL ROLE ${READER_ROLE};
      SELECT set_config('t404.tenant_id','TENANT_1',true);
      SELECT set_config('t404.store_id','STORE_A',true);
      SELECT CASE WHEN count(*)=1 AND min(price_vnd)=159000 AND min(store_id)='STORE_A'
       THEN 'PASS_A' ELSE 'FAIL_A' END FROM commerce.products;
      SELECT set_config('t404.store_id','STORE_B',true);
      SELECT CASE WHEN count(*)=1 AND min(price_vnd)=189000 AND min(store_id)='STORE_B'
       THEN 'PASS_B' ELSE 'FAIL_B' END FROM commerce.products;
      ROLLBACK;`,workDir);
    assert(rls.includes('PASS_A') && rls.includes('PASS_B') && !rls.includes('FAIL_A') && !rls.includes('FAIL_B'),
      'restored RLS did not isolate store');
    pg(DB_RESTORE,`DO $$ BEGIN
      BEGIN
       INSERT INTO commerce.order_items VALUES ('ILLEGAL_1','TENANT_1','STORE_B','ORDER_A','SKU-001',1);
       RAISE EXCEPTION 'UNSCOPED_ORDER_FK_ACCEPTED';
      EXCEPTION WHEN foreign_key_violation THEN NULL; END;
      BEGIN
       INSERT INTO commerce.order_items VALUES ('ILLEGAL_2','TENANT_1','STORE_A','ORDER_A','MISSING_SKU',1);
       RAISE EXCEPTION 'UNSCOPED_PRODUCT_FK_ACCEPTED';
      EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    END $$;`,workDir);
    assert.equal(pg(DB_RESTORE,DATA_SNAPSHOT,workDir),sourceData,'negative FK test changed rows');
    return Object.freeze({version:'V18.6.14',environment:'DISPOSABLE_PG17_GITHUB_ACTIONS_ONLY',
      backupFormat:'PG_DUMP_CUSTOM',restoreTarget:'SEPARATE_DISPOSABLE_DB_SAME_EPHEMERAL_CLUSTER',
      archiveBytes:backup.length,archiveSha256:archiveHash,rolesFilePresent:true,
      equalDataSnapshot:true,equalConstraintsAndRls:true,restoredStoreBoundaryA:true,
      restoredStoreBoundaryB:true,compositeCrossStoreFkDenied:true,realBackupDone:false,
      realRestoreDone:false,productionReady:false,outsideScope:OUTSIDE_SCOPE});
  } finally {
    if(restoreCreated) try {pg('postgres',`DROP DATABASE IF EXISTS ${DB_RESTORE} WITH (FORCE);`,workDir);}catch{}
    if(sourceCreated) try {pg('postgres',`DROP DATABASE IF EXISTS ${DB_SOURCE} WITH (FORCE);`,workDir);}catch{}
    if(roleCreated) try {pg('postgres',`DROP ROLE IF EXISTS ${READER_ROLE};`,workDir);}catch{}
    fs.rmSync(workDir,{force:true,recursive:true});
  }
}
if(require.main===module) {
  try { console.log(JSON.stringify(runDrill(),null,2)); }
  catch(e) { console.error('DISPOSABLE_RESTORE_NO_GO:',e.message?.replace(/postgresql:\/\/[^\s]+/g,'[REDACTED]')||'Unknown');process.exitCode=1; }
}
module.exports={DB_SOURCE,DB_RESTORE,READER_ROLE,REQUIRED_ENV,BANNED_ENV,OUTSIDE_SCOPE,
  FIXTURE,DATA_SNAPSHOT,STRUCTURE_SNAPSHOT,assertDisposable,sha256,runDrill};
