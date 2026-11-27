// Offline QA adapter. The default is in-memory; parallel QA uses a disposable SQLite file.
// The caller supplies the verified Page/sender envelope (or authenticated owner), never a store from chat.
import {lineEdit} from './line-edit.mjs';
import {contactEdit} from './contact-edit.mjs';
import {parseInquiry,answerInquiry} from './catalog-inquiry.mjs';
import { DatabaseSync } from 'node:sqlite';

export function createQaShopBook({ shops, variants }, db=new DatabaseSync(':memory:')) {
  db.exec('PRAGMA busy_timeout=5000');
  if (shops) {
    db.exec(`
      CREATE TABLE shops(page TEXT PRIMARY KEY, owner TEXT UNIQUE NOT NULL, paused INTEGER DEFAULT 0, public_contact TEXT);
      CREATE TABLE variants(page TEXT, sku TEXT, size TEXT, color TEXT, price INTEGER CHECK(price>=0),
        stock INTEGER CHECK(stock>=0), PRIMARY KEY(page,sku,size,color));
      CREATE TABLE conversations(page TEXT, sender TEXT, sku TEXT, size TEXT, color TEXT, qty INTEGER DEFAULT 1,
        quantity_unclear INTEGER DEFAULT 0, inquiry_variant TEXT, browsing INTEGER DEFAULT 0, checkout INTEGER DEFAULT 0, contact TEXT, quoted_price INTEGER, revision INTEGER DEFAULT 0, handed INTEGER DEFAULT 0, PRIMARY KEY(page,sender));
      CREATE TABLE drafts(id INTEGER PRIMARY KEY, page TEXT, sender TEXT, revision INTEGER, sku TEXT,
        size TEXT, color TEXT, qty INTEGER, price INTEGER, contact TEXT, catalog_price_at_edit INTEGER, edit_version INTEGER DEFAULT 0, approved INTEGER DEFAULT 0, UNIQUE(page,sender,revision));
      CREATE TABLE line_edits(page TEXT,sender TEXT,draft_id INTEGER,version INTEGER,sku TEXT,size TEXT,color TEXT,qty INTEGER,expected_total INTEGER NOT NULL,PRIMARY KEY(page,sender));
      CREATE TABLE contact_edits(page TEXT,sender TEXT,draft_id INTEGER,field TEXT,value TEXT,snapshot TEXT,version INTEGER,PRIMARY KEY(page,sender));
      CREATE TABLE support_requests(page TEXT,sender TEXT,accepted INTEGER DEFAULT 0,PRIMARY KEY(page,sender));
      CREATE TABLE receipts(page TEXT,sender TEXT,event TEXT, draft_id INTEGER, PRIMARY KEY(page,sender,event));
    `);
    for (const sh of shops) db.prepare('INSERT INTO shops(page,owner,public_contact) VALUES(?,?,?)')
      .run(sh.page,sh.owner,sh.publicContact ?? null);
    for (const v of variants) db.prepare('INSERT INTO variants VALUES(?,?,?,?,?,?)')
      .run(v.page,v.sku,v.size,v.color,v.price,v.stock);
  }
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
    const amendment=contactEdit(db,page,sender,action.message);
    const line=lineEdit(db,page,sender,action.message);
    if (amendment || line) return amendment ?? line;
    if (action.type==='inquiry' || action.type==='catalog') {
      const rows=db.prepare('SELECT sku,size,color,price,stock FROM variants WHERE page=? ORDER BY sku,color,size').all(page);
      if (action.type==='inquiry') {
        const reply=answerInquiry(action.query,rows,JSON.parse(state.inquiry_variant));
        const row=reply.rows?.length===1 ? reply.rows[0] : null;
        const variant=row ? JSON.stringify([row.sku,row.color,row.size]) : null;
        write('UPDATE conversations SET inquiry_variant=?,browsing=1 WHERE page=? AND sender=?',variant,page,sender);
        return reply;
      }
      write('UPDATE conversations SET inquiry_variant=NULL WHERE page=? AND sender=?',page,sender);
      return {status:'catalog',rows};
    }
    if (state.inquiry_variant) write('UPDATE conversations SET inquiry_variant=NULL WHERE page=? AND sender=?',page,sender);
    if (action.type==='external_email') return {status:'external_unavailable',text:'Shop cần tự gửi email này.'};
    if (action.type==='request_staff') {
      write('INSERT OR IGNORE INTO support_requests(page,sender) VALUES(?,?)',page,sender);
      return {status:'staff_requested',text:'Đã ghi yêu cầu hỗ trợ vào hộp QA của shop.'};
    }
    if (action.type==='ambiguous_qty') {
      write('UPDATE conversations SET quantity_unclear=1,revision=revision+1 WHERE page=? AND sender=?',page,sender);
      return {status:'ask_quantity',text:'Bạn muốn tổng cộng bao nhiêu cái?'};
    }
    if (state.quantity_unclear && action.type==='submit') return {status:'ask_quantity',text:'Bạn muốn tổng cộng bao nhiêu cái?'};
    if (action.type==='human') return {status:'contact',text:shop.public_contact || 'Shop chưa công khai liên hệ.'};
    if (action.type==='hold') {
      write('UPDATE conversations SET quoted_price=NULL,revision=revision+1 WHERE page=? AND sender=?',page,sender);
      return {status:'on_hold'};
    }
    if (state.browsing && (action.type==='submit' || action.type==='contact' ||
        (action.type==='edit' && !action.sku))) {
      return {status:'ask_variant',text:'Bạn chọn lại mã mẫu muốn đặt nhé.'};
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
      const changedModel = newSku !== state.sku || Boolean(state.browsing);
      const choices=action.checkout ? db.prepare('SELECT size,color FROM variants WHERE page=? AND sku=?').all(page,newSku) : [];
      const only=choices.length===1 ? choices[0] : null;
      const size = action.size ?? only?.size ?? (changedModel ? null : state.size);
      const color = action.color ?? only?.color ?? (changedModel ? null : state.color);
      const qty = action.qty ?? (changedModel ? 1 : state.qty);
      if (!Number.isSafeInteger(qty) || qty<1) return {status:'ask_quantity'};
      const summary = summarize(page,newSku,size,color,qty);
      write('UPDATE conversations SET quantity_unclear=?,browsing=0,sku=?,size=?,color=?,qty=?,checkout=?,contact=?,quoted_price=?,revision=revision+1 WHERE page=? AND sender=?',
        action.qty || changedModel ? 0 : state.quantity_unclear,newSku,size,color,qty,action.checkout ? 1 : (state.browsing ? 0 : state.checkout),action.checkout || state.browsing ? null : state.contact,
        summary.price ?? null,page,sender);
      if (summary.status==='summary' && (action.checkout || (!state.browsing && state.checkout && !state.contact))) return {status:'ask_contact'};
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
      else if (/^có thể gửi email cho khách giúp mình không[?]?$/u.test(text)) action={type:'external_email'};
      else if (text==='gửi yêu cầu mua') action={type:'submit'};
      else {
        const size=/^(?:đổi sang |đổi |lấy )?size (xs|s|m|l|xl|xxl)$/.exec(text);
        const color=/^màu (.+)$/.exec(text);
        const qty=/^(?:lấy|chỉ lấy) ([1-9][0-9]*) (?:chiếc|cái)$/.exec(text);
        const buy=/^lấy ([a-z0-9]+(?:-[a-z0-9]+)*) x([1-9][0-9]*)$/.exec(text);
        const change=/^(?:khoan, )?chỉ lấy ([1-9][0-9]*)$/.exec(text);
        const confirm=/^đúng, chốt ([1-9][0-9]*) (?:cái|chiếc)$/.exec(text);
        const contact=/^tên [^,]+, (?:sđt|số điện thoại) 0[0-9]{9}, địa chỉ .+$/i.test(text);
        const query=parseInquiry(text);
        const outfit=/^lấy áo (.+?) size (xs|s|m|l|xl|xxl)$/.exec(text);
        const resize=/^(?:à )?đổi sang (xs|s|m|l|xl|xxl)$/.exec(text);
        const finalQty=/^(?:thôi lấy|tổng cộng|tổng) ([1-9]\d*) (?:cái|chiếc)$/.exec(text);
        if (outfit) action={type:'edit',color:outfit[1],size:outfit[2].toUpperCase()};
        else if (resize) action={type:'edit',size:resize[1].toUpperCase()};
        else if (finalQty) action={type:'edit',qty:Number(finalQty[1])};
        else if (/^lấy thêm (?:hai|\d+) (?:cái|chiếc)$/.test(text)) action={type:'ambiguous_qty'};
        else if (text==='gửi yêu cầu hỗ trợ') action={type:'request_staff'};
        else if (query) action={type:'inquiry',query};
        else if (buy) action={type:'edit',checkout:true,sku:buy[1].toUpperCase(),qty:Number(buy[2])};
        else if (change) action={type:'edit',qty:Number(change[1])};
        else if (contact) action={type:'contact',contact:message.text.trim()};
        else if (text==='để mình suy nghĩ') action={type:'hold'};
        else if (text==='xác nhận yêu cầu mua') action={type:'submit'};
        else if (text==='đồng ý' || text==='đúng, chốt đơn như shop vừa tóm tắt') action={type:'submit',checkoutOnly:true};
        else if (confirm) action={type:'submit',checkoutOnly:true,qty:Number(confirm[1])};
        else if (size) action={type:'edit',size:size[1].toUpperCase()};
        else if (color) action={type:'edit',color:color[1]};
        else if (qty) action={type:'edit',qty:Number(qty[1])};
      }
      return this.customer(envelope,{...action,message:message.payload ? null : message.text});
    },
    customer({page,sender,event},action) {
      if (![page,sender,event].every(v=>typeof v==='string' && v.trim())) throw Error('MISSING_ENVELOPE');
      return transaction(()=>{
        const shop=one('SELECT * FROM shops WHERE page=?',page);
        if (!shop) return {status:'unbound_page'};
        const prior=one('SELECT draft_id FROM receipts WHERE page=? AND sender=? AND event=?',page,sender,event);
        if (prior) {
          const saved=prior.draft_id && one('SELECT id,edit_version FROM drafts WHERE id=? AND page=? AND sender=?',prior.draft_id,page,sender);
          return saved ? {status:'duplicate',id:saved.id,current_version:saved.edit_version} : {status:'duplicate'};
        }
        const result=process(shop,sender,action);
        const draftId=result.id ?? (result.status==='change_saved' || result.status==='line_saved' ?
          Number(result.order.slice('QA-ORDER-'.length)) : null);
        write('INSERT INTO receipts VALUES(?,?,?,?)',page,sender,event,draftId);
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
        if (s.price!==(d.catalog_price_at_edit ?? d.price)) return {status:'reconfirm_price'};
        write('UPDATE variants SET stock=stock-? WHERE page=? AND sku=? AND size=? AND color=?',d.qty,page,d.sku,d.size,d.color);
        write('UPDATE drafts SET approved=1 WHERE id=?',id);
        return {status:'approved',id};
      });
    },
    changeStock(owner,{sku,size,color},stock) {
      if (!Number.isSafeInteger(stock) || stock<0) throw Error('INVALID_STOCK');
      const result=write('UPDATE variants SET stock=? WHERE page=? AND sku=? AND size=? AND color=?',
        stock,ownerPage(owner),sku,size,color);
      if (!result.changes) throw Error('VARIANT_NOT_FOUND');
    },
    changePrice(owner,{sku,size,color},price) {
      if (!Number.isSafeInteger(price) || price<0) throw Error('INVALID_PRICE');
      const result=write('UPDATE variants SET price=? WHERE page=? AND sku=? AND size=? AND color=?',
        price,ownerPage(owner),sku,size,color);
      if (!result.changes) throw Error('VARIANT_NOT_FOUND');
    },
    pause(owner,paused) {
      if (paused) write('DELETE FROM line_edits WHERE page=?',ownerPage(owner));
      if (paused) write('DELETE FROM contact_edits WHERE page=?',ownerPage(owner));
      write('UPDATE shops SET paused=? WHERE page=?',Number(Boolean(paused)),ownerPage(owner)); },
    supportInbox(owner) {
      return db.prepare('SELECT sender,accepted FROM support_requests WHERE page=?').all(ownerPage(owner));
    },
    takeOver(owner,sender) {
      write('UPDATE support_requests SET accepted=1 WHERE page=? AND sender=?',ownerPage(owner),sender);
      write('INSERT INTO conversations(page,sender,handed) VALUES(?,?,1) ON CONFLICT(page,sender) DO UPDATE SET handed=1',ownerPage(owner),sender);
    },
    close() { db.close(); }
  };
}
