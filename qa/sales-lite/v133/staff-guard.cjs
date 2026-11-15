'use strict';
// V13.3 Staff-only gate: isolated contract, NOT an attached Cloudflare Access policy.
// Real edge must validate Access JWT signature/audience/expiry AND backend staff grant each request.
const ROLES=new Set(['TIEN404_ADMIN','TIEN404_ENGINEER','TIEN404_QA','TIEN404_SUPPORT']);
function createStaffGate({verifyAccessJwt,readCurrentStaffGrant,clock=Date.now}={}){
 if(typeof verifyAccessJwt!=='function'||typeof readCurrentStaffGrant!=='function')throw Error('STAFF_SECURITY_PORTS_REQUIRED');
 async function authorize(request){
  let claim;try{claim=await verifyAccessJwt(request);}catch{return false;}
  if(!claim||claim.source!=='CLOUDFLARE_ACCESS_JWT_VERIFIED'||claim.signatureValid!==true||
     claim.audienceValid!==true||!Number.isFinite(claim.expiresAt)||claim.expiresAt<=clock()||
     typeof claim.subject!=='string'||claim.subject.length<5)return false;
  let staff;try{staff=await readCurrentStaffGrant({subject:claim.subject});}catch{return false;}
  return !!(staff?.serverVerified===true&&staff.active===true&&staff.subject===claim.subject&&ROLES.has(staff.role)&&
    Number.isFinite(staff.expiresAt)&&staff.expiresAt>clock());
 }
 async function handle(request,next){
  if(!(await authorize(request)))return {status:403,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'},body:'Access denied'};
  if(typeof next!=='function')return {status:500,body:'Handler missing'};
  return next(request);
 }
 return Object.freeze({authorize,handle,mode:'NOT_CONNECTED_AUDIT_REQUIRED'});
}
module.exports={createStaffGate};
