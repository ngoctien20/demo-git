// TIEN404 V12.2 — CSV exports for staff-visible SELF-REPORTED QA only.
// Do not treat a self_pass entry as a verified automated QA PASS.
const COLS=['Thời gian','Mã lượt','Tester user ID','Mã bài','Tự đánh giá','Ghi chú','Nguồn','Môi trường'];
function cell(value) {
  const raw=String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
  // Spreadsheet consumers may interpret leading formulas after whitespace.
  const safe=/^[\s]*[=+@-]/u.test(raw)?"'"+raw:raw;
  return '"'+safe.replaceAll('"','""')+'"';
}
export function buildTesterCsv(rows) {
  if(!Array.isArray(rows))throw Error('INVALID_ROWS');
  const lines=[COLS.map(cell).join(',')];
  for(const row of rows) {
    if(!row||typeof row!=='object')continue;
    const fields=[
      row.created_at,row.run_id,row.user_id,row.case_id,row.outcome,
      row.feedback,row.self_reported===true?'Tự đánh giá':'Chưa xác minh','staging'
    ];
    lines.push(fields.map(cell).join(','));
  }
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
