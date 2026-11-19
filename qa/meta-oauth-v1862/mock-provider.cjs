'use strict';
// V18.6.2: OFFLINE SYNTHETIC_QA ONLY. Never calls Meta, n8n, a database, or a provider.
const { randomBytes, createHash, createHmac, timingSafeEqual } = require('node:crypto');
const FLAGS = Object.freeze({ META_OAUTH_MODE:'mock', META_LIVE_API_ENABLED:false, PROVIDER_SEND_ENABLED:false, ORDER_WRITE_ENABLED:false });
const ACTORS = Object.freeze({ 'owner-a': {store:'store-a', pages:['mock-page-a','mock-page-extra']}, 'owner-b': {store:'store-b', pages:['mock-page-b']} });
const PAGES = Object.freeze({
  'mock-page-a':{id:'mock-page-a',name:'Fanpage A (giả lập)',permission:'MESSAGING'},
  'mock-page-extra':{id:'mock-page-extra',name:'Fanpage A2 (giả lập)',permission:'NONE'},
  'mock-page-b':{id:'mock-page-b',name:'Fanpage B (giả lập)',permission:'MESSAGING'},
});
const ERR = (code)=>Object.assign(new Error(code),{code});
const hash=(v)=>createHash('sha256').update(v).digest('hex');
class MockMetaOAuthProvider {
  constructor({now=()=>Date.now(),ttlMs=300000,mode='mock'}={}) {
    if(mode!=='mock') throw ERR('LIVE_MODE_DISABLED');
    this.now=now;this.ttlMs=ttlMs;this.tx=new Map();this.connections=new Map();this.events=[];this.metrics={metaRequests:0,providerSends:0,orderWrites:0};
  }
  authority(context) {
    // SIMULATED ONLY. Real implementation MUST call trusted session + store authority server-side.
    const {actorId,sessionId,storeId}=context||{};
    if(typeof sessionId!=='string'||sessionId.length<8) throw ERR('INVALID_SESSION');
    if(!ACTORS[actorId]||ACTORS[actorId].store!==storeId) throw ERR('STORE_AUTHORITY_DENIED');
    return {actorId,sessionId,storeId};
  }
  start(context) {
    const a=this.authority(context);
    const state=randomBytes(32).toString('base64url');
    this.tx.set(hash(state),{...a,createdAt:this.now(),status:'pending'});
    this.events.push({type:'oauth.started',storeId:a.storeId,qa:'SYNTHETIC_QA'});
    return {mode:'mock',state,expiresInMs:this.ttlMs,qa:'SYNTHETIC_QA'};
  }
  callback({state,decision,sessionId,actorId}={}) {
    if(typeof state!=='string'||!state) throw ERR('INVALID_STATE');
    const key=hash(state),t=this.tx.get(key);
    if(!t) throw ERR('INVALID_OR_REPLAYED_STATE');
    if(t.status!=='pending') throw ERR('INVALID_OR_REPLAYED_STATE');
    if(this.now()-t.createdAt>this.ttlMs){t.status='expired';throw ERR('STATE_EXPIRED');}
    if(t.sessionId!==sessionId||t.actorId!==actorId) throw ERR('SESSION_MISMATCH');
    t.status='used'; // consume BEFORE processing outcome, including denial
    if(decision!=='allow') throw ERR(decision==='deny'?'AUTHORIZATION_DENIED':'INVALID_CALLBACK');
    t.status='authorized';
    return {pages:ACTORS[t.actorId].pages.map(id=>({...PAGES[id],eligible:PAGES[id].permission==='MESSAGING'})),state,qa:'SYNTHETIC_QA'};
  }
  select({state,pageId,context}={}) {
    const a=this.authority(context),t=this.tx.get(hash(String(state||'')));
    if(!t||t.status!=='authorized') throw ERR('OAUTH_NOT_AUTHORIZED');
    if(this.now()-t.createdAt>this.ttlMs){t.status='expired';throw ERR('STATE_EXPIRED');}
    if(t.actorId!==a.actorId||t.sessionId!==a.sessionId||t.storeId!==a.storeId) throw ERR('SESSION_MISMATCH');
    if(!ACTORS[a.actorId].pages.includes(pageId)) throw ERR('PAGE_NOT_AUTHORIZED');
    if(PAGES[pageId]?.permission!=='MESSAGING') throw ERR('PAGE_PERMISSION_MISSING');
    const current=this.connections.get(pageId);
    if(current&&current.status==='connected'&&current.storeId!==a.storeId) throw ERR('PAGE_ALREADY_CONNECTED');
    t.status='completed';
    const item={connectionId:`qa-${pageId}`,pageId,storeId:a.storeId,actorId:a.actorId,status:'connected',qa:'SYNTHETIC_QA',secretRef:null};
    this.connections.set(pageId,item);this.events.push({type:'page.connected',pageId,storeId:a.storeId,qa:'SYNTHETIC_QA'});
    return {...item};
  }
  disconnect({pageId,context}={}) {
    const a=this.authority(context),c=this.connections.get(pageId);
    if(!c||c.storeId!==a.storeId) throw ERR('CONNECTION_NOT_FOUND');
    c.status='disconnected';this.events.push({type:'page.disconnected',pageId,storeId:a.storeId,qa:'SYNTHETIC_QA'});
    return {...c};
  }
  revoke(pageId){const c=this.connections.get(pageId);if(!c)throw ERR('CONNECTION_NOT_FOUND');c.status='reauthorization_required';return {...c};}
  getConnection({pageId,context}={}) {const a=this.authority(context),c=this.connections.get(pageId);if(!c||c.storeId!==a.storeId)throw ERR('CONNECTION_NOT_FOUND');return {...c};}
}
class MockWebhookGate {
  constructor({secret='synthetic-only-signature-key',now=()=>Date.now()}={}) {this.secret=secret;this.now=now;this.seen=new Set();this.metrics={providerSends:0,orderWrites:0};}
  sign(raw){return 'sha256='+createHmac('sha256',this.secret).update(raw).digest('hex');}
  accept({raw,signature,connection}={}){
    if(typeof raw!=='string'||Buffer.byteLength(raw)>16384)throw ERR('INVALID_PAYLOAD');
    if(typeof signature!=='string'||!/^sha256=[0-9a-f]{64}$/.test(signature))throw ERR('INVALID_SIGNATURE');
    const expected=Buffer.from(this.sign(raw)),got=Buffer.from(signature);
    if(expected.length!==got.length||!timingSafeEqual(expected,got))throw ERR('INVALID_SIGNATURE');
    let v;try{v=JSON.parse(raw)}catch{throw ERR('INVALID_PAYLOAD')}
    if(!v||typeof v!=='object'||typeof v.eventId!=='string'||!/^mock-[a-z0-9-]{1,60}$/.test(v.eventId))throw ERR('INVALID_EVENT');
    if(!connection||connection.status!=='connected'||connection.qa!=='SYNTHETIC_QA'||connection.pageId!==v.pageId)throw ERR('UNKNOWN_PAGE');
    if(!Number.isSafeInteger(v.timestamp)||Math.abs(this.now()-v.timestamp)>300000)throw ERR('STALE_EVENT');
    const dedup=`${connection.pageId}:${v.eventId}`;if(this.seen.has(dedup))throw ERR('REPLAYED_EVENT');
    this.seen.add(dedup);return {accepted:true,action:'NO_SEND_NO_WRITE',storeId:connection.storeId,qa:'SYNTHETIC_QA'};
  }
}
module.exports={FLAGS,ACTORS,PAGES,MockMetaOAuthProvider,MockWebhookGate};
