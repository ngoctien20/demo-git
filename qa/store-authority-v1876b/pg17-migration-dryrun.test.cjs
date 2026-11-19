"use strict";
// PG17 disposable QA only. Synthetic SET LOCAL request.jwt.claim.sub is NOT a verified JWT.
const {test,before}=require("node:test");
const a=require("node:assert/strict");
const {spawnSync}=require("node:child_process");
const path=require("node:path");
const S="v1876b_qa",ROOT=__dirname;
const users={a:"30000000-0000-4000-8000-000000000001",b:"30000000-0000-4000-8000-000000000002",c:"30000000-0000-4000-8000-000000000003",staff:"30000000-0000-4000-8000-000000000004",revoked:"30000000-0000-4000-8000-000000000005"};
const ta="10000000-0000-4000-8000-000000000001",sa="20000000-0000-4000-8000-000000000001",sc="20000000-0000-4000-8000-000000000003";
function psql(sql,file){
 const args=["-X","-q","-A","-t","-v","ON_ERROR_STOP=1"];
 if(file)args.push("-f",path.join(ROOT,file));else args.push("-c",sql);
 const r=spawnSync("psql",args,{encoding:"utf8",timeout:15000,env:{...process.env,PGHOST:"127.0.0.1",PGPORT:"5432",PGUSER:"postgres",PGDATABASE:"tien404_v1876b_qa",PGPASSWORD:"v1876b-disposable-test-only"}});
 if(r.error)throw r.error;return {exit:r.status,out:r.stdout.trim(),err:r.stderr.trim()};
}
function actor(who,sql){
 const identity=who===null?"":"SET LOCAL request.jwt.claim.sub = '"+users[who]+"'; ";
 return psql("BEGIN; SET LOCAL ROLE v1876b_authenticated; "+identity+sql+"; ROLLBACK;");
}
function count(who,table,expected){
 const r=actor(who,"SELECT count(*) FROM "+S+"."+table);
 a.equal(r.exit,0,r.err);a.equal(r.out,String(expected),"actor="+who+" table="+table);
}
function error(sql,pattern){
 const r=psql(sql);a.notEqual(r.exit,0,"expected failure");a.match(r.err,pattern,r.err);
}
before(()=>{
 a.equal(process.env.V1876B_DISPOSABLE_POSTGRES,"true","REFUSE non-disposable PG17");
 a.equal(process.env.PGDATABASE,"tien404_v1876b_qa","REFUSE wrong database");
 for(const f of ["fixture-disposable.sql","migration-preview-disposable.sql"]){
  const r=psql(null,f);a.equal(r.exit,0,f+": "+r.err);
 }
});
test("only disposable database is used",()=>a.equal(psql("select current_database()").out,"tien404_v1876b_qa"));
test("all twelve mappings explicitly approved",()=>a.equal(psql("select count(*) from "+S+".store_assignments where approved").out,"12"));
test("migration leaves three legacy source rows intact per table",()=>{
 for(const t of ["legacy_products","legacy_customers","legacy_orders","legacy_order_items"])a.equal(psql("select count(*) from "+S+"."+t).out,"3");
});
test("assignment gate accepts complete approved synthetic fixture",()=>a.equal(psql("select "+S+".assert_explicit_assignments()").out,"t"));
test("missing assignment rejected",()=>error("BEGIN; DELETE FROM "+S+".store_assignments WHERE entity_type='order' AND entity_id='60000000-0000-4000-8000-000000000001'; SELECT "+S+".assert_explicit_assignments(); ROLLBACK;",/UNAPPROVED OR UNMAPPED STORE ROW/));
test("unapproved assignment rejected",()=>error("BEGIN; UPDATE "+S+".store_assignments SET approved=false WHERE entity_type='product' AND entity_id='40000000-0000-4000-8000-000000000001'; SELECT "+S+".assert_explicit_assignments(); ROLLBACK;",/UNAPPROVED OR UNMAPPED STORE ROW/));
test("cross-store item assignment rejected",()=>error("BEGIN; UPDATE "+S+".store_assignments SET store_id='"+sc+"' WHERE entity_type='item' AND entity_id='70000000-0000-4000-8000-000000000001'; SELECT "+S+".assert_explicit_assignments(); ROLLBACK;",/CROSS STORE ORDER ITEM/));
test("cross-store order-customer assignment rejected",()=>error("BEGIN; UPDATE "+S+".store_assignments SET store_id='"+sc+"' WHERE entity_type='order' AND entity_id='60000000-0000-4000-8000-000000000001'; SELECT "+S+".assert_explicit_assignments(); ROLLBACK;",/CROSS STORE ORDER CUSTOMER/));
for(const [user,counts] of Object.entries({
 a:{stores:1,products:2,orders:1,customers:1,order_items:1,page_connections:1},
 c:{stores:1,products:2,orders:1,customers:1,order_items:1,page_connections:1},
 b:{stores:1,products:1,orders:1,customers:1,order_items:1,page_connections:0},
 staff:{stores:1,products:2,orders:0,customers:0,order_items:0,page_connections:0},
 revoked:{stores:0,products:0,orders:0,customers:0,order_items:0,page_connections:0}
})){
 for(const [table,expected] of Object.entries(counts))test(user+" "+table+" Store-level RLS",()=>count(user,table,expected));
}
test("missing principal has no store",()=>count(null,"stores",0));
test("missing principal has no products",()=>count(null,"products",0));
test("owner A same-tenant shared SKU price",()=>{
 const r=actor("a","select price_vnd from "+S+".products where sku='SKU-SHARED'");
 a.equal(r.exit,0,r.err);a.equal(r.out,"12000");
});
test("owner C same-tenant shared SKU price different",()=>{
 const r=actor("c","select price_vnd from "+S+".products where sku='SKU-SHARED'");
 a.equal(r.exit,0,r.err);a.equal(r.out,"14500");
});
test("shared SKU exists in two sibling Stores",()=>a.equal(psql("select count(*) from "+S+".products where sku='SKU-SHARED'").out,"2"));
test("duplicate SKU in same Store blocked",()=>error("INSERT INTO "+S+".products VALUES ('"+ta+"','"+sa+"','40000000-0000-4000-8000-000000000099','SKU-SHARED',1)",/duplicate key value violates unique constraint/));
test("order-item cross-Store product FK blocked",()=>error("INSERT INTO "+S+".order_items VALUES ('"+ta+"','"+sa+"','70000000-0000-4000-8000-000000000099','60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003')",/foreign key constraint/));
test("order cross-Store customer FK blocked",()=>error("INSERT INTO "+S+".orders VALUES ('"+ta+"','"+sa+"','60000000-0000-4000-8000-000000000099','50000000-0000-4000-8000-000000000003')",/foreign key constraint/));
test("Page connection uniqueness blocks takeover",()=>error("INSERT INTO "+S+".page_connections VALUES ('"+ta+"','"+sc+"','messenger','QA-PAGE-A','connected')",/duplicate key value violates unique constraint/));
test("Page reauth uniqueness blocks takeover",()=>error("INSERT INTO "+S+".page_connections VALUES ('"+ta+"','"+sc+"','messenger','QA-PAGE-A','reauthorization_required')",/duplicate key value violates unique constraint/));
test("app role cannot read raw tenant-only products",()=>{
 const r=actor("a","select count(*) from "+S+".legacy_products");
 a.notEqual(r.exit,0);a.match(r.err,/permission denied/);
});
test("app role cannot read untrusted store assignments",()=>{
 const r=actor("a","select count(*) from "+S+".store_assignments");
 a.notEqual(r.exit,0);a.match(r.err,/permission denied/);
});
for(const table of ["products","orders","customers","order_items","page_connections"]){
 test("app role cannot DELETE "+table,()=>{
  const r=actor("a","DELETE FROM "+S+"."+table+" WHERE false");
  a.notEqual(r.exit,0);a.match(r.err,/permission denied/);
 });
}
test("seven sensitive target tables have FORCE RLS",()=>a.equal(psql("SELECT count(*) FROM pg_class WHERE relnamespace='"+S+"'::regnamespace AND relname IN ('stores','store_memberships','products','customers','orders','order_items','page_connections') AND relrowsecurity AND relforcerowsecurity").out,"7"));
test("mock role cannot write stores/products/orders",()=>a.equal(psql("SELECT has_table_privilege('v1876b_authenticated','"+S+".products','INSERT') OR has_table_privilege('v1876b_authenticated','"+S+".orders','UPDATE') OR has_table_privilege('v1876b_authenticated','"+S+".page_connections','DELETE')").out,"f"));
test("migrated original orders/customers/items preserve counts",()=>{
 for(const table of ["orders","customers","order_items"])a.equal(psql("select count(*) from "+S+"."+table).out,"3");
});
test("no real provider or Supabase token in CI",()=>{
 a.equal(process.env.V1876B_DISPOSABLE_POSTGRES,"true");
 a.equal(Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),false);
 a.equal(Boolean(process.env.META_PAGE_ACCESS_TOKEN),false);
});
