// Local QA adapter. Inputs actor and selectedAsset are supplied by the simulated
// session and provider respectively. No HTTP endpoint or production credential.
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export function createRegistry(now = Date.now) {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE members (actor TEXT, shop TEXT, role TEXT, PRIMARY KEY(actor,shop));
    CREATE TABLE attempts (state TEXT PRIMARY KEY, actor TEXT, shop TEXT, kind TEXT, expires INTEGER, asset TEXT);
    CREATE TABLE links (kind TEXT, asset TEXT, shop TEXT, PRIMARY KEY(kind,asset));
  `);
  const manage = (actor, shop) => {
    const member = db.prepare('SELECT role FROM members WHERE actor=? AND shop=?').get(actor,shop);
    if (!['owner','manager'].includes(member?.role)) throw Error('forbidden');
  };
  return {
    member(actor, shop, role) {
      db.prepare('INSERT OR REPLACE INTO members VALUES(?,?,?)').run(actor,shop,role);
    },
    start(actor, shop, kind) {
      manage(actor,shop);
      if (!['messenger','zalo_oa'].includes(kind)) throw Error('provider');
      const state = randomUUID();
      db.prepare('INSERT INTO attempts VALUES(?,?,?,?,?,NULL)').run(state,actor,shop,kind,now()+600000);
      return state;
    },
    finish(actor, state, kind, selectedAsset) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const request = db.prepare('SELECT * FROM attempts WHERE state=?').get(state);
        if (!selectedAsset || !request || request.actor!==actor || request.kind!==kind || request.expires<=now()) throw Error('invalid_callback');
        manage(actor,request.shop);
        const link = db.prepare('SELECT shop FROM links WHERE kind=? AND asset=?').get(kind,selectedAsset);
        if (link && link.shop!==request.shop) throw Error('already_connected');
        if (request.asset && (request.asset!==selectedAsset || !link)) throw Error('used');
        db.prepare('INSERT OR IGNORE INTO links VALUES(?,?,?)').run(kind,selectedAsset,request.shop);
        db.prepare('UPDATE attempts SET asset=? WHERE state=?').run(selectedAsset,state);
        db.exec('COMMIT');
        return request.shop;
      } catch(error) { db.exec('ROLLBACK'); throw error; }
    },
    disconnect(actor, shop, kind, asset) {
      manage(actor,shop);
      db.prepare('DELETE FROM links WHERE shop=? AND kind=? AND asset=?').run(shop,kind,asset);
    },
    links(shop) { return db.prepare('SELECT kind,asset FROM links WHERE shop=?').all(shop); },
    close() { db.close(); },
  };
}
