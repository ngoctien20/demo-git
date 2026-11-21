import assert from 'node:assert/strict';
import {noHosted,validateLocalStatus,verifyRows} from './local-real-auth-uat.mjs';

let pass=0;const same=(v,w,k)=>{assert.deepEqual(v,w,k);pass++};
const key='local_fake_anon_key_for_unit_test_only';
const safe={API_URL:'http://127.0.0.1:54321',DB_URL:'postgresql://postgres:postgres@127.0.0.1:54322/postgres',ANON_KEY:key};
same(noHosted(safe.API_URL),true,'loopback API allowed');
same(noHosted(safe.DB_URL),true,'loopback DB allowed');
same(noHosted('https://ifxlvrhyjhbzbrkdsida.supabase.co'),false,'real staging prohibited');
same(noHosted('https://svxkwpmxgnfvewzwsbdt.supabase.co'),false,'personal BIO prohibited');
same(noHosted('https://127.0.0.1.evil.example'),false,'lookalike denied');
same(noHosted('http://localhost.evil.local'),false,'host trick denied');
same(noHosted('https://example.com'),false,'arbitrary network denied');
same(noHosted('oops'),false,'non URL denied');
same(validateLocalStatus(safe).url,safe.API_URL,'safe API');
same(validateLocalStatus(safe).db,safe.DB_URL,'safe DB');
for(const [k,overrides,msg] of [
 ['hostedapi',{API_URL:'https://example.org'},'REFUSE_NON_LOCAL_API'],
 ['hosteddb',{DB_URL:'postgresql://postgres@hosted.example/postgres'},'REFUSE_NON_LOCAL_DATABASE'],
 ['missingkey',{ANON_KEY:''},'PUBLIC_LOCAL_KEY_MISSING'],
 ['secretkey',{ANON_KEY:'sb_secret_local_fake'},'PUBLIC_LOCAL_KEY_MISSING']]){
 const x={...safe,...overrides};assert.throws(()=>validateLocalStatus(x),e=>e.message===msg,k);pass++;
}
const A={sku:'F01',store_code:'A',price_vnd:159000,stock_on_hand:5,fixture_tag:'SYNTHETIC_V1989'};
const B={...A,store_code:'B',price_vnd:189000,stock_on_hand:9};
const row=(t,s,v,expected,name)=>{same(verifyRows(t,s,v),expected,name)};
row('products','A',[A],true,'A product');
row('products','B',[B],true,'B product');
row('products','A',[B],false,'A cannot accept B');
row('products','B',[A],false,'B cannot accept A');
row('products','A',[],false,'empty is not success');
row('products','A',[A,B],false,'combined stores denied');
row('products','A',[{...A,price_vnd:189000}],false,'wrong A price');
row('products','B',[{...B,stock_on_hand:-1}],false,'wrong B stock');
row('products','A',[{...A,fixture_tag:'REAL_DATA'}],false,'real rows forbidden');
row('products','A',[null],false,'missing row');
for(const table of ['customers','orders','order_items','conversations','messages']){
 const key={customers:'customer_ref',orders:'order_ref',order_items:'line_ref',
  conversations:'conversation_ref',messages:'message_ref'}[table];
 row(table,'A',[{store_code:'A',fixture_tag:'SYNTHETIC_V1989',[key]:'V1989_A_01'}],
  true,table+' own A');
 row(table,'A',[{store_code:'B',fixture_tag:'SYNTHETIC_V1989',[key]:'V1989_B_01'}],
  false,table+' foreign B');
}
same(verifyRows('payments','A',[A]),false,'no payment table');
same(verifyRows('orders','admin',[A]),false,'role injection');
console.log('V1989_DOCKER_UAT_SAFETY_TESTS_PASS='+pass);
console.log('V1989_REAL_LOCAL_JWT_EXECUTED=false');
