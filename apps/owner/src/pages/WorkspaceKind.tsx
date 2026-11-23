// Owner's Workspace profile (V25.1): any industry name, any mix of modules, own word for customers.
// Saved through the owner-only RPC save_workspace_profile (db/v25-workspace/10). Nothing about tenants,
// stores or store_id changes. If the server does not have it yet, the panel says so.
import { useEffect, useState } from 'react';
import { friendlyError, supabase } from '../supabase';
import { useStore } from '../store';
import { isMissingFeature } from '../data';
import { Industry, INDUSTRIES, MODULE_INFO, useWorkspace, WORKSPACE_PRESETS } from '../workspace';
import { Notice } from '../ui';

export function WorkspaceKind() {
  const { store } = useStore();
  const ws = useWorkspace();
  const [label, setLabel] = useState(ws.label);
  const [mods, setMods] = useState<Industry[]>(ws.industries);
  const [people, setPeople] = useState(ws.people);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string } | null>(null);
  useEffect(() => { setLabel(ws.label); setMods(ws.industries); setPeople(ws.people); }, [ws.label, ws.people, ws.industries.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const owner = store.role === 'owner';
  const dirty = label.trim() !== ws.label || people.trim() !== ws.people || [...mods].sort().join() !== [...ws.industries].sort().join() || !ws.custom;
  const valid = label.trim().length >= 2 && label.trim().length <= 60 && people.trim().length >= 2 && people.trim().length <= 40;
  const toggle = (m: Industry) => setMods(x => (x.includes(m) ? x.filter(y => y !== m) : [...x, m]));
  async function save() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('save_workspace_profile', { p_store: store.id, p_label: label.trim(), p_modules: mods, p_people_label: people.trim() });
    setBusy(false);
    if (error) return setMsg(isMissingFeature(error)
      ? { kind: 'warn', text: 'Hồ sơ ngành chưa được bật trên máy chủ. Đội TIEN404 sẽ mở trong đợt cập nhật tới.' }
      : { kind: 'err', text: friendlyError(error) });
    await ws.reload();
    setMsg({ kind: 'ok', text: 'Đã lưu hồ sơ ngành. Menu bên trái đã cập nhật.' });
  }
  return (
    <section className="panel form" aria-labelledby="ws-kind">
      <h2 id="ws-kind">Hồ sơ ngành</h2>
      <p className="muted">Bạn làm ngành gì cũng được: đặt tên ngành theo cách của bạn, bật những mô-đun cần dùng và gọi khách theo cách quen thuộc. Dữ liệu, trợ lý và kênh đã gắn không thay đổi.</p>
      {!ws.profileReady && <Notice kind="warn">Máy chủ chưa hỗ trợ lưu hồ sơ ngành; hiện App tự đoán ngành từ đăng ký và trợ lý của bạn.</Notice>}
      <fieldset disabled={!owner || busy}>
        <legend className="sub-legend">Gợi ý nhanh</legend>
        <div className="preset-row">
          {WORKSPACE_PRESETS.map(p => (
            <button type="button" key={p.label} className={`chip${label === p.label ? ' on' : ''}`}
              onClick={() => { setLabel(p.label); setMods(p.modules); setPeople(p.people); }}>
              <span aria-hidden="true">{p.icon}</span> {p.label}
            </button>))}
        </div>
        <div className="row2">
          <label>Tên ngành của bạn<input value={label} maxLength={60} onChange={e => setLabel(e.target.value)} placeholder="Ví dụ: Tiệm bánh, Phòng khám thú y, Câu lạc bộ cờ vua" /></label>
          <label>Bạn gọi khách là<input value={people} maxLength={40} onChange={e => setPeople(e.target.value)} placeholder="Ví dụ: Khách hàng, Bệnh nhân, Hội viên" /></label>
        </div>
        <fieldset className="choice"><legend>Mô-đun dùng trong không gian làm việc</legend>
          {INDUSTRIES.map(m => (
            <label key={m} className={mods.includes(m) ? 'on' : ''}>
              <input type="checkbox" checked={mods.includes(m)} onChange={() => toggle(m)} />
              <span><b>{MODULE_INFO[m].label}</b><small className="muted"> · {MODULE_INFO[m].hint}</small></span>
            </label>))}
        </fieldset>
        <p className="fine muted">Không bật mô-đun nào cũng được: trợ lý vẫn trả lời từ Kho kiến thức, menu và bàn giao cho nhân viên.</p>
      </fieldset>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="form-foot">
        <span className="muted">{owner ? 'Chỉ chủ sở hữu đổi được.' : 'Chỉ chủ sở hữu đổi được hồ sơ ngành.'}</span>
        {owner && <button className="btn btn-primary" disabled={busy || !dirty || !valid || !ws.profileReady} onClick={save}>Lưu hồ sơ ngành</button>}
      </div>
    </section>
  );
}
