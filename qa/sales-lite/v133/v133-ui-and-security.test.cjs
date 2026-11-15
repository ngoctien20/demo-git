'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStaffGate}=require('./staff-guard.cjs');
const {createSupportReadOnlyService}=require('./support-contract.cjs');
const {expiryView}=require('./subscription-expiry.cjs');
const fs=require('node:fs'),path=require('node:path');
const now=Date.parse('2026-11-15T00:00:00Z'),future=now+3600000;
function staff(c={},g={}){
 return createStaffGate({clock:()=>now,verifyAccessJwt:async()=>({
 source:'CLOUDFLARE_ACCESS_JWT_VERIFIED',signatureValid:true,audienceValid:true,expiresAt:future,subject:'staff-0001',...c}),
 readCurrentStaffGrant:async()=>({serverVerified:true,active:true,subject:'staff-0001',role:'TIEN404_QA',expiresAt:future,...g})});
}
test('staff valid access JWT+grant allowed in memory',async()=>assert.equal(await staff().authorize({}),true));
test('staff rejects unsigned identity',async()=>assert.equal(await staff({signatureValid:false}).authorize({}),false));
test('staff rejects wrong audience',async()=>assert.equal(await staff({audienceValid:false}).authorize({}),false));
test('staff rejects revoked grant',async()=>assert.equal(await staff({}, {active:false}).authorize({}),false));
test('staff rejects merchant role',async()=>assert.equal(await staff({}, {role:'OWNER'}).authorize({}),false));
test('staff rejects expired Access token',async()=>assert.equal(await staff({expiresAt:now-1}).authorize({}),false));
test('staff rejects mismatched subject even with staff role',async()=>assert.equal(await staff({}, {subject:'staff-other'}).authorize({}),false));
test('staff guard does not invoke next if denied',async()=>{let called=0;const x=await staff({}, {active:false}).handle({},()=>{called++;return {status:200}});assert.equal(x.status,403);assert.equal(called,0);});
const ctx={source:'BACKEND_AUTHENTICATED_CONTEXT',isVerified:true,tenantId:'tenant-A',storeId:'store-A',
 scopeKey:'owner-A',actorRole:'OWNER',permissions:['support:read_shop']};
const support=(overrides={})=>createSupportReadOnlyService({verifyRequester:async()=>({...ctx,...overrides}),
 readTicket:async req=>({...req,verified:true,ticketId:req.ticketId,requesterKey:req.actorKey,status:'OPEN',category:'BOT_CONNECTIVITY'})});
test('support ticket draft never writes',async()=>{const r=await support().draft({},'BOT_CONNECTIVITY');assert.equal(r.status,'SUPPORT_TICKET_DRAFT_ONLY');assert.equal(r.ticketId,null);});
test('support ticket read verifies scope',async()=>{const r=await support().getTicket({},'TK-123456');assert.equal(r.status,'OPEN');assert.equal(r.ticketsWritten,0);});
test('support Customer cannot read merchant tickets',async()=>{await assert.rejects(()=>support({actorRole:'CUSTOMER'}).getTicket({},'TK-123456'),/SUPPORT_AUTH_REQUIRED/);});
test('support denies unverified actor',async()=>{await assert.rejects(()=>support({isVerified:false}).getTicket({},'TK-123456'),/SUPPORT_AUTH_REQUIRED/);});
test('expiry view respects backend ACTIVE without auto renewal',()=>{const r=expiryView({state:'ACTIVE',expiresAt:new Date(now+3*86400000).toISOString()},now);assert.equal(r.remainingDays,3);assert.equal(r.proposedAlertMilestone,7);assert.equal(r.subscriptionUpdated,false);assert.equal(r.notificationSent,false);});
test('expiry unknown does not fabricate remaining days',()=>{const r=expiryView({state:'UNKNOWN',expiresAt:null},now);assert.equal(r.remainingDays,null);});
test('expiry expired does not claim payment',()=>{const r=expiryView({state:'EXPIRED',expiresAt:new Date(now-86400000).toISOString()},now);assert.equal(r.state,'EXPIRED');assert.match(r.hint,/Không tự gia hạn/);});
test('V13.3 Studio uses official st rather than legacy type',()=>{const c=fs.readFileSync(path.join(__dirname,'studio/app.js'),'utf8');assert.match(c,/st:\[style\]/);assert.doesNotMatch(c,/\{start,len,type:/);});
test('V13.3 Merchant defaults to live API no silent fixture fallback',()=>{const c=fs.readFileSync(path.join(__dirname,'account/app.js'),'utf8'),h=fs.readFileSync(path.join(__dirname,'account/index.html'),'utf8');assert.match(c,/fetch\('\/api\/sales-lite\/me'/);assert.match(h,/<option value="live">/);assert.match(c,/Không dùng dữ liệu mẫu thay thế/);});
test('Studio versioning comparison and REVIEW gate are memory-only',()=>{const c=fs.readFileSync(path.join(__dirname,'studio/app.js'),'utf8');assert.match(c,/draftDiff/);assert.match(c,/releaseState='REVIEW'/);assert.doesNotMatch(c,/localStorage|sessionStorage|sendMessage\s*\(/);});
test('Merchant/studio assets share existing design system',()=>{for(const v of ['studio','account']){const h=fs.readFileSync(path.join(__dirname,v,'index.html'),'utf8');assert.match(h,/\.\.\/\.\.\/v132\/design-system\.css/);}});
