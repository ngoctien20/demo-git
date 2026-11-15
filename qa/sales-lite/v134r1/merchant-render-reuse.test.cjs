'use strict';const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../v133/account/index.html'),'utf8');
const root='https://tien404-auth-staging.onrender.com/merchant-portal.html';
test('existing Merchant Portal is reused without duplicating customer/order UI',()=>{
 assert.match(html,/id="existingMerchantPortalLink"/);
 assert.ok(html.includes('href="'+root+'"'));
 assert.match(html,/Quản lý khách hàng và đơn hàng/);
});
test('Render redirect never includes session, role or tenant parameters',()=>{
 const match=html.match(/<a id="existingMerchantPortalLink"[^>]+>/);
 assert.ok(match);
 const href=match[0].match(/href="([^"]+)"/)?.[1];
 assert.ok(href);const u=new URL(href);
 assert.equal(u.origin,'https://tien404-auth-staging.onrender.com');
 assert.equal(u.pathname,'/merchant-portal.html');assert.equal(u.search,'');assert.equal(u.hash,'');
 assert.match(match[0],/target="_blank"/);assert.match(match[0],/rel="noopener noreferrer"/);
});
test('UI stays clear about real membership and no automatic authorization',()=>{
 assert.match(html,/không tự cấp quyền truy cập/i);
 assert.match(html,/chưa xác nhận hosted A\/B E2E/i);
});
test('No token bridge, callback forwarding or eager remote request',()=>{
 assert.doesNotMatch(html,/oauth\/callback\?|access_token=|refresh_token=|\?tenant_id=|\?role=/);
});
