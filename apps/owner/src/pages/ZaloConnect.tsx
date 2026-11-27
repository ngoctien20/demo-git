// Owner self-connect for Zalo Bot through TIEN404 Zalo Hub (gateway/zalo-hub, /v1/owner/*).
// The bot token goes straight from this form to the hub, which checks the owner's Supabase session and
// store role, seals the token and sets the bot's webhook. The App never stores the token; no key is shown.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { ZALO_HUB_URL } from '../config';
import { ZaloStoreLink } from './ZaloStoreLink';
import { Notice } from '../ui';

type Conn = { connection_id: string; status: string; bot_name: string | null; token_last4: string | null; flow_mode: string;
  owner_paired: boolean; users: number; sent_month: string | null; sent_count: number };

const ERR: Record<string, string> = {
  LINK_CHANGED: 'Liên kết hoặc danh mục đã thay đổi. Tải lại trang để xem dữ liệu mới.',
  BOT_DRAFT_OPEN: 'Chủ bot đang nhập sản phẩm trên Zalo. Hãy lưu hoặc hủy bản nháp trước khi sửa giá.',
  TOKEN_NOT_FOUND: 'Không thấy mã bot trong nội dung vừa dán. Hãy dán nguyên tin nhắn Zalo gửi mã bot.',
  TOKEN_REJECTED: 'Zalo báo mã bot không đúng hoặc đã bị đổi. Mở Zalo Bot Creator để lấy mã mới.',
  BOT_OWNED_BY_OTHER_STORE: 'Bot này đang nối với cửa hàng khác.',
  BOT_ALREADY_CONNECTED: 'Bot này đã nối với cửa hàng của bạn.',
  STORE_HAS_LIVE_BOT: 'Cửa hàng đã có một bot Zalo. Ngắt bot cũ trước khi nối bot khác.',
  STORE_MANAGED_BY_TIEN404: 'Bot Zalo của cửa hàng này do đội TIEN404 nối hộ. Liên hệ TIEN404 nếu muốn đổi.',
  SET_WEBHOOK_FAILED: 'Zalo chưa nhận kết nối. Thử lại sau ít phút.',
  NOT_STORE_MANAGER: 'Chỉ chủ shop hoặc quản lý mới nối được bot.',
  SIGN_IN_AGAIN: 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.',
  OWNER_CONNECT_DISABLED: 'Tính năng tự nối bot Zalo chưa được bật.',
  HUB_DISABLED: 'Cổng Zalo đang tạm dừng.',
  SHARED_FLOW_NOT_CONFIGURED: 'Cổng Zalo chưa sẵn sàng nhận shop mới.',
  AUTH_NOT_CONFIGURED: 'Cổng Zalo chưa sẵn sàng nhận shop mới.',
};
const STATUS: Record<string, [string, string]> = {
  active: ['ok', 'Đang chạy'], pending_owner: ['warn', 'Chờ nhắn mã 6 số'], needs_reconnect: ['err', 'Cần nối lại (mã bot đã đổi)'],
  quota_exceeded: ['err', 'Hết lượt tin tháng này'], disabled: ['', 'Đang tạm dừng'],
};

