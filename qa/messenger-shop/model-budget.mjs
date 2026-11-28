// Disposable staging adapter. Limits count attempts in UTC days. Each attempt
// reserves its entire configured envelope, even if the provider times out.
export function budgetedModel(db, limits, invoke, clock = () => new Date()) {
  for (const name of ['sender','shop','project','inputBytes','outputTokens']) {
    if (!Number.isSafeInteger(limits[name]) || limits[name]<1) throw Error('invalid limit '+name);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS model_attempts (
    shop TEXT, sender TEXT, event TEXT, attempt INTEGER, day TEXT,
    PRIMARY KEY(shop,sender,event,attempt));
    CREATE INDEX IF NOT EXISTS model_usage_day ON model_attempts(day,shop,sender);`);
  return async ({shop,sender,event,attempt=1}, prompt) => {
    if (![shop,sender,event].every(s=>typeof s==='string' && s.trim()) ||
        !Number.isSafeInteger(attempt) || attempt<1) throw Error('invalid envelope');
    if (typeof prompt!=='string' || Buffer.byteLength(prompt)>limits.inputBytes) return {status:'input_limit'};
    const day=clock().toISOString().slice(0,10);
    db.exec('BEGIN IMMEDIATE');
    try {
      const previous=db.prepare('SELECT 1 FROM model_attempts WHERE shop=? AND sender=? AND event=? AND attempt=?').get(shop,sender,event,attempt);
      const totals=db.prepare(`SELECT COUNT(*) AS project, COUNT(CASE WHEN shop=? THEN 1 END) AS shop,
        COUNT(CASE WHEN shop=? AND sender=? THEN 1 END) AS sender FROM model_attempts WHERE day=?`).get(shop,shop,sender,day);
      if (previous || ['sender','shop','project'].some(key=>totals[key]>=limits[key])) {
        db.exec('ROLLBACK');
        return {status:previous?'duplicate':'budget_limit'};
      }
      db.prepare('INSERT INTO model_attempts VALUES(?,?,?,?,?)').run(shop,sender,event,attempt,day);
      db.exec('COMMIT');
    } catch(error) { db.exec('ROLLBACK'); throw error; }
    return invoke({prompt,maxOutputTokens:limits.outputTokens});
  };
}
