// Node 24 offline replay adapter. Bindings belong to the harness, never to inbound text.
const { DatabaseSync } = require('node:sqlite');
const { respond } = require('./engine.cjs');
const TTL = 30 * 60_000;
function openLab(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS sessions(scope TEXT PRIMARY KEY, facts TEXT NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS receipts(scope TEXT NOT NULL, event TEXT NOT NULL, expires INTEGER NOT NULL, PRIMARY KEY(scope,event))');
  function turn(binding,actor,event,text,now=Date.now()) {
    if (!['fashion','grocery','building','dealer'].includes(binding) ||
        ![actor,event].every(s=>typeof s === 'string' && /^qa-[a-z0-9-]{1,60}$/.test(s))) throw Error('synthetic scope required');
    const scope=JSON.stringify([binding,'lab-v2',actor]);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM receipts WHERE expires <= ?').run(now);
      db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now);
      if (db.prepare('SELECT 1 FROM receipts WHERE scope=? AND event=?').get(scope,event)) {
        db.exec('COMMIT');
        return {kind:'duplicate'};
      }
      const saved=db.prepare('SELECT facts FROM sessions WHERE scope=?').get(scope);
      const reply=respond(binding,saved?JSON.parse(saved.facts):{},text);
      db.prepare('INSERT OR REPLACE INTO sessions VALUES (?,?,?)').run(scope,JSON.stringify(reply.state),now+TTL);
      db.prepare('INSERT INTO receipts VALUES (?,?,?)').run(scope,event,now+24*60*60_000);
      db.exec('COMMIT');
      return reply;
    } catch (err) {db.exec('ROLLBACK'); throw err;}
  }
  return {turn,close:()=>db.close()};
}
module.exports={openLab,TTL};
