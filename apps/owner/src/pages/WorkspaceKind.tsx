// Owner picks the workspace's main industry (V25). Writes tenants.industry through the owner-only
// RPC set_workspace_industry (db/v25-workspace/10). If the RPC is not on the server yet, the panel says so.
import { useState } from 'react';
import { friendlyError, supabase } from '../supabase';
import { useStore } from '../store';
import { isMissingFeature } from '../data';
import { industryFromTenant, INDUSTRY_META, WORKSPACE_KINDS } from '../workspace';
import { Notice } from '../ui';

export function WorkspaceKind() {
  const { store, reloadStores } = useStore();
  const current = industryFromTenant(store.tenant_industry);
  const [pick, setPick] = useState(WORKSPACE_KINDS.find(k => k.industry === current)?.value ?? 'retail');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string } | null>(null);
  const owner = store.role === 'owner';
  const changed = WORKSPACE_KINDS.find(k => k.value === pick)?.industry !== current;
  async function save() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('set_workspace_industry', { p_store: store.id, p_industry: pick });
    setBusy(false);
    if (error) return setMsg(isMissingFeature(error)
      ? { kind: 'warn', text: 'Chức năng đổi ngành chưa được bật trên máy chủ. Đội TIEN404 sẽ mở sau khi được duyệt.' }
      : { kind: 'err', text: friendlyError(error) });
    await reloadStores();
    setMsg({ kind: 'ok', text: 'Đã đổi ngành chính. Menu bên trái đã cập nhật theo ngành mới.' });
  }
  return (
    <section className="panel form" aria-labelledby="ws-kind">
      <h2 id="ws-kind">Ngành chính của không gian làm việc</h2>
      <p className="muted">Quyết định menu bên trái và cách gọi khách ({INDUSTRY_META[current].people.toLowerCase()}). Dữ liệu, trợ lý và kênh đã gắn không thay đổi.</p>
      <fieldset className="choice" disabled={!owner || busy}><legend className="sr-only">Ngành chính</legend>
        {WORKSPACE_KINDS.map(k => (
          <label key={k.value} className={pick === k.value ? 'on' : ''}>
            <input type="radio" name="ws-kind" value={k.value} checked={pick === k.value} onChange={() => setPick(k.value)} />
            <span><b>{k.label}</b><small className="muted"> · {k.hint}</small></span>
          </label>))}
      </fieldset>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="form-foot">
        <span className="muted">{owner ? 'Chỉ chủ sở hữu đổi được.' : 'Chỉ chủ sở hữu đổi được ngành chính.'}</span>
        {owner && <button className="btn btn-primary" disabled={busy || !changed} onClick={save}>Lưu ngành chính</button>}
      </div>
    </section>
  );
}
