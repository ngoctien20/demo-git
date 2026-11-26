import { useCallback, useEffect, useState } from 'react';
import { hub } from './ZaloConnect';
import { Notice } from '../ui';

type Thread = {conn:string; chat:string; name:string|null; at:number; paused:number};
type Contact = {phone:string; zalo:string};
type Inbox = {plan:string; paused:boolean; rows:Thread[]; contact:Contact};
type Message = {at:number; content:string; reply:string|null};

export function CareInbox({store}:{store:string}) {
  const [data,setData] = useState<Inbox>();
  const [contact,setContact] = useState<Contact>();
  const [selected,select] = useState<Thread>();
  const [history,setHistory] = useState<Message[]>([]);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const api = useCallback((name:string,body={}) => hub('POST','/v1/owner/care/'+name,{...body,store_id:store}),[store]);
  async function run(task:()=>Promise<void>) {
    setBusy(true); setError('');
    try { await task(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function refresh(thread?:Thread) {
    const inbox:Inbox = await api('inbox');
    setData(inbox);
    if (thread) setHistory((await api('history',{conn:thread.conn,chat:thread.chat})).messages);
  }
  useEffect(()=>{ void run(()=>refresh()); },[api]);
  const pause = (paused:boolean,thread?:Thread) => {
    const scope = thread ? 'cuộc hội thoại Zalo Bot này' : 'toàn shop trên kênh Zalo Bot';
    if (window.confirm((paused?'Tạm dừng':'Bật lại')+' trả lời tự động cho '+scope+'?'))
      void run(async()=>{await api('pause',{paused,...(thread && {chat:thread.chat,conn:thread.conn})}); await refresh(selected);});
  };
  const current = data?.rows.find(t=>t.conn===selected?.conn && t.chat===selected?.chat);
  return <section className="panel" aria-label="Hội thoại Zalo Bot"><h2>Hội thoại Zalo Bot</h2>
    {error && <Notice kind="warn">{error}</Notice>}
    <button disabled={busy} onClick={()=>run(()=>refresh(selected))}>Làm mới</button>
    {data && <>
      <p>Bot Zalo toàn shop · {data.paused?'Đang tạm dừng':'Đang bật'}</p>
      {data.plan!=='lite' && <button disabled={busy} onClick={()=>pause(!data.paused)}>{data.paused?'Bật lại':'Tạm dừng'} trả lời tự động toàn shop · Zalo Bot</button>}
      {!data.contact.phone && !data.contact.zalo && <Notice kind="warn">Hãy bổ sung số điện thoại hoặc Zalo công khai để khách liên hệ cửa hàng.</Notice>}
      <details><summary>Liên hệ CSKH công khai</summary>
        {(['phone','zalo'] as const).map(k=><label key={k}>{k==='phone'?'Số điện thoại':'Thông tin Zalo'}<input maxLength={160} value={(contact??data.contact)[k]} onChange={e=>setContact({...contact??data.contact,[k]:e.target.value})}/></label>)}
        <button disabled={busy||!contact} onClick={()=>run(async()=>{await api('contact',contact);setContact(undefined);await refresh(selected);})}>Lưu liên hệ công khai</button>
      </details>
      {!data.rows.length && <p>Chưa có khách nhắn qua Zalo Bot.</p>}
      <ul className="plain">{data.rows.map(t=><li key={t.conn+':'+t.chat}>
        <button disabled={busy} onClick={()=>run(async()=>{select(t);setHistory([]);await refresh(t);})}>{t.name||'Khách'} · {t.chat}</button>
        <small> Zalo Bot · {new Date(t.at).toLocaleString('vi-VN')} · {data.paused||t.paused?'Tạm dừng':'Bot đang bật'}</small>
      </li>)}</ul>
      {current && <><h3>{current.name||'Khách'} · Zalo Bot</h3>
        {data.plan==='pro' && <button disabled={busy} onClick={()=>pause(!current.paused,current)}>{current.paused?'Bật lại':'Tạm dừng'} bot với khách này</button>}
        {history.map((m,i)=><div key={i} style={{overflowWrap:'anywhere'}}><small>{new Date(m.at).toLocaleString('vi-VN')}</small><p>Khách · {m.content}</p>{m.reply && <p>Bot · {m.reply}</p>}</div>)}
      </>}
    </>}
  </section>;
}
