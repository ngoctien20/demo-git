// Inspect two databases restored within the same *temporary* PostgreSQL cluster.
import pg from 'pg';
import assert from 'node:assert/strict';
const [source, restored] = ['tien404_sales_lite_ephemeral', 'tien404_sales_lite_restored'];
if (
  process.env.TIEN404_LITE_QA !== 'yes' ||
  process.env.PGDATABASE !== source ||
  process.env.PGHOST !== '127.0.0.1'
)
  throw Error('Local QA only');
async function inspect(database) {
  const db = new pg.Client({ database });
  await db.connect();
  try {
    const { rows: tables } =
      await db.query(`SELECT n.nspname AS schema,c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced
      FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
      WHERE c.relkind='r' AND n.nspname IN ('tien404_r1_qa','sales_lite_qa','public') ORDER BY 1,2`);
    const evidence = [];
    for (const t of tables) {
      if (!/^\w+$/.test(t.schema) || !/^\w+$/.test(t.name))
        throw Error('Unexpected name in disposable database');
      const {
        rows: [digest]
      } = await db.query(
        `SELECT count(*)::int AS count,md5(string_agg(row_to_json(x)::text,'|' ORDER BY row_to_json(x)::text)) AS digest FROM ${t.schema}.${t.name} x`
      );
      evidence.push({ ...t, ...digest });
    }
    const { rows: policies } = await db.query(
      "SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('sales_lite_qa','tien404_r1_qa','public') ORDER BY 1,2,3"
    );
    return { evidence, policies };
  } finally {
    await db.end();
  }
}
const a = await inspect(source),
  b = await inspect(restored);
assert.deepEqual(a, b);
assert.equal(a.evidence.length, 16);
assert.ok(a.evidence.every((x) => x.rls && x.forced));
assert.ok(a.evidence.find((x) => x.name === 'owner_alerts').count >= 40);
assert.equal(a.policies.length, 32);
console.log(
  'PASS · recovered ' +
    a.evidence.length +
    ' tables, 32 scope policies; row counts, ordered content digests and RLS flags match.'
);
