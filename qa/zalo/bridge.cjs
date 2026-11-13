// Local dry run only. No network transport, tokens, inbound HTTP route or business write.
const {DatabaseSync}=require('node:sqlite');
const {checkFixture}=require('./gate.cjs');
const {openLab}=require('./session.cjs');
function openBridge(path) {
  const db=new DatabaseSync(path);
  db.exec(`PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS mock_outbox(
      scope TEXT NOT NULL, event TEXT NOT NULL, recipient TEXT NOT NULL,
      output TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued',
      PRIMARY KEY(scope,event));`);
  const lab=openLab(path,(tx,{scope,actor,event,reply})=>{
    tx.prepare('INSERT INTO mock_outbox(scope,event,recipient,output) VALUES(?,?,?,?)')
      .run(scope,event,actor,reply.reply);
  },(tx,scope,event)=>tx.prepare('SELECT 1 FROM mock_outbox WHERE scope=? AND event=?').get(scope,event));
  const scope=JSON.stringify(['fashion','lab-v2','qa-owner']);
  function receive(event) {
    const gate=checkFixture(event,'qa-owner');
    if(gate!=='ok') return {kind:gate};
    return lab.turn('fashion','qa-owner',event.messageId,event.text);
  }
  function dispatch(event,settings,outcome) {
    if(settings?.enabled!==true) return 'disabled';
    if(!Number.isSafeInteger(settings.limit)||settings.limit<1||settings.limit>5) return 'bad_limit';
    db.exec('BEGIN IMMEDIATE');
    try {
      const used=db.prepare("SELECT count(*) AS n FROM mock_outbox WHERE state!='queued'").get().n;
      const claim=used<settings.limit && db.prepare("UPDATE mock_outbox SET state='needs_review' WHERE scope=? AND event=? AND recipient='qa-owner' AND state='queued'").run(scope,event).changes===1;
      db.exec('COMMIT');
      if(!claim) return 'blocked';
    } catch(error) {db.exec('ROLLBACK');throw error;}
    // Crash/timeout leaves a durable reservation. No automatic replay of a possible send.
    const state=outcome===200?'mock_accepted':outcome===429?'rate_limited':'needs_review';
    db.prepare('UPDATE mock_outbox SET state=? WHERE scope=? AND event=?').run(state,scope,event);
    return state;
  }
  return {receive,dispatch,close(){lab.close();db.close();}};
}
module.exports={openBridge};
