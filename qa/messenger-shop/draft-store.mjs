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
      checkout INTEGER DEFAULT 0, contact TEXT, quoted_price INTEGER, revision INTEGER DEFAULT 0, handed INTEGER DEFAULT 0, PRIMARY KEY(page,sender));
    CREATE TABLE drafts(id INTEGER PRIMARY KEY, page TEXT, sender TEXT, revision INTEGER, sku TEXT,
      size TEXT, color TEXT, qty INTEGER, price INTEGER, contact TEXT, approved INTEGER DEFAULT 0, UNIQUE(page,sender,revision));
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
    if (action.type==='hold') {
      write('UPDATE conversations SET quoted_price=NULL,revision=revision+1 WHERE page=? AND sender=?',page,sender);
      return {status:'on_hold'};
    }
    if (action.type==='contact') {
      if (!state.checkout) return {status:'ask_clarification'};
      const summary=summarize(page,state.sku,state.size,state.color,state.qty);
      if (summary.status!=='summary') return summary;
      write('UPDATE conversations SET contact=?,quoted_price=?,revision=revision+1 WHERE page=? AND sender=?',
        action.contact,summary.price,page,sender);
      return summary;
    }
    if (action.type==='edit') {
      const newSku = action.sku ?? state.sku;
      const changedModel = newSku !== state.sku;
      const choices=action.checkout ? db.prepare('SELECT size,color FROM variants WHERE page=? AND sku=?').all(page,newSku) : [];
      const only=choices.length===1 ? choices[0] : null;
      const size = action.size ?? only?.size ?? (changedModel ? null : state.size);
      const color = action.color ?? only?.color ?? (changedModel ? null : state.color);
      const qty = action.qty ?? (changedModel ? 1 : state.qty);
      if (!Number.isSafeInteger(qty) || qty<1) return {status:'ask_quantity'};
      const summary = summarize(page,newSku,size,color,qty);
      write('UPDATE conversations SET sku=?,size=?,color=?,qty=?,checkout=?,contact=?,quoted_price=?,revision=revision+1 WHERE page=? AND sender=?',
        newSku,size,color,qty,action.checkout ? 1 : state.checkout,action.checkout ? null : state.contact,
        summary.price ?? null,page,sender);
      if (summary.status==='summary' && (action.checkout || (state.checkout && !state.contact))) return {status:'ask_contact'};
      return summary;
    }
    if (action.type==='submit') {
      if (action.checkoutOnly && !state.checkout) return {status:'ask_clarification'};
      const existing=one('SELECT id,approved FROM drafts WHERE page=? AND sender=? AND revision=?',page,sender,state.revision);
      if (existing?.approved) return {status:'approved',id:existing.id};
      const summary=summarize(page,state.sku,state.size,state.color,state.qty);
      if (summary.status!=='summary') return summary;
      if (state.checkout && !state.contact) return {status:'ask_contact'};
      if (action.qty!==undefined && action.qty!==state.qty) return {status:'ask_quantity'};
      if (existing && summary.price===state.quoted_price) return {status:'pending_owner',id:existing.id};
      if (summary.price!==state.quoted_price) {
        write('UPDATE conversations SET quoted_price=?,revision=revision+1 WHERE page=? AND sender=?',
          summary.price,page,sender);
        return {...summary,status:'reconfirm_price'};
      }
      write('INSERT OR IGNORE INTO drafts(page,sender,revision,sku,size,color,qty,price,contact) VALUES(?,?,?,?,?,?,?,?,?)',
        page,sender,state.revision,state.sku,state.size,state.color,state.qty,summary.price,state.contact);
      const draft=one('SELECT id FROM drafts WHERE page=? AND sender=? AND revision=?',page,sender,state.revision);
      return {status:'pending_owner',id:draft.id};
    }
    if (state.checkout && !state.contact) return {status:'ask_contact'};
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
        const buy=/^lấy ([a-z0-9]+(?:-[a-z0-9]+)*) x([1-9][0-9]*)$/.exec(text);
        const change=/^(?:khoan, )?chỉ lấy ([1-9][0-9]*)$/.exec(text);
        const confirm=/^đúng, chốt ([1-9][0-9]*) (?:cái|chiếc)$/.exec(text);
        const contact=/^tên [^,]+, (?:sđt|số điện thoại) 0[0-9]{9}, địa chỉ .+$/i.test(text);
        if (buy) action={type:'edit',checkout:true,sku:buy[1].toUpperCase(),qty:Number(buy[2])};
        else if (change) action={type:'edit',qty:Number(change[1])};
        else if (contact) action={type:'contact',contact:message.text.trim()};
        else if (text==='để mình suy nghĩ') action={type:'hold'};
        else if (text==='đồng ý' || text==='đúng, chốt đơn như shop vừa tóm tắt') action={type:'submit',checkoutOnly:true};
        else if (confirm) action={type:'submit',checkoutOnly:true,qty:Number(confirm[1])};
        else if (size) action={type:'edit',size:size[1].toUpperCase()};
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
    pendingInbox(owner) {
      return db.prepare(`SELECT d.*, d.qty*d.price AS total FROM drafts d
        JOIN conversations c ON c.page=d.page AND c.sender=d.sender AND c.revision=d.revision
        WHERE d.page=? AND d.approved=0 ORDER BY d.id`).all(ownerPage(owner));
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
    changePrice(owner,{sku,size,color},price) {
      if (!Number.isSafeInteger(price) || price<0) throw Error('INVALID_PRICE');
      const result=write('UPDATE variants SET price=? WHERE page=? AND sku=? AND size=? AND color=?',
        price,ownerPage(owner),sku,size,color);
      if (!result.changes) throw Error('VARIANT_NOT_FOUND');
    },
    pause(owner,paused) { write('UPDATE shops SET paused=? WHERE page=?',Number(Boolean(paused)),ownerPage(owner)); },
    takeOver(owner,sender) {
      write('INSERT INTO conversations(page,sender,handed) VALUES(?,?,1) ON CONFLICT(page,sender) DO UPDATE SET handed=1',ownerPage(owner),sender);
    },
    close() { db.close(); }
  };
}
