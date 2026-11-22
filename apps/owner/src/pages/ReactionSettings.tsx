import { useState } from 'react';
import { useStore } from '../store';
import { Notice, PageHead } from '../ui';
import {
  INDUSTRY_REACTION_RULES, REACTION_PROFILES,
  classifyReactionForProfile, suggestReactionProfile, validatePublishedReactionProfile,
} from '../../../../config-core/lib/reaction-profiles.mjs';

type ProfileId = keyof typeof REACTION_PROFILES;
type IndustryId = keyof typeof INDUSTRY_REACTION_RULES;

const INDUSTRIES: { value: IndustryId; label: string; group: string }[] = [
  { value: 'retail_general', label: 'Bán lẻ tổng hợp', group: 'Cửa hàng' },
  { value: 'grocery', label: 'Tạp hóa', group: 'Cửa hàng' },
  { value: 'construction_materials', label: 'Vật liệu xây dựng', group: 'Cửa hàng' },
  { value: 'wholesale', label: 'Bán sỉ / đại lý', group: 'Cửa hàng' },
  { value: 'hardware', label: 'Điện máy / phần cứng', group: 'Cửa hàng' },
  { value: 'fashion', label: 'Thời trang', group: 'Dịch vụ & cộng đồng' },
  { value: 'beauty', label: 'Làm đẹp', group: 'Dịch vụ & cộng đồng' },
  { value: 'food_beverage', label: 'Ăn uống', group: 'Dịch vụ & cộng đồng' },
  { value: 'hospitality', label: 'Lưu trú', group: 'Dịch vụ & cộng đồng' },
  { value: 'artist', label: 'Nghệ sĩ', group: 'Dịch vụ & cộng đồng' },
  { value: 'music', label: 'Âm nhạc', group: 'Dịch vụ & cộng đồng' },
  { value: 'entertainment', label: 'Giải trí', group: 'Dịch vụ & cộng đồng' },
  { value: 'creator', label: 'Nhà sáng tạo nội dung', group: 'Dịch vụ & cộng đồng' },
  { value: 'community', label: 'Cộng đồng', group: 'Dịch vụ & cộng đồng' },
  { value: 'events', label: 'Sự kiện', group: 'Dịch vụ & cộng đồng' },
  { value: 'healthcare', label: 'Y tế', group: 'Ngành cần trang trọng' },
  { value: 'legal', label: 'Pháp lý', group: 'Ngành cần trang trọng' },
  { value: 'banking_finance', label: 'Tài chính / ngân hàng', group: 'Ngành cần trang trọng' },
  { value: 'insurance', label: 'Bảo hiểm', group: 'Ngành cần trang trọng' },
  { value: 'public_services', label: 'Dịch vụ công', group: 'Ngành cần trang trọng' },
  { value: 'professional_services', label: 'Dịch vụ chuyên môn', group: 'Ngành cần trang trọng' },
  { value: 'crisis_support', label: 'Hỗ trợ khủng hoảng', group: 'Ngành cần trang trọng' },
  { value: 'funeral_services', label: 'Dịch vụ tang lễ', group: 'Ngành cần trang trọng' },
];
const PROFILES: { id: ProfileId; title: string; desc: string }[] = [
  { id: 'silent', title: 'Trang trọng', desc: 'Không dùng reaction. Giữ luồng trả lời bình thường.' },
  { id: 'restrained', title: 'Chừng mực', desc: 'Chỉ cân nhắc ❤️ khi khách cảm ơn đơn thuần.' },
  { id: 'friendly', title: 'Thân thiện', desc: '❤️ cho lời cảm ơn; 👍 cho lời khen ngắn.' },
  { id: 'expressive', title: 'Sôi nổi', desc: 'Thêm lời khen/cảm ơn tự nhiên; không react yêu cầu nghiệp vụ.' },
];
const EXAMPLES = [
  'Cảm ơn shop nhé!', 'Shop dễ thương quá!', 'Đỉnh quá!',
  'Cảm ơn shop, giá bao nhiêu?', 'Đồng ý đặt 2 món',
];

