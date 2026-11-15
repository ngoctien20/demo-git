// V13.6 — safe evidence validation for TWO real authenticated staging sessions.
// No live calls, no session handling, no bypass of Supabase Auth/RLS.
export const RENDER_AUTH_ORIGIN='https://tien404-auth-staging.onrender.com';
export const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
export function checkConfig({origin,tenantA,tenantB,stateA,stateB}={}){
 if(origin!==RENDER_AUTH_ORIGIN)fail('WRONG_HOST');
 if(!UUID_RE.test(tenantA||'')||!UUID_RE.test(tenantB||'')||tenantA===tenantB)fail('TENANT_IDS_INVALID');
 if(typeof stateA!=='string'||typeof stateB!=='string'||!stateA.startsWith('/')||!stateB.startsWith('/')||
    stateA===stateB)fail('ISOLATED_STATE_FILES_REQUIRED');
 return Object.freeze({origin,tenantA,tenantB});
}
export function checkUserEvidence(x,label){
 // x is returned from an authenticated browser only; never retain actual JWT or user data.
 if(!x||x.authenticated!==true||x.userIdentityVerified!==true)fail(label+'_AUTH_UNVERIFIED');
 if(x.memberOfOwn!==true||x.memberOfOther!==false)fail(label+'_MEMBERSHIP_SCOPE_DENIED');
 if(x.selfOrdersError!==false||x.otherOrdersError!==false)fail(label+'_QUERY_UNVERIFIED');
 if(!Number.isInteger(x.selfOrderCount)||x.selfOrderCount<1)fail(label+'_POSITIVE_FIXTURE_MISSING');
 if(x.otherOrderCount!==0||x.otherTenantVisible!==false)fail(label+'_CROSS_TENANT_LEAK');
 if(x.uiProtectedVisible!==true)fail(label+'_PORTAL_NOT_AUTHENTICATED');
 if(x.mutatingRestRequests!==0)fail(label+'_UNEXPECTED_WRITE');
 return Object.freeze({shop:label,passed:true,checked:["AUTH","OWN_MEMBERSHIP","OWN_ORDERS","FOREIGN_ORDERS_DENIED","FOREIGN_TENANT_DENIED","READ_ONLY"]});
}
export function checkAnonymousEvidence(x){
 if(!x||x.uiProtectedVisible!==false||x.orderRowsVisible!==0||x.mutatingRestRequests!==0)
    fail('ANON_ACCESS_RISK');
 return Object.freeze({anonymous:true,passed:true});
}
