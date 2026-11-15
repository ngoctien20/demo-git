'use strict';
// Support read-only contract; status/ID only after backend readback. No ticket persistence.
const {makeSupportTicketCandidate}=require('../v131/business-contracts.cjs');
const fail=c=>{const e=new Error(c);e.code=c;throw e;};
function createSupportReadOnlyService({verifyRequester,readTicket}={}){
 if(typeof verifyRequester!=='function'||typeof readTicket!=='function')fail('SUPPORT_TRUSTED_PORTS_REQUIRED');
 async function draft(request,issueCode){
  const ctx=await verifyRequester(request);
  if(!ctx||ctx.source!=='BACKEND_AUTHENTICATED_CONTEXT'||ctx.isVerified!==true)fail('SUPPORT_AUTH_REQUIRED');
  return makeSupportTicketCandidate({ctx,issueCode}); // never writes
 }
 async function getTicket(request,ticketId){
  const ctx=await verifyRequester(request);
  if(!ctx||ctx.source!=='BACKEND_AUTHENTICATED_CONTEXT'||ctx.isVerified!==true||
    !['OWNER','MANAGER'].includes(ctx.actorRole)||!Array.isArray(ctx.permissions)||
    !ctx.permissions.includes('support:read_shop')||
    typeof ticketId!=='string'||!/^[A-Za-z0-9-]{5,90}$/.test(ticketId))fail('SUPPORT_AUTH_REQUIRED');
  const t=await readTicket({tenantId:ctx.tenantId,storeId:ctx.storeId,actorKey:ctx.scopeKey,ticketId});
  if(!t||t.verified!==true||t.tenantId!==ctx.tenantId||t.storeId!==ctx.storeId||
    t.ticketId!==ticketId||t.requesterKey!==ctx.scopeKey)fail('SUPPORT_TICKET_SCOPE_DENIED');
  return Object.freeze({ticket_id:t.ticketId,category:t.category||'UNKNOWN',priority:t.priority||'UNKNOWN',
    status:t.status||'UNKNOWN',created_at:t.createdAt||null,updated_at:t.updatedAt||null,
    assigned_staff:null,externalSends:0,ticketsWritten:0,readOnly:true});
 }
 return Object.freeze({draft,getTicket,mode:'NO_WRITE_NO_SEND_QA'});
}
module.exports={createSupportReadOnlyService};
