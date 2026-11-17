/** RPC17.2: SQLite-backed Durable Object replay/rate gate. PRIVATE LOCAL RUNTIME QA ONLY.
 * Public Worker intentionally returns 404. DO is only reachable via test namespace binding.
 * No R2, scanner network, upload, customer data, or provider sends.
 */
const ID=/^[A-Za-z0-9_-]{3,128}$/;
const deny=(reason)=>({ok:false,reason});
export class Rpc172ReplayLedger {
  constructor(state,env){
    this.state=state;
    this.state.blockConcurrencyWhile(async()=>{
      this.state.storage.sql.exec('CREATE TABLE IF NOT EXISTS claims (nonce TEXT PRIMARY KEY, operator_id TEXT NOT NULL, created_at INTEGER NOT NULL)');
      this.state.storage.sql.exec('CREATE INDEX IF NOT EXISTS claims_operator_window ON claims (operator_id, created_at)');
    });
  }
  async fetch(request){
    if(request.method!=='POST'||new URL(request.url).pathname!=='/internal/claim')return Response.json(deny('NOT_FOUND'),{status:404});
    let packet;
    try{if(Number(request.headers.get('content-length')||0)>2048)return Response.json(deny('TOO_LARGE'),{status:400});packet=await request.json();}
    catch{return Response.json(deny('MALFORMED'),{status:400});}
    if(!packet||!ID.test(packet.nonce)||!ID.test(packet.operator_id)||Object.keys(packet).sort().join(',')!=='nonce,operator_id')
      return Response.json(deny('INVALID'),{status:400});
    // The supplied operator ID is a synthetic local test identity. Hosted caller auth remains NO-GO.
    // One DO instance must be selected from trusted tenant/store authority, never user-supplied names.
    const now=Date.now(),limit=3,windowMs=60000;
    try{
      const outcome=this.state.storage.transactionSync(()=>{
        if(this.state.storage.sql.exec('SELECT 1 AS found FROM claims WHERE nonce=? LIMIT 1',packet.nonce).toArray().length)return deny('REPLAY');
        const rows=this.state.storage.sql.exec('SELECT COUNT(*) AS n FROM claims WHERE operator_id=? AND created_at>?',packet.operator_id,now-windowMs).toArray();
        if(Number(rows[0]?.n||0)>=limit)return deny('RATE_LIMIT');
        this.state.storage.sql.exec('INSERT INTO claims(nonce,operator_id,created_at) VALUES(?,?,?)',packet.nonce,packet.operator_id,now);
        return {ok:true,reason:'LOCAL_SQLITE_COMMIT_ONLY'};
      });
      return Response.json(outcome,{status:outcome.ok?200:409});
    }catch{return Response.json(deny('STORAGE_UNAVAILABLE'),{status:503});}
  }
}
export default {
  async fetch(_request,_env){return new Response(null,{status:404,headers:{'cache-control':'no-store, private','x-content-type-options':'nosniff'}});}
};
