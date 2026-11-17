// RPC13 — Cloudflare Access JWT + Supabase Auth verified user, NO deployment.
// Never accept an email header, raw JWT claim or caller-supplied tenant/store as authority.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reject(reason='ACCESS_DENIED'){const e=new Error(reason);e.code=reason;throw e;}
function b64u(s){if(!/^[A-Za-z0-9_-]+$/.test(s))reject('INVALID_JWT_ENCODING');const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
function jsonPart(s){try{return JSON.parse(new TextDecoder().decode(b64u(s)));}catch{reject('INVALID_JWT_PART');}}
function normalizeEmail(s){if(typeof s!=='string'||s.length>254||!/^\S+@\S+\.\S+$/.test(s))reject('INVALID_EMAIL');return s.trim().toLowerCase();}
function accessHost(teamDomain){const u=new URL(teamDomain);if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/'||!u.hostname.endsWith('.cloudflareaccess.com'))reject('INVALID_ACCESS_ISSUER');return u.origin;}
export async function verifyAccessToken(token,{teamDomain,audience,fetcher=fetch,now=Math.floor(Date.now()/1000)}){
 if(typeof audience!=='string'||audience.length<12||typeof token!=='string'||token.length>14000)reject('ACCESS_CONFIGURATION');
 const parts=token.split('.');if(parts.length!==3)reject('INVALID_JWT');
 const [a,b,c]=parts,header=jsonPart(a),payload=jsonPart(b);
 if(header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid||header.jku||header.jwk||header.x5u)reject('UNSAFE_ACCESS_JWT_ALGORITHM');
 const issuer=accessHost(teamDomain);
 if(payload.iss!==issuer||!(Array.isArray(payload.aud)?payload.aud.includes(audience):payload.aud===audience)||
    !Number.isInteger(payload.exp)||payload.exp<=now||payload.exp>now+172800||
    (payload.nbf!==undefined&&payload.nbf>now+60)||
    (payload.iat!==undefined&&payload.iat>now+60)||
    typeof payload.sub!=='string'||!payload.sub)reject('ACCESS_JWT_CLAIMS_DENIED');
 const endpoint=issuer+'/cdn-cgi/access/certs';
 const r=await fetcher(endpoint,{method:'GET',redirect:'error',cache:'no-store'});
 if(!r.ok)reject('ACCESS_JWKS_UNAVAILABLE');
 const j=await r.json();if(!Array.isArray(j.keys))reject('ACCESS_JWKS_INVALID');
 const key=j.keys.find(k=>k.kty==='RSA'&&k.kid===header.kid&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
 if(!key)reject('ACCESS_SIGNING_KEY_NOT_FOUND');
 const cryptoKey=await crypto.subtle.importKey('jwk',key,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const verified=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',cryptoKey,b64u(c),new TextEncoder().encode(a+'.'+b));
 if(!verified)reject('ACCESS_SIGNATURE_INVALID');
 return Object.freeze({accessSubject:payload.sub,email:normalizeEmail(payload.email)});
}
export async function verifySupabaseUser(token,{supabaseUrl,publishableKey,fetcher=fetch}){
 if(typeof token!=='string'||token.length<100||token.length>10000||!/^[A-Za-z0-9._-]+$/.test(token))reject('AUTH_BEARER_MISSING');
 const u=new URL(supabaseUrl);
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.origin!=='https://ifxlvrhyjhbzbrkdsida.supabase.co')reject('SUPABASE_ORIGIN_DENIED');
 if(typeof publishableKey!=='string'||publishableKey.length<10)reject('PUBLISHABLE_KEY_MISSING');
 const r=await fetcher(u.origin+'/auth/v1/user',{method:'GET',redirect:'error',cache:'no-store',headers:{apikey:publishableKey,authorization:'Bearer '+token}});
 if(!r.ok)reject('SUPABASE_USER_TOKEN_INVALID');
 const user=await r.json();
 if(!UUID.test(user.id)||user.role!=='authenticated'||user.is_anonymous===true||!user.email_confirmed_at)reject('SUPABASE_USER_UNQUALIFIED');
 return Object.freeze({userId:user.id,email:normalizeEmail(user.email)});
}
export async function requireDualIdentity(request,options){
 const access=await verifyAccessToken(request.headers.get('cf-access-jwt-assertion'),options);
 const a=request.headers.get('authorization');if(!a||!/^Bearer \S+$/i.test(a))reject('AUTH_BEARER_MISSING');
 const user=await verifySupabaseUser(a.slice(7),options);
 if(access.email!==user.email)reject('TWO_IDENTITY_EMAIL_MISMATCH');
 return Object.freeze({accessSubject:access.accessSubject,authUserId:user.userId});
}