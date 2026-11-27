// Contact amendments for pending QA drafts. Runs inside the same transaction as the event receipt.
const fields={'số':'phone','tên':'name','địa chỉ':'address'};
export const normPhone=value=>/^\+84\d{9}$/.test(value) ? '0'+value.slice(3) : value;

export function parseContact(text) {
  const match=/^tên (.+?), (?:sđt|số điện thoại) (0\d{9}), địa chỉ (.+)$/iu.exec(text || '');
  return match && {name:match[1],phone:match[2],address:match[3]};
}

function validated(field,value) {
  if (field==='phone') return /^0\d{9}$/.test(normPhone(value)) ? normPhone(value) : null;
  if (!value || value.length>200 || /^[=+@-]/.test(value) || /[\r\n]/.test(value)) return null;
  if (field==='name') return /^[\p{L}\p{M} .'-]{2,80}$/u.test(value) ? value : null;
  return value.length>=5 && /\p{L}/u.test(value) ? value : null;
}

export function contactEdit(db,page,sender,message) {
  const text=message?.trim() ?? '';
  const match=/^đổi (số|tên|địa chỉ) đơn QA-ORDER-([1-9]\d*)(?: từ |, số (?:cũ )?)(\+?\d+)(?: sang |, (?:thành|sang) )(.+)$/iu.exec(text);
  const pending=db.prepare('SELECT * FROM contact_edits WHERE page=? AND sender=?').get(page,sender);
  if (!pending && !match) return;
  const clear=()=>db.prepare('DELETE FROM contact_edits WHERE page=? AND sender=?').run(page,sender);
  const read=id=>db.prepare(`SELECT d.* FROM drafts d JOIN conversations c
    ON c.page=d.page AND c.sender=d.sender AND c.revision=d.revision
    WHERE d.id=? AND d.page=? AND d.sender=? AND d.approved=0`).get(id,page,sender);
  let field,value,row;
  if (match) {
    clear();
    field=fields[match[1].toLowerCase()];
    const id=Number(match[2]);
    row=Number.isSafeInteger(id) && read(id);
    const contact=parseContact(row?.contact);
    if (!contact || contact.phone!==normPhone(match[3])) return {status:'unverified_order'};
    value=match[4];
  } else {
    clear();
    const amend=/^chờ, đổi sang (.+)$/iu.exec(text);
    if (/^(?:đừng đổi nữa|hủy)$/iu.test(text)) return {status:'change_cancelled'};
    field=pending.field;
    const house=/^đúng, lấy số nhà (\d+)$/iu.exec(text);
    const confirm=/^tôi xác nhận$/iu.test(text) ||
      (field==='name' && /^đúng, đổi tên$/iu.test(text)) ||
      (field==='address' && (/^đúng, giao ở đó$/iu.test(text) || (house && pending.value.split(/\s+/)[0]===house[1])));
    if (!amend && !confirm) return;
    row=read(pending.draft_id);
    if (!row || row.contact!==pending.snapshot || row.edit_version!==pending.version) return {status:'change_stale'};
    if (confirm) {
      const contact=parseContact(row.contact);
      contact[field]=pending.value;
      const next='Tên '+contact.name+', SĐT '+contact.phone+', địa chỉ '+contact.address;
      db.prepare('UPDATE drafts SET contact=?,edit_version=edit_version+1 WHERE id=?').run(next,row.id);
      db.prepare('UPDATE conversations SET contact=? WHERE page=? AND sender=? AND revision=?')
        .run(next,page,sender,row.revision);
      const saved=parseContact(read(row.id).contact);
      return {status:'change_saved',order:'QA-ORDER-'+row.id,field,value:saved[field]};
    }
    value=amend[1];
  }
  value=validated(field,value);
  if (value===null) {
    const help={phone:'Bạn nhập đủ số điện thoại có mã vùng hoặc số 0 ở đầu nhé.',
      name:'Bạn cho shop biết tên người nhận nhé.',address:'Bạn nhập địa chỉ giao hàng có tên đường hoặc khu vực nhé.'};
    return {status:'ask_valid_'+field,text:help[field]};
  }
  db.prepare('INSERT INTO contact_edits VALUES(?,?,?,?,?,?,?)').run(page,sender,row.id,field,value,row.contact,row.edit_version);
  return {status:'change_preview',order:'QA-ORDER-'+row.id,field,value};
}
