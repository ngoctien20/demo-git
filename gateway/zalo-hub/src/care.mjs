// Only an operator-verified Lite installation may be associated with a web workspace.
export function careConnection(env, connection) {
  if (!/^zl-[0-9a-f]{24}$/.test(connection.store_id)) return connection;
  const bindings = JSON.parse(env.ZH_CARE_LITE_WORKSPACES || '{}');
  if (!Object.hasOwn(bindings,connection.store_id)) return connection;
  const workspace = bindings[connection.store_id];
  if (typeof workspace !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(workspace))
    throw new Error('INVALID_LITE_WORKSPACE_BINDING');
  return {...connection,store_id:workspace};
}
// Isolated pilot enrolment. Operator-owned plan map, never a plan supplied by the dashboard.
export function tier(env, store) {
  const plans = JSON.parse(env.ZH_CARE_PILOT_PLANS || '{}');
  return Object.hasOwn(plans, store) && ['lite','plus','pro'].includes(plans[store]) ? plans[store] : null;
}
export function contactRequest(text) {
  const words = String(text || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replaceAll('đ','d');
  return /\b(cskh|cham soc khach hang|(gap|lien he|noi chuyen voi) (nhan vien|nguoi that|tu van vien))\b/.test(words);
}
const query = (db, sql, ...args) => db.prepare(sql).bind(...args);
export async function contact(db, store) {
  return await query(db,'SELECT phone,zalo FROM zh_care_contacts WHERE store=?',store).first() || {phone:'',zalo:''};
}
export function answer(info) {
  const methods = [info.phone && 'gọi cho cửa hàng theo số ' + info.phone, info.zalo && 'liên hệ Zalo qua ' + info.zalo].filter(Boolean);
  return methods.length ? 'Bạn có thể ' + methods.join(' hoặc ') + '.' : 'Cửa hàng chưa công bố số điện thoại hoặc Zalo chăm sóc khách hàng.';
}
export async function record(db,c,e,at) {
  const key = [c.store_id,c.id,e.chat.id,e.message_id];
  const result = await query(db,`INSERT INTO zh_care_messages(store,conn,chat,event,name,content,at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(conn,event) DO NOTHING`,...key,e.user.display_name || null,e.text || e.caption || '['+e.type+']',at).run();
  if (!result.meta.changes) return 'duplicate';
  return (await query(db,'SELECT state FROM zh_care_messages WHERE store=? AND conn=? AND chat=? AND event=?',...key).first()).state;
}
export async function reserve(db,c,b) {
  return (await query(db,`UPDATE zh_care_messages SET state='sending' WHERE store=? AND conn=? AND chat=? AND event=? AND state='pending'`,
    c.store_id,c.id,b.chat_id,b.source_message_id || '').run()).meta.changes === 1;
}
export async function finish(db,c,b,ok) {
  await query(db,`UPDATE zh_care_messages SET state=?,reply=? WHERE conn=? AND chat=? AND event=? AND state='sending'`,
    ok?'sent':'unconfirmed',ok?b.text:null,c.id,b.chat_id,b.source_message_id).run();
}
const scopeState = '(SELECT paused FROM zh_care_controls WHERE store=m.store AND conn=m.conn AND chat=m.chat ORDER BY id DESC LIMIT 1)';
export async function owner(db, plan, who, path, b, now, json) {
  const store = b.store_id;
  if (!plan) return json(403,{ok:false});
  const ok = fields => json(200,{ok:true,...fields});
  if (path==='inbox') {
    const rows = await query(db,`SELECT conn,chat,name,at,coalesce(${scopeState},0) AS paused FROM zh_care_messages m
      WHERE store=? AND id=(SELECT MAX(id) FROM zh_care_messages WHERE store=m.store AND conn=m.conn AND chat=m.chat)
      ORDER BY at DESC,id DESC`,store).all();
    const global = await query(db,"SELECT paused FROM zh_care_controls WHERE store=? AND conn='' AND chat='' ORDER BY id DESC LIMIT 1",store).first();
    return ok({rows:rows.results,plan,paused:!!global?.paused,contact:await contact(db,store)});
  }
  if (path==='contact') {
    if ([b.phone,b.zalo].some(s=>typeof s!=='string'||s.length>160||/[\r\n]/.test(s))) return json(400,{ok:false});
    await query(db,'INSERT INTO zh_care_contacts VALUES(?,?,?) ON CONFLICT(store) DO UPDATE SET phone=excluded.phone,zalo=excluded.zalo',store,b.phone.trim(),b.zalo.trim()).run();
    return ok({});
  }
  const thread = typeof b.conn==='string' && !!b.conn && typeof b.chat==='string' && !!b.chat;
  if (thread && !(await query(db,'SELECT 1 FROM zh_care_messages WHERE store=? AND conn=? AND chat=? LIMIT 1',store,b.conn,b.chat).first())) return json(404,{ok:false});
  if (thread && path==='history') {
    const rows = await query(db,'SELECT content,reply,at FROM zh_care_messages WHERE store=? AND conn=? AND chat=? ORDER BY id',store,b.conn,b.chat).all();
    return ok({messages:rows.results});
  }
  if (path!=='pause' || typeof b.paused!=='boolean' || (!thread && (b.chat!==undefined || b.conn!==undefined))) return json(400,{ok:false});
  if (plan==='lite' || (thread && plan!=='pro')) return json(403,{ok:false});
  try {
    await query(db,'INSERT INTO zh_care_controls(store,conn,chat,paused,actor,at) VALUES(?,?,?,?,?,?)',store,thread?b.conn:'',thread?b.chat:'',Number(b.paused),who.uid,now).run();
  } catch (e) {
    if (String(e).includes('SEND_IN_FLIGHT')) return json(409,{ok:false,error:'SEND_IN_FLIGHT'});
    throw e;
  }
  return ok({});
}
