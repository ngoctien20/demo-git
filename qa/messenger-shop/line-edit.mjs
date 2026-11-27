import {normPhone,parseContact} from './contact-edit.mjs';

// Called only inside the receipt transaction. The preview is private to the Page and sender.
export function lineEdit(db,page,sender,message) {
  const text=message?.trim() ?? '';
  const request=/^đơn QA-ORDER-([1-9]\d*), số (\+?\d+), (?:đổi (?:([\w-]+) )?sang ([\w-]+)|(?:tăng|giảm) (?:lên|xuống|còn) ([1-9]\d*))$/iu.exec(text);
  const pending=db.prepare('SELECT * FROM line_edits WHERE page=? AND sender=?').get(page,sender);
  if (!pending && !request) return;
  if (pending) db.prepare('DELETE FROM line_edits WHERE page=? AND sender=?').run(page,sender);
  if (!request && !/^tôi xác nhận(?: giá vừa báo)?$/iu.test(text)) return;
  const id=request ? Number(request[1]) : pending.draft_id;
  const row=Number.isSafeInteger(id) && db.prepare(`SELECT d.* FROM drafts d JOIN conversations c
    ON d.page=c.page AND d.sender=c.sender AND d.revision=c.revision
    WHERE d.page=? AND d.sender=? AND d.id=? AND d.approved=0`).get(page,sender,id);
  if (!row || (request && parseContact(row.contact)?.phone!==normPhone(request[2]))) return {status:'unverified_order'};
  if (!request && pending.version!==row.edit_version) return {status:'change_stale'};
  if (request?.[3] && request[3].toUpperCase()!==row.sku) return {status:'change_stale'};
  const sku=request ? request[4]?.toUpperCase() ?? row.sku : pending.sku;
  const qty=request ? Number(request[5] ?? row.qty) : pending.qty;
  if (!Number.isSafeInteger(qty) || qty<1) return {status:'ask_quantity'};
  const variants=db.prepare('SELECT * FROM variants WHERE page=? AND sku=?').all(page,sku);
  const variant=sku===row.sku ? variants.find(v=>v.size===row.size && v.color===row.color) :
    variants.length===1 ? variants[0] : null;
  if (!variant) return {status:'ask_variant'};
  if (qty>variant.stock) return {status:'reconfirm_stock',stock:variant.stock};
  const price=sku===row.sku ? row.price : variant.price;
  const total=price*qty;
  if (!Number.isSafeInteger(total)) return {status:'reconfirm_price'};
  const result={order:'QA-ORDER-'+id,sku,size:variant.size,color:variant.color,qty,price,total};
  if (request || pending.expected_total!==total || pending.size!==variant.size || pending.color!==variant.color) {
    db.prepare('INSERT INTO line_edits VALUES(?,?,?,?,?,?,?,?,?)')
      .run(page,sender,id,row.edit_version,sku,variant.size,variant.color,qty,total);
    return {...result,status:request ? 'line_preview' : 'reconfirm_price'};
  }
  db.prepare(`UPDATE drafts SET sku=?,size=?,color=?,qty=?,price=?,catalog_price_at_edit=?,
    edit_version=edit_version+1 WHERE id=?`).run(sku,variant.size,variant.color,qty,price,variant.price,id);
  db.prepare('UPDATE conversations SET sku=?,size=?,color=?,qty=?,quoted_price=?,browsing=0,inquiry_variant=NULL WHERE page=? AND sender=?')
    .run(sku,variant.size,variant.color,qty,variant.price,page,sender);
  return {...result,status:'line_saved',expected_total:pending.expected_total};
}
