// AI Personality & Reaction Policy — PREVIEW ONLY (V21 reaction profiles from Draft PR #493,
// config-core/lib/reaction-profiles.mjs copied byte-for-byte). Nothing on this page is saved, nothing
// calls Meta, and automatic reactions stay OFF: enabling needs a Page-scoped backend + owner approval.
import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useWorkspace, Industry } from '../workspace';
import { Notice, PageHead } from '../ui';
import { REACTION_PROFILES, classifyReactionForProfile, suggestReactionProfile } from '../../../../config-core/lib/reaction-profiles.mjs';

type ProfileId = 'silent' | 'restrained' | 'friendly' | 'expressive';
const PROFILES: { id: ProfileId; title: string; who: string; desc: string }[] = [
  { id: 'silent', title: 'Trang trọng', who: 'Y tế, pháp lý, tài chính, cơ quan, chuyên môn', desc: 'Không dùng biểu cảm.' },
  { id: 'restrained', title: 'Chừng mực', who: 'Vật liệu xây dựng, bán sỉ, doanh nghiệp', desc: 'Chỉ ❤️ cho lời cảm ơn đơn thuần.' },
  { id: 'friendly', title: 'Thân thiện', who: 'Bán lẻ, tạp hóa, thời trang, ăn uống', desc: '❤️ cho lời cảm ơn, 👍 cho lời khen ngắn.' },
  { id: 'expressive', title: 'Sôi nổi', who: 'Nghệ sĩ, âm nhạc, giải trí, cộng đồng', desc: 'Thêm lời khen tự nhiên của người hâm mộ.' },
];
// Workspace industry → reaction-policy industry id used by #493 (UI suggestion only, never authority).
const POLICY_INDUSTRY: Record<Industry, string> = { shop: 'retail_general', artist: 'artist', service: 'professional_services', education: 'professional_services' };
const SAMPLES = ['Cảm ơn shop nhé!', 'Shop dễ thương quá!', 'Đỉnh quá!', 'Cảm ơn nhiều nha', 'Cảm ơn, đơn của mình tới đâu rồi?', 'Mình muốn khiếu nại', 'Đồng ý đặt 2 cái'];

export function Personality() {
  const { store } = useStore();
  const ws = useWorkspace();
  const suggestion = useMemo(() => suggestReactionProfile(POLICY_INDUSTRY[ws.primary]) as { recommendedProfileId: ProfileId; allowedProfiles: ProfileId[] }, [ws.primary]);
  const [picked, setPicked] = useState<ProfileId>(suggestion.recommendedProfileId);
  const [text, setText] = useState(SAMPLES[0]);
  const prof = REACTION_PROFILES[picked] as { maxPerHour: number; cooldownSeconds: number | null };
  const result = classifyReactionForProfile(text, picked) as string | null;

  return (
    <>
      <PageHead title="Phong cách & biểu cảm" sub={`Cách trợ lý của ${store.name} thể hiện cảm xúc với khách. Giọng văn và cách xưng hô chỉnh ở Cài đặt và Trợ lý AI.`} />
      <section className="panel toggle-panel">
        <div>
          <h2>Biểu cảm tự động (thả ❤️, 👍 vào tin nhắn)</h2>
          <p className="muted">Đang tắt. Chưa bật được trong phiên bản này: cần cấu hình theo từng Fanpage trên máy chủ, xác nhận chính sách của Meta và chủ dự án duyệt.</p>
        </div>
        <button type="button" role="switch" aria-checked={false} className="switch" disabled title="Chưa bật được"><span className="sr">Biểu cảm tự động: tắt</span></button>
      </section>
      <Notice kind="warn">Đây là bản xem trước. Lựa chọn trên trang này không được lưu và không gửi gì tới Messenger.</Notice>
      <section className="panel">
        <h2>Mức độ</h2>
        <p className="muted">Gợi ý cho ngành của Workspace: <b>{PROFILES.find(p => p.id === suggestion.recommendedProfileId)?.title}</b>. Bạn luôn có thể chọn mức trầm hơn, không chọn được mức sôi nổi hơn mức ngành cho phép.</p>
        <div className="tones four">
          {PROFILES.map(p => {
            const allowed = suggestion.allowedProfiles.includes(p.id);
            const def = REACTION_PROFILES[p.id] as { maxPerHour: number };
            return (
              <label key={p.id} className={`tone${picked === p.id ? ' on' : ''}${allowed ? '' : ' disabled'}`}>
                <input type="radio" name="profile" disabled={!allowed} checked={picked === p.id} onChange={() => setPicked(p.id)} />
                <b>{p.title}</b><span>{p.desc}</span>
                <small className="muted">{def.maxPerHour ? `Tối đa ${def.maxPerHour} lần/giờ (đề xuất)` : 'Không dùng'} · {p.who}</small>
                {!allowed && <small className="muted">Không phù hợp với ngành này</small>}
              </label>
            );
          })}
        </div>
      </section>
      <section className="panel form">
        <h2>Thử với một tin nhắn</h2>
        <label>Khách nhắn<input value={text} maxLength={160} onChange={e => setText(e.target.value)} /></label>
        <div className="chips">{SAMPLES.map(s => <button key={s} type="button" className="chip-btn" onClick={() => setText(s)}>{s}</button>)}</div>
        <p className="status-line">Với mức <b>{PROFILES.find(p => p.id === picked)?.title}</b>: {result ? <span className="pill ok">sẽ cân nhắc thả {result}</span> : <span className="pill">không thả biểu cảm</span>}
          {prof.cooldownSeconds ? <small className="muted"> · nghỉ ít nhất {Math.round(prof.cooldownSeconds / 60)} phút giữa hai lần</small> : null}</p>
        <p className="fine muted">Luôn ưu tiên trả lời bằng nội dung khi tin nhắn liên quan đơn hàng, thanh toán, quyền riêng tư, xác minh, khiếu nại hoặc cần nhân viên. Biểu cảm không bao giờ được hiểu là khách đồng ý hay xác nhận điều gì.</p>
      </section>
    </>
  );
}
