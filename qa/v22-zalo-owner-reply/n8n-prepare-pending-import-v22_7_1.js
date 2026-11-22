// V22.7.1: keep the valid rows of the last previewed file for 15 minutes, until the owner confirms.
const j=$input.first()?.json||{};
const rows=Array.isArray(j.valid_rows)?j.valid_rows:[];
if(!rows.length)return [];
return [{json:{slot:'pending',file_name:String(j.echo&&j.echo.file_name||'').slice(0,60),rows_json:JSON.stringify(rows.slice(0,100)),created_at:new Date().toISOString()}}];
