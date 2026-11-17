// Concise CI regression. The extended 52-case offline QA remains in the local package.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {createRequire} from 'node:module';
import {createHardenedPrivateIntake,MAX_FILE_BYTES,MAX_REQUEST_BYTES,DEPLOYMENT_STATUS} from './hardened-private-intake.mjs';
import {acceptScannerVerdict,assessReviewReadiness,SCAN_STATES} from './scan-review-state.mjs';
const require=createRequire(import.meta.url);
const gate=require('./hosted-readiness.cjs');
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'test-key',use:'sig',alg:'RS256'};
const iss='https://merchant-qa.cloudflareaccess.com',aud='merchant-qa-intake';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const p=enc({alg:'RS256',kid:jwk.kid})+'.'+enc({iss,aud,sub:'qa-subject',email:'qa@example.com',iat:Math.floor(Date.now()/1000)-20,exp:Math.floor(Date.now()/1000)+500});
const access=p+'.'+createSign('RSA-SHA256').update(p).sign(privateKey,'base64url');
const token='zz.'+'x'.repeat(150)+'.yy';
const id='aaaaaaaa-0000-4000-8000-000000000001';
const sourceType='MERCHANT_ORIGINAL_CATALOG';
const admission={enabled:true,accessAppIndependent:true,storagePrivate:true,durableReplayReady:true,rateLimitReady:true,scannerReady:true,retentionApproved:true,operatorApproved:true,independentReviewerReady:true};
function fixture(){const writes=[];let consumed=false;
 return {writes,params:{admission:{...admission},identityConfig:{teamDomain:iss,audience:aud,supabaseUrl:'https://ifxlvrhyjhbzbrkdsida.supabase.co',publishableKey:'public-safe-publishable-key'},fetcher:async url=>url.endsWith('/certs')?new Response(JSON.stringify({keys:[jwk]})):new Response(JSON.stringify({id,email:'qa@example.com',role:'authenticated',email_confirmed_at:'2026-01-01'})),rateLimit:{admit:async()=>true},authority:{getInvitation:async()=>({id:'i',authUserId:id,accessSubject:'qa-subject',slot:'P1',sourceType,status:'ISSUED',operatorSourceVerified:true,expiresAt:Date.now()+10000}),reserveOnce:async()=>{if(consumed)return false;consumed=true;return true},finalize:async x=>{writes.push(x);return true},markFailed:async x=>{writes.push(x)}},quarantine:{put:async(k,b,o)=>writes.push({k,n:b.byteLength,o})}}};}
const pdf='%PDF-1.7\n'+'Q'.repeat(64)+'\n%%EOF\n';
function req({slot='P1',sourceType='MERCHANT_ORIGINAL_CATALOG',content=pdf,headers={}}={}){const f=new FormData();f.set('slot',slot);f.set('source_type',sourceType);f.set('source',new Blob([content],{type:'application/pdf'}),'qa.pdf');return new Request('https://qa.example/v2/private/evidence',{method:'POST',headers:{'cf-access-jwt-assertion':access,authorization:'Bearer '+token,...headers},body:f});}
test('code is source-only',()=>assert.equal(DEPLOYMENT_STATUS,'SOURCE_ONLY_NOT_DEPLOYED'));
test('guards reject unconfigured delivery',async()=>{const {params}=fixture();params.admission.enabled=false;assert.equal((await createHardenedPrivateIntake(params)(req())).status,503)});
for(const key of ['accessAppIndependent','storagePrivate','durableReplayReady','scannerReady','independentReviewerReady'])test('mandatory host guard '+key,async()=>{const {params}=fixture();params.admission[key]=false;assert.equal((await createHardenedPrivateIntake(params)(req())).status,503)});
test('global byte ceiling is bounded',()=>assert.equal(MAX_REQUEST_BYTES,MAX_FILE_BYTES+65536));
test('declared over-limit body is denied',async()=>{const {params}=fixture();assert.equal((await createHardenedPrivateIntake(params)(req({headers:{'content-length':String(MAX_REQUEST_BYTES+1)}}))).status,413)});
test('verified synthetic merchant proof goes to quarantine only',async()=>{const {params,writes}=fixture();const r=await createHardenedPrivateIntake(params)(req());assert.equal(r.status,202);assert.equal((await r.json()).status,'QUARANTINED_PENDING_SCAN');assert.equal(writes.at(-1).state,'PENDING_MALWARE_SCAN')});
test('single use invite rejects replay',async()=>{const {params}=fixture();const intake=createHardenedPrivateIntake(params);assert.equal((await intake(req())).status,202);assert.equal((await intake(req())).status,409)});
test('source type mismatched to invitation denied',async()=>{const {params}=fixture();assert.equal((await createHardenedPrivateIntake(params)(req({sourceType:'VERIFIED_MERCHANT_EXPORT'}))).status,403)});
test('wrong source slot denied',async()=>{const {params}=fixture();assert.equal((await createHardenedPrivateIntake(params)(req({slot:'O1'}))).status,403)});
test('truncated source rejected',async()=>{const {params}=fixture();assert.equal((await createHardenedPrivateIntake(params)(req({content:pdf.slice(0,-7)}))).status,415)});
test('rate limiter never receives auth header',async()=>{const {params}=fixture();let arg;params.rateLimit.admit=async x=>{arg=x;return true};await createHardenedPrivateIntake(params)(req());assert.equal(Object.keys(arg).join(','),'scope,route,method')});
test('scanner without verified signature cannot transition state',async()=>{const r=await acceptScannerVerdict({receiptId:'11111111-1111-4111-8111-111111111111'});assert.equal(r.accepted,false)});
test('scanner clean still does not approve owner',async()=>{const rid='11111111-1111-4111-8111-111111111111';const r=await acceptScannerVerdict({receiptId:rid,scannerEnvelope:{},scanner:{verifySignature:async()=>({receiptId:rid,sourceSha256:'a'.repeat(64),scannerVersion:'1',verdict:'CLEAN'})},ledger:{transitionFromPending:async()=>true}});assert.equal(r.status,SCAN_STATES.clean);assert.equal(r.canRelease,false)});
test('independent review remains hosted no-go',()=>{const r=assessReviewReadiness({});assert.equal(r.canMigrate,false)});
test('hosted snapshot cannot deploy',()=>{const r=gate.inspect(require('./hosted-baseline-sanitized.json'));assert.equal(r.canDeployUpload,false);assert.equal(r.canRunRealJwtUat,false)});