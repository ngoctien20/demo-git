// Internal QA writer. Call in the receipt transaction with a server-resolved snapshot.
export function writeLine(db,row,variant,qty,expectedTotal,confirmed) {
  if (confirmed!==true) return {status:'confirmation_required'};
  if (!Number.isSafeInteger(expectedTotal)) return {status:'expected_total_required'};
  const price=row.sku===variant.sku ? row.price : variant.price;
  if (!Number.isSafeInteger(qty) || qty<1 || qty>variant.stock) return {status:'reconfirm_stock'};
  if (price*qty!==expectedTotal) return {status:'reconfirm_price'};
  const scope=[row.id,row.page,row.sender,row.edit_version,row.revision];
  const updated=db.prepare(`UPDATE drafts SET sku=?,size=?,color=?,qty=?,price=?,catalog_price_at_edit=?,
    edit_version=edit_version+1 WHERE id=? AND page=? AND sender=? AND edit_version=? AND revision=?
    AND approved=0 AND revision=(SELECT revision FROM conversations WHERE page=drafts.page AND sender=drafts.sender)`)
    .run(variant.sku,variant.size,variant.color,qty,price,variant.price,...scope);
  if (!updated.changes) return {status:'change_stale'};
  db.prepare('UPDATE conversations SET sku=?,size=?,color=?,qty=?,quoted_price=?,browsing=0,inquiry_variant=NULL WHERE page=? AND sender=?')
    .run(variant.sku,variant.size,variant.color,qty,variant.price,row.page,row.sender);
  return {status:'line_saved',expected_total:expectedTotal};
}

export function writeContact(db,row,next,confirmed) {
  if (confirmed!==true) return {status:'confirmation_required'};
  const updated=db.prepare(`UPDATE drafts SET contact=?,edit_version=edit_version+1
    WHERE id=? AND page=? AND sender=? AND edit_version=? AND contact=? AND approved=0
    AND revision=(SELECT revision FROM conversations WHERE page=drafts.page AND sender=drafts.sender)`)
    .run(next,row.id,row.page,row.sender,row.edit_version,row.contact);
  if (!updated.changes) return {status:'change_stale'};
  db.prepare('UPDATE conversations SET contact=? WHERE page=? AND sender=? AND revision=?')
    .run(next,row.page,row.sender,row.revision);
  const saved=db.prepare('SELECT contact FROM drafts WHERE id=?').get(row.id);
  if (saved.contact!==next) throw Error('CONTACT_READBACK_MISMATCH');
  return {status:'change_saved',contact:saved.contact};
}
