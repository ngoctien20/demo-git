/**
 * V18.3.6Q — one PUBLIC-fixture signed statement to race across 2 real
 * PostgreSQL connections. Does NOT contact GoTrue or a real Supabase project.
 */
import {signPublicQaFixture} from './rpc-proof-fixture.mjs';
const u=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const x={sessionId:u(112),userId:u(212),tenantId:u(301),storeId:u(402),
 revision:1,itemId:u(502),jti:u(9720),
 expiresEpoch:Math.floor(Date.now()/1000)+75};
const mac=signPublicQaFixture(x).macHex;
process.stdout.write(
 'SET ROLE tien404_q_rpc_caller;\n'+
 "SELECT decision FROM qa_q_private.signed_catalog_read("+
 [x.sessionId,x.userId,x.tenantId,x.storeId,x.revision,x.itemId,
   x.jti,x.expiresEpoch,mac]
 .map((s,i)=>i===4||i===7?String(s):"'"+s+"'").join(',')+
 ");\n"
);