async function hub(method: 'GET' | 'POST', path: string, body?: object) {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error(ERR.SIGN_IN_AGAIN);
  let res: Response;
  try {
    res = await fetch(ZALO_HUB_URL + path, {
      method, headers: { authorization: 'Bearer ' + jwt, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new Error('Không kết nối được cổng Zalo. Kiểm tra mạng rồi thử lại.'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(ERR[j.error] ?? 'Có lỗi xảy ra. Vui lòng thử lại.');
  return j;
}

export function ZaloConnect({ storeId, canManage }: { storeId: string; canManage: boolean }) {
  const [conn, setConn] = useState<Conn | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [code, setCode] = useState<{ code: string; until: string } | null>(null);
  const [linked, setLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try { setConn((await hub('GET', '/v1/owner/status?store_id=' + encodeURIComponent(storeId))).connection); }
    catch (e) { setConn(null); setErr((e as Error).message); }
  }, [storeId]);
  useEffect(() => { load(); }, [load]);
  // While waiting for the 6-digit code, check every 5 s whether the owner has sent it.
  useEffect(() => {
    if (conn?.status !== 'pending_owner') return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [conn?.status, load]);
  useEffect(() => { if (conn?.status === 'active') setCode(null); }, [conn?.status]);

  const run = async (f: () => Promise<void>) => { setBusy(true); setErr(''); try { await f(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const paste = () => run(async () => { setText(await navigator.clipboard.readText()); });
  const connect = () => run(async () => {
    const r = await hub('POST', '/v1/owner/connect', { store_id: storeId, token_text: text });
    setText('');
    setCode({ code: r.pairing_code, until: r.pairing_expires_at });
    await load();
  });
  const newCode = () => run(async () => {
    const r = await hub('POST', '/v1/owner/pairing', { store_id: storeId });
    setCode({ code: r.pairing_code, until: r.pairing_expires_at });
  });
  const disconnect = () => {
    if (!confirm('Ngắt bot Zalo khỏi TIEN404? Trợ lý sẽ ngừng trả lời khách trên bot này.')) return;
    run(async () => { await hub('POST', '/v1/owner/disconnect', { store_id: storeId }); setCode(null); await load(); });
  };

  if (conn === undefined) return <p className="muted">Đang kiểm tra bot Zalo…</p>;
  const st = conn ? STATUS[conn.status] : undefined;
  return (
    <div className="zalo-connect">
      {canManage && <ZaloStoreLink key={storeId} storeId={storeId} request={hub} onLinked={setLinked} />}
      {err && <Notice kind="err">{err}</Notice>}
      {linked ? null : conn ? (
        <>
          <p><span className={`pill ${st?.[0] ?? ''}`}>{st?.[1] ?? conn.status}</span> <b>{conn.bot_name ?? 'Bot Zalo'}</b>
            <small className="muted"> · mã bot …{conn.token_last4}</small></p>
          {conn.status === 'pending_owner' && (
            <div className="panel soft">
              {code ? <>
                <p>Mở Zalo, vào <b>{conn.bot_name ?? 'bot của bạn'}</b>, nhắn đúng 6 số này:</p>
                <p className="pair-code" aria-label="Mã ghép">{code.code.slice(0, 3)} {code.code.slice(3)}</p>
                <small className="muted">Hết hạn lúc {new Date(code.until).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}. Trang này tự cập nhật khi bot nhận mã.</small>
              </> : <p>Bot chưa nhận mã 6 số.</p>}
              {canManage && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={newCode}>Lấy mã mới</button>}
            </div>
          )}
          {conn.flow_mode === 'shared' && <small className="muted">Đã có {conn.users}/50 khách nhắn · {conn.sent_count}/3.000 tin tháng này (giới hạn gói miễn phí của Zalo).</small>}
          {conn.status === 'needs_reconnect' && <Notice kind="warn">Mã bot đã bị đổi trong Zalo Bot Creator. Ngắt kết nối rồi nối lại bằng mã mới.</Notice>}
          {canManage && conn.flow_mode === 'shared' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={disconnect}>Ngắt kết nối</button>}
        </>
      ) : canManage ? (
        <ol className="steps">
          <li>Chưa có bot? Trong Zalo, tìm <b>Zalo Bot Manager</b> → <b>Tạo bot</b>. Zalo sẽ nhắn cho bạn <b>mã bot</b>. <a href="https://bot.zapps.me/" target="_blank" rel="noopener">Xem hướng dẫn của Zalo</a></li>
          <li>Mở tin nhắn đó, bấm giữ → <b>Sao chép</b>, rồi dán vào đây (dán nguyên tin nhắn cũng được):
            <textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Dán tin nhắn chứa mã bot" autoComplete="off" spellCheck={false} />
            <span className="row-btns">
              {'clipboard' in navigator && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={paste}>Dán</button>}
              <button className="btn btn-primary btn-sm" disabled={busy || text.trim().length < 10} onClick={connect}>{busy ? 'Đang nối…' : 'Nối bot'}</button>
            </span>
          </li>
          <li>Nhắn mã 6 số hiện ra vào bot của bạn trên Zalo. Bot chào "Đã nối xong" là xong.</li>
        </ol>
      ) : <p><span className="pill">Chưa kết nối</span> <small className="muted">Chủ shop hoặc quản lý nối bot.</small></p>}
    </div>
  );
}
