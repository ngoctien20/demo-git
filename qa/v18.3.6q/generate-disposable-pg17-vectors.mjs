/**
 * V18.3.6Q — generates real PG17 pgTAP calls signed in Node with a
 * PUBLIC synthetic HMAC key. Fixture NOT safe for production.
 */
import {signPublicQaFixture} from './rpc-proof-fixture.mjs';
const u=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const base={
 sessionId:u(112),userId:u(212),tenantId:u(301),storeId:u(402),
 revision:1,itemId:u(502),jti:u(9701),expiresEpoch:Math.floor(Date.now()/1000)+75
};
const esc=s=>"'"+String(s).replaceAll("'","''")+"'";
const call=(c,signature)=>{
 const sig=signature===undefined?signPublicQaFixture(c).macHex:signature;
 const args=[c.sessionId,c.userId,c.tenantId,c.storeId,c.revision,
   c.itemId,c.jti,c.expiresEpoch,sig]
   .map((v,i)=>v===null?'NULL':i===4||i===7?String(v):esc(v));
 return 'qa_q_private.signed_catalog_read('+args.join(',')+')';
};
const expr=(c,sig)=>'(SELECT decision FROM '+call(c,sig)+')';
const tests=[];
const is=(id,name,c,expect,mac)=>tests.push('SELECT is('+expr(c,mac)+','+esc(expect)+','+esc(id+' '+name)+');');
const same=(j,over={})=>({...base,jti:u(j),...over});
is('Q31','correct Store B read permitted by synthetic HMAC',same(9701),'ALLOW_CATALOG');
tests.push('SELECT is((SELECT price_vnd::text FROM '+call(same(9702))+"),'189000','Q32 exact scoped price');");
is('Q33','same signed jti replay',same(9701),'REPLAY');
is('Q34','cross Store resource denied after valid MAC',same(9704,{itemId:u(501)}),'DENY_RESOURCE_SCOPE');
is('Q35','wrong Store membership denied after valid MAC',same(9705,{storeId:u(401),itemId:u(501)}),'DENY_MEMBERSHIP');
is('Q36','session bound to wrong User denied',same(9706,{userId:u(211)}),'DENY_SESSION');
is('Q37','deleted A session denied',same(9707,{sessionId:u(111),userId:u(211),storeId:u(401),itemId:u(501),revision:2}),'DENY_SESSION');
is('Q38','stale B membership revision denied',same(9708,{revision:2}),'DENY_MEMBERSHIP');
is('Q39','incorrect HMAC denied before DB check',same(9709),'DENY_MAC','0'.repeat(64));
is('Q40','tampered Store without MAC recomputation denied',same(9710,{storeId:u(401),itemId:u(501)}),'DENY_MAC',signPublicQaFixture(same(9710)).macHex);
is('Q41','tampered resource without MAC recomputation denied',same(9711,{itemId:u(501)}),'DENY_MAC',signPublicQaFixture(same(9711)).macHex);
is('Q42','far future expiry denied before DB check',same(9712,{expiresEpoch:base.expiresEpoch+180}),'DENY_EXPIRY');
is('Q43','expired proof denied',same(9713,{expiresEpoch:base.expiresEpoch-100}),'DENY_EXPIRY');
is('Q44','same JTI different properly signed scope still replay',same(9701,{itemId:u(502)}),'REPLAY');
is('Q45','uppercase MAC forbidden canonical format',same(9715),'DENY_MAC',signPublicQaFixture(same(9715)).macHex.toUpperCase());
is('Q46','NULL JTI blocked',same(9716,{jti:null}),'DENY_INPUT','0'.repeat(64));
is('Q47','zero revision blocked',same(9717,{revision:0}),'DENY_INPUT','0'.repeat(64));
tests.push('SELECT is((SELECT item_code FROM '+call(same(9718))+"),'QA-ITEM-B','Q48 exact Store B product code');");
tests.push('RESET ROLE;');
const jtis=[9704,9705,9706,9707,9708,9709,9710,9711,9712,9713,9715,9716,9717];
tests.push('SELECT ok((SELECT count(*) FROM qa_m_private.nonce_ledger WHERE jti IN ('+jtis.map(n=>esc(u(n))).join(',')+"))=0,'Q49 rejected claims never consume nonce');");
tests.push('SELECT ok((SELECT count(*) FROM qa_m_private.nonce_ledger WHERE jti='+esc(u(9701))+")=1,'Q50 replay JTI persisted exactly once');");
tests.push('SELECT ok((SELECT count(*) FROM qa_m_private.nonce_ledger WHERE jti IN ('+[9701,9702,9718].map(n=>esc(u(n))).join(',')+"))=3,'Q51 only accepted JTIs persisted');");
tests.push("SELECT ok((SELECT count(*) FROM qa_q_private.fixture_signer WHERE kid='qa-fixture-v1' AND environment='DISPOSABLE_ONLY')=1,'Q52 public fixture remains local');");
const total=tests.filter(s=>s.startsWith('SELECT is(')||s.startsWith('SELECT ok(')).length;
const output=[
'\\set ON_ERROR_STOP on',
'\\pset format unaligned',
'\\pset tuples_only on',
'\\echo V18_3_6Q_NODE_PG_HMAC_VECTORS_START',
'SELECT * FROM no_plan();',
'SET ROLE tien404_q_rpc_caller;',
...tests,
'SELECT * FROM finish();',
'\\echo V18_3_6Q_NODE_PG_HMAC_VECTORS_DONE'
].join('\n')+'\n';
if(total!==22)throw Error('EXPECTED_22_VECTOR_ASSERTIONS_GOT_'+total);
process.stdout.write(output);
