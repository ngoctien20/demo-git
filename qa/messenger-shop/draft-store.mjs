// Offline staging adapter. Only a disposable in-memory catalog and order book are supported.
// The caller supplies the verified Page/sender envelope (or authenticated owner), never a store from chat.
import { DatabaseSync } from 'node:sqlite';

export function createQaShopBook({ shops, variants }) {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE shops(page TEXT PRIMARY KEY, owner TEXT UNIQUE NOT NULL, paused INTEGER DEFAULT 0, public_contact TEXT);
    CREATE TABLE variants(page TEXT, sku TEXT, size TEXT, color TEXT, price INTEGER CHECK(price>=0),
      stock INTEGER CHECK(stock>=0), PRIMARY KEY(page,sku,size,color));
    CREATE TABLE conversations(page TEXT, sender TEXT, sku TEXT, size TEXT, color TEXT, qty INTEGER DEFAULT 1,
      revision INTEGER DEFAULT 0, handed INTEGER DEFAULT 0, PRIMARY KEY(page,sender));
    CREATE TABLE drafts(id INTEGER PRIMARY KEY, page TEXT, sender TEXT, revision INTEGER, sku TEXT,
      size TEXT, color TEXT, qty INTEGER, price INTEGER, approved INTEGER DEFAULT 0, UNIQUE(page,sender,revision));
    CREATE TABLE receipts(page TEXT,sender TEXT,event TEXT, PRIMARY KEY(page,sender,event));
  `);
  for (const sh of shops) db.prepare('INSERT INTO shops(page,owner,public_contact) VALUES(?,?,?)')
    .run(sh.page,sh.owner,sh.publicContact ?? null);
  for (const v of variants) db.prepare('INSERT INTO variants VALUES(?,?,?,?,?,?)')
    .run(v.page,v.sku,v.size,v.color,v.price,v.stock);
  const one = (sql,...args) => db.prepare(sql).get(...args);
  const write = (sql,...args) => db.prepare(sql).run(...args);
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (err) { db.exec('ROLLBACK'); throw err; }
  }
  function ownerPage(owner) {
    const shop = one('SELECT page FROM shops WHERE owner=?',owner);
    if (!shop) throw Error('OWNER_SCOPE_REQUIRED');
    return shop.page;
  }
  function process(shop,sender,action) {
    const page = shop.page;
    write('INSERT OR IGNORE INTO conversations(page,sender) VALUES(?,?)',page,sender);
    const state = one('SELECT * FROM conversations WHERE page=? AND sender=?',page,sender);
    if (shop.paused || state.handed) return { status:'silent' };
    if (action.type==='catalog') {
      const rows=db.prepare('SELECT sku,size,color,price,stock FROM variants WHERE page=? ORDER BY sku,color,size').all(page);
      return {status:'catalog',rows};
    }
    if (action.type==='human') return {status:'contact',text:shop.public_contact || 'Shop chưa công khai liên hệ.'};
    if (action.type==='edit') {
      const newSku = action.sku ?? state.sku;
      const changedModel = newSku !== state.sku;
      const size = action.size ?? (changedModel ? null : state.size);
      const color = action.color ?? (changedModel ? null : state.color);
      const qty = action.qty ?? (changedModel ? 1 : state.qty);
      if (!Number.isSafeInteger(qty) || qty<1) return {status:'ask_quantity'};
      write('UPDATE conversations SET sku=?,size=?,color=?,qty=?,revision=revision+1 WHERE page=? AND sender=?',
        newSku,size,color,qty,page,sender);
      return summarize(page,newSku,size,color,qty);
    }
    if (action.type==='submit') {
      const summary=summarize(page,state.sku,state.size,state.color,state.qty);
      if (summary.status!=='summary') return summary;
      write('INSERT OR IGNORE INTO drafts(page,sender,revision,sku,size,color,qty,price) VALUES(?,?,?,?,?,?,?,?)',
        page,sender,state.revision,state.sku,state.size,state.color,state.qty,summary.price);
      const draft=one('SELECT id FROM drafts WHERE page=? AND sender=? AND revision=?',page,sender,state.revision);
      return {status:'pending_owner',id:draft.id};
    }
    return {status:'ask_clarification'};
  }
  function summarize(page,sku,size,color,qty) {
    if (!sku || !color || !size) return {status:'ask_variant'};
    const v=one('SELECT price,stock FROM variants WHERE page=? AND sku=? AND size=? AND color=?',page,sku,size,color);
    if (!v) return {status:'ask_variant'};
    if (v.stock<qty) return {status:'reconfirm_stock'};
    const total=v.price*qty;
    if (!Number.isSafeInteger(total)) return {status:'reconfirm_price'};
    return {status:'summary',sku,size,color,qty,price:v.price,total};
  }
  return {
    customerMessage(envelope,message) {
      // Deterministic subset for the QA journey. Only resolve catalog fields from this Page.
      // Unsupported or ambiguous text is sent back for clarification.
      const text=String(message.text ?? '').trim().toLocaleLowerCase('vi');
      let action={type:'unknown'};
      if (message.payload==='T404:M:catalog' || text==='xem sản phẩm') action={type:'catalog'};
      else if (message.payload?.startsWith('TIEN404:VIEW:')) {
        const sku=message.payload.slice('TIEN404:VIEW:'.length);
        if (/^[A-Z][0-9]{3}$/.test(sku)) action={type:'edit',sku};
      } else if (text==='gặp nhân viên') action={type:'human'};
      else if (text==='gửi yêu cầu mua') action={type:'submit'};
      else {
        const size=/^(?:đổi sang |đổi |lấy )?size (xs|s|m|l|xl|xxl)$/.exec(text);
        const color=/^màu (.+)$/.exec(text);
        const qty=/^(?:lấy|chỉ lấy) ([1-9][0-9]*) (?:chiếc|cái)$/.exec(text);
        if (size) action={type:'edit',size:size[1].toUpperCase()};
        else if (color) action={type:'edit',color:color[1]};
        else if (qty) action={type:'edit',qty:Number(qty[1])};
      }
      return this.customer(envelope,action);
    },
    customer({page,sender,event},action) {
      if (![page,sender,event].every(v=>typeof v==='string' && v.trim())) throw Error('MISSING_ENVELOPE');
      return transaction(()=>{
        const shop=one('SELECT * FROM shops WHERE page=?',page);
        if (!shop) return {status:'unbound_page'};
        const prior=one('SELECT 1 FROM receipts WHERE page=? AND sender=? AND event=?',page,sender,event);
        if (prior) return {status:'duplicate'};
        const result=process(shop,sender,action);
        write('INSERT INTO receipts VALUES(?,?,?)',page,sender,event);
        return result;
      });
    },
    inbox(owner) {
      return db.prepare('SELECT * FROM drafts WHERE page=? ORDER BY id').all(ownerPage(owner));
    },
    approve(owner,id) {
      return transaction(()=>{
        const page=ownerPage(owner);
        const d=one('SELECT * FROM drafts WHERE page=? AND id=?',page,id);
        if (!d) return {status:'not_found'};
        if (d.approved) return {status:'approved',id};
        const session=one('SELECT revision FROM conversations WHERE page=? AND sender=?',page,d.sender);
        if (session.revision!==d.revision) return {status:'superseded'};
        const s=summarize(page,d.sku,d.size,d.color,d.qty);
        if (s.status!=='summary') return s;
        if (s.price!==d.price) return {status:'reconfirm_price'};
        write('UPDATE variants SET stock=stock-? WHERE page=? AND sku=? AND size=? AND color=?',d.qty,page,d.sku,d.size,d.color);
        write('UPDATE drafts SET approved=1 WHERE id=?',id);
        return {status:'approved',id};
      });
    },
    pause(owner,paused) { write('UPDATE shops SET paused=? WHERE page=?',Number(Boolean(paused)),ownerPage(owner)); },
    takeOver(owner,sender) {
      write('INSERT INTO conversations(page,sender,handed) VALUES(?,?,1) ON CONFLICT(page,sender) DO UPDATE SET handed=1',ownerPage(owner),sender);
    },
    close() { db.close(); }
  };
}