export function ReactionSettings() {
  const { store } = useStore();
  // PREVIEW ONLY. No trusted Page binding, localStorage, backend mutation or provider send.
  const [industryId, setIndustryId] = useState<IndustryId>('retail_general');
  const [profileId, setProfileId] = useState<ProfileId>('friendly');
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [thanks, setThanks] = useState(true);
  const [praise, setPraise] = useState(true);
  const [cooldown, setCooldown] = useState(REACTION_PROFILES.friendly.cooldownSeconds!);
  const [hourlyLimit, setHourlyLimit] = useState(REACTION_PROFILES.friendly.maxPerHour);
  const [message, setMessage] = useState(EXAMPLES[0]);

  const suggestion = suggestReactionProfile(industryId);
  const allowed = INDUSTRY_REACTION_RULES[industryId].allowedProfiles;
  const profile = REACTION_PROFILES[profileId];
  const silent = profileId === 'silent';
  const settings = { profileId, intents: { thanks, praise }, cooldownSeconds: cooldown, maxPerHour: hourlyLimit };
  const validation = silent ? null : validatePublishedReactionProfile(industryId, profileId, settings);
  const candidateEmoji = previewEnabled && !silent && validation?.status === 'validated'
    ? classifyReactionForProfile(message, profileId) : null;
  const allowedEmoji = candidateEmoji === '❤️' ? thanks : candidateEmoji === '👍' ? praise : false;

  const selectProfile = (id: ProfileId) => {
    if (!allowed.includes(id)) return;
    const p = REACTION_PROFILES[id];
    setProfileId(id);
    setPreviewEnabled(false);
    setThanks(p.intents.thanks);
    setPraise(p.intents.praise);
    setCooldown(p.cooldownSeconds ?? 3600);
    setHourlyLimit(p.maxPerHour);
  };
  const selectIndustry = (id: IndustryId) => {
    const suggested = suggestReactionProfile(id).recommendedProfileId as ProfileId;
    setIndustryId(id);
    const p = REACTION_PROFILES[suggested];
    setProfileId(suggested);
    setPreviewEnabled(false);
    setThanks(p.intents.thanks);
    setPraise(p.intents.praise);
    setCooldown(p.cooldownSeconds ?? 3600);
    setHourlyLimit(p.maxPerHour);
  };
  const reset = () => {
    setIndustryId('retail_general');
    setProfileId('friendly');
    setPreviewEnabled(false);
    setThanks(true);
    setPraise(true);
    setCooldown(300);
    setHourlyLimit(2);
    setMessage(EXAMPLES[0]);
  };

  const baseCooldown = profile.cooldownSeconds ?? 3600;
  const cooldownOptions = [...new Set([baseCooldown, Math.min(baseCooldown * 2, 3600), 3600])].sort((a, b) => a - b);
  const hasCandidate = !!candidateEmoji && allowedEmoji;

  return (
    <>
      <PageHead title="Biểu cảm Fanpage" sub={'Xem thử cách tương tác cho ' + store.name + ' trước khi kết nối Fanpage.'} />
      <Notice kind="warn"><b>Bản xem trước — chưa phát hành.</b> Chưa có Fanpage được xác thực trong màn hình này. Thay đổi bên dưới chỉ nằm trong phiên xem trước, không lưu vào cửa hàng, không gọi Meta và không bật bot thật.</Notice>

      <section className="panel form" aria-label="Mô phỏng chính sách Fanpage">
        <h2>1. Chọn ngành để xem gợi ý</h2>
        <p className="muted">Ngành bên dưới là ví dụ để thử giao diện, không phải ngành đã xác minh của Fanpage. Khi phát hành, hệ thống sẽ lấy từ hồ sơ kết nối được chủ trang duyệt.</p>
        <label htmlFor="reaction-industry">Ngành nghề (mô phỏng)</label>
        <select id="reaction-industry" value={industryId} onChange={e => selectIndustry(e.target.value as IndustryId)}>
          {['Cửa hàng', 'Dịch vụ & cộng đồng', 'Ngành cần trang trọng'].map(group => (
            <optgroup key={group} label={group}>
              {INDUSTRIES.filter(x => x.group === group).map(x =>
                <option key={x.value} value={x.value}>{x.label}</option>)}
            </optgroup>
          ))}
        </select>
        <p className="muted reaction-meta">Gợi ý: <b>{PROFILES.find(p => p.id === suggestion.recommendedProfileId)?.title}</b>. Mặc định thực tế của mọi Fanpage: <b>TẮT</b>.</p>

        <h2>2. Phong cách phản ứng</h2>
        <div className="reaction-options" role="group" aria-label="Phong cách reaction mô phỏng">
          {PROFILES.map(p => {
            const permitted = allowed.includes(p.id);
            return (
              <label key={p.id} className={'reaction-option' + (profileId === p.id ? ' selected' : '') + (!permitted ? ' forbidden' : '')}>
                <input type="radio" name="reaction-profile-preview" value={p.id} checked={profileId === p.id}
                  disabled={!permitted} onChange={() => selectProfile(p.id)} />
                <span><b>{p.title}</b><small>{p.desc}</small>{!permitted && <small>Không cho phép trong ngành này</small>}</span>
              </label>
            );
          })}
        </div>
        {allowed.length === 1 && <Notice>Ngành này chỉ hỗ trợ chế độ Trang trọng. Bot vẫn trả lời bằng chữ và không tự thả biểu cảm.</Notice>}
      </section>

      <section className="panel form" aria-label="Giới hạn mô phỏng">
        <h2>3. Tần suất và lời nhắn đủ điều kiện</h2>
        <div className="toggle-panel">
          <div>
            <b>Bật reaction trong mô phỏng</b>
            <p className="muted">Không phải công tắc thật của Fanpage.</p>
          </div>
          <button type="button" role="switch" aria-label="Bật reaction trong mô phỏng"
            aria-checked={previewEnabled && !silent} className={'switch' + (previewEnabled && !silent ? ' on' : '')}
            disabled={silent} onClick={() => setPreviewEnabled(x => !x)} />
        </div>
        {!silent && <>
          <div className="reaction-intents">
            <label className="reaction-check">
              <input type="checkbox" checked={thanks} disabled={!profile.intents.thanks} onChange={e => setThanks(e.target.checked)} />
              Cảm ơn → ❤️
            </label>
            <label className="reaction-check">
              <input type="checkbox" checked={praise} disabled={!profile.intents.praise} onChange={e => setPraise(e.target.checked)} />
              Khen ngợi → 👍
            </label>
          </div>
          <div className="row2">
            <label>Giãn cách tối thiểu
              <select value={cooldown} onChange={e => setCooldown(Number(e.target.value))}>
                {cooldownOptions.map(n => <option key={n} value={n}>{n / 60} phút</option>)}
              </select>
            </label>
            <label>Giới hạn tối đa trong một giờ
              <select value={hourlyLimit} onChange={e => setHourlyLimit(Number(e.target.value))}>
                {Array.from({ length: profile.maxPerHour }, (_, i) => i + 1).map(n =>
                  <option key={n} value={n}>{n} reaction/hội thoại</option>)}
              </select>
            </label>
          </div>
          <small className="muted">Chỉ xem trước giới hạn, không mô phỏng khóa chống trùng hay thời gian gửi thật.</small>
          {validation?.status === 'blocked' && <Notice kind="warn">Cấu hình mô phỏng chưa hợp lệ. Hãy chọn ít nhất một loại tương tác được phép và không vượt giới hạn.</Notice>}
        </>}
      </section>

      <section className="panel form" aria-label="Xem trước lời nhắn">
        <h2>4. Thử lời nhắn khách hàng</h2>
        <div className="reaction-samples">
          {EXAMPLES.map(s => <button type="button" key={s} className="chip-btn" onClick={() => setMessage(s)}>{s}</button>)}
        </div>
        <label htmlFor="reaction-message">Tin nhắn mô phỏng
          <textarea id="reaction-message" rows={3} maxLength={160} value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Thử nhập lời cảm ơn, khen ngợi hoặc câu hỏi giá…" />
        </label>
        <div className="reaction-preview" aria-live="polite">
          <div className="reaction-bubble">
            <span>{message.trim() || 'Khách chưa nhập tin nhắn'}</span>
            {hasCandidate && <b className="reaction-emoji" aria-label={'Đề xuất biểu cảm ' + candidateEmoji}>{candidateEmoji}</b>}
          </div>
          <p>
            {hasCandidate
              ? 'Gợi ý mô phỏng: ' + candidateEmoji + ' trên tin nhắn; chỉ được gửi sau khi xác minh quyền, trạng thái nghiệp vụ và giới hạn thật.'
              : previewEnabled && !silent
                ? 'Không có reaction đề xuất. Tin này tiếp tục sang luồng trả lời thông thường.'
                : 'Reaction đang tắt trong mô phỏng. Tin nhắn vẫn đi luồng trả lời thông thường.'}
          </p>
        </div>
        <div className="form-foot">
          <span className="muted">Chưa lưu cấu hình. Không gửi yêu cầu tới Meta hoặc Supabase.</span>
          <button type="button" className="btn btn-ghost" onClick={reset}>Đặt lại mô phỏng</button>
        </div>
      </section>
      <Notice>Để bật thật cho từng Fanpage, cần xác minh Page–tenant–chủ trang, lưu bản nháp có phiên bản, chủ trang xác nhận riêng phong cách và giới hạn, khóa chống trùng bền vững và nghiệm thu Messenger. Chức năng Lưu/Kích hoạt chỉ xuất hiện sau khi backend và quyền được phê duyệt.</Notice>
    </>
  );
}
