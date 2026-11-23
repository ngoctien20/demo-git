// V25 Universal Workspace — UI mapping layer over the existing data contracts.
//
// The database still uses V20 Store Authority (tenants → stores → store_memberships) and the V21
// Config Core (assistants, assistant_config_versions, industry_templates). This file does NOT change
// any of that: it only decides which UI words and which industry modules to show for a Store.
//
// Industry of a Workspace:
//   * if the owner saved a Workspace profile (workspace_profiles, V25.1): their own industry name, ANY mix
//     of modules (including none) and their own word for customers — nothing is fixed;
//   * otherwise the union of tenants.industry (register_shop; legacy retail values → shop) and the
//     template_key of every Assistant in the Store.
// Nothing here is read from chat payloads or URL parameters, so it can never widen access: every
// read is still scoped by store_id + RLS, and every write still goes through the existing RPCs.
import { createContext, useContext } from 'react';

export type Industry = 'shop' | 'artist' | 'service' | 'education';
export const INDUSTRIES: Industry[] = ['shop', 'artist', 'service', 'education'];

export type Module = { path: string; label: string; icon: string };
export type IndustryMeta = {
  label: string; short: string; icon: string; people: string; peopleSub: string; modules: Module[];
};

export const INDUSTRY_META: Record<Industry, IndustryMeta> = {
  shop: {
    label: 'Cửa hàng / Thương mại', short: 'Cửa hàng', icon: '🛍️', people: 'Khách hàng',
    peopleSub: 'Khách đã nhắn qua các kênh. Chia theo giai đoạn để không bỏ sót ai.',
    modules: [{ path: '/san-pham', label: 'Sản phẩm & tồn kho', icon: '▣' }, { path: '/don-hang', label: 'Đơn hàng', icon: '▤' }],
  },
  artist: {
    label: 'Nghệ sĩ / Nhà sáng tạo', short: 'Nghệ sĩ', icon: '🎤', people: 'Người hâm mộ & liên hệ',
    peopleSub: 'Người đã nhắn với trang: người hâm mộ, đối tác, yêu cầu booking.',
    modules: [{ path: '/nghe-si', label: 'Hồ sơ & âm nhạc', icon: '♫' }],
  },
  service: {
    label: 'Dịch vụ', short: 'Dịch vụ', icon: '🧰', people: 'Khách hàng & yêu cầu',
    peopleSub: 'Người đã hỏi về dịch vụ hoặc gửi yêu cầu tư vấn.',
    modules: [{ path: '/dich-vu', label: 'Dịch vụ & lịch hẹn', icon: '◷' }],
  },
  education: {
    label: 'Giáo dục', short: 'Giáo dục', icon: '🎓', people: 'Học viên & phụ huynh',
    peopleSub: 'Người đã hỏi về khóa học, tuyển sinh hoặc cần tư vấn.',
    modules: [{ path: '/khoa-hoc', label: 'Khóa học & tuyển sinh', icon: '✎' }],
  },
};

/** Which industry module owns a route (undefined = universal route, always available). */
export function moduleOwner(path: string): Industry | undefined {
  return INDUSTRIES.find(i => INDUSTRY_META[i].modules.some(m => m.path === path));
}

const TENANT_MAP: [RegExp, Industry][] = [
  [/^(artist|creator|music|entertainment|community|events|nghe-si)$/i, 'artist'],
  [/^(service|services|spa|beauty_service|professional_services|hospitality|dich-vu)$/i, 'service'],
  [/^(education|edu|school|course|courses|giao-duc)$/i, 'education'],
];

/** tenants.industry → Industry. Unknown / empty / legacy retail values stay 'shop' (V23 behaviour). */
export function industryFromTenant(raw: string | null | undefined): Industry {
  const v = (raw ?? '').trim();
  for (const [re, ind] of TENANT_MAP) if (re.test(v)) return ind;
  return 'shop';
}

/** Template keys are validated server-side; anything else is ignored. */
export function industryFromTemplate(key: string | null | undefined): Industry | null {
  return key && (INDUSTRIES as string[]).includes(key) ? (key as Industry) : null;
}

/** Primary first (tenant industry), then industries of assistants in creation order, no duplicates. */
export function activeIndustries(tenantIndustry: string | null | undefined, templateKeys: (string | null)[]): Industry[] {
  const out: Industry[] = [industryFromTenant(tenantIndustry)];
  for (const k of templateKeys) {
    const i = industryFromTemplate(k);
    if (i && !out.includes(i)) out.push(i);
  }
  return out;
}

/** Choices on the "create workspace" step. Values go to register_shop(p_industry) unchanged. */
export const WORKSPACE_KINDS: { value: string; industry: Industry; label: string; hint: string }[] = [
  { value: 'retail', industry: 'shop', label: 'Cửa hàng / Thương mại', hint: 'Thời trang, mỹ phẩm, tạp hóa, bán sỉ…' },
  { value: 'artist', industry: 'artist', label: 'Nghệ sĩ / Nhà sáng tạo', hint: 'Ca sĩ, ban nhạc, KOL, cộng đồng' },
  { value: 'service', industry: 'service', label: 'Dịch vụ', hint: 'Spa, sửa chữa, tư vấn, studio' },
  { value: 'education', industry: 'education', label: 'Giáo dục', hint: 'Trung tâm, khóa học, luyện thi' },
];

export type Profile = { label: string; modules: Industry[]; people_label: string; updated_at?: string };

/** Starting points only: the owner can rename, add/remove modules and rename customers afterwards. */
export const WORKSPACE_PRESETS: { label: string; icon: string; modules: Industry[]; people: string }[] = [
  { label: 'Cửa hàng bán lẻ', icon: '🛍️', modules: ['shop'], people: 'Khách hàng' },
  { label: 'Thời trang', icon: '👗', modules: ['shop'], people: 'Khách hàng' },
  { label: 'Mỹ phẩm & làm đẹp', icon: '💄', modules: ['shop', 'service'], people: 'Khách hàng' },
  { label: 'Nhà hàng / quán cà phê', icon: '🍜', modules: ['shop', 'service'], people: 'Thực khách' },
  { label: 'Spa / thẩm mỹ viện', icon: '💆', modules: ['service'], people: 'Khách hàng' },
  { label: 'Phòng khám / nha khoa', icon: '🩺', modules: ['service'], people: 'Bệnh nhân' },
  { label: 'Gym / yoga', icon: '🏋️', modules: ['service', 'education'], people: 'Hội viên' },
  { label: 'Khách sạn / homestay / du lịch', icon: '🏨', modules: ['service'], people: 'Khách lưu trú' },
  { label: 'Bất động sản', icon: '🏠', modules: ['service'], people: 'Khách quan tâm' },
  { label: 'Sửa chữa / kỹ thuật', icon: '🔧', modules: ['service'], people: 'Khách hàng' },
  { label: 'Trung tâm giáo dục', icon: '🎓', modules: ['education'], people: 'Học viên & phụ huynh' },
  { label: 'Khóa học online / coach', icon: '💻', modules: ['education', 'shop'], people: 'Học viên' },
  { label: 'Nghệ sĩ / ban nhạc', icon: '🎤', modules: ['artist'], people: 'Người hâm mộ & liên hệ' },
  { label: 'KOL / nhà sáng tạo nội dung', icon: '📸', modules: ['artist', 'shop'], people: 'Người theo dõi' },
  { label: 'Sự kiện / tổ chức tiệc', icon: '🎉', modules: ['service', 'artist'], people: 'Khách mời & đối tác' },
  { label: 'Tổ chức / cộng đồng / từ thiện', icon: '🤝', modules: [], people: 'Thành viên & người ủng hộ' },
];

/** Plain-language name of each module for the profile editor. */
export const MODULE_INFO: Record<Industry, { label: string; hint: string }> = {
  shop: { label: 'Sản phẩm & đơn hàng', hint: 'Danh mục, giá, tồn kho, đơn khách đặt' },
  service: { label: 'Dịch vụ & lịch hẹn', hint: 'Bảng dịch vụ, giờ mở cửa, yêu cầu đặt lịch' },
  education: { label: 'Khóa học & tuyển sinh', hint: 'Khóa học, lịch khai giảng, đăng ký tư vấn' },
  artist: { label: 'Hồ sơ & nội dung', hint: 'Giới thiệu, nhạc/video, nội dung nổi bật, liên hệ quản lý' },
};

/** Decides modules, display name and customer word for the Workspace. */
export function resolveWorkspace(tenantIndustry: string | null | undefined, templateKeys: (string | null)[], profile: Profile | null) {
  if (profile) {
    const industries = INDUSTRIES.filter(i => profile.modules.includes(i));
    const primary = industries[0] ?? industryFromTenant(tenantIndustry);
    return { industries, primary, label: profile.label, people: profile.people_label, custom: true };
  }
  const industries = activeIndustries(tenantIndustry, templateKeys);
  const primary = industries[0];
  return { industries, primary, label: INDUSTRY_META[primary].label, people: INDUSTRY_META[primary].people, custom: false };
}

export type Workspace = {
  industries: Industry[];
  primary: Industry;
  label: string;   // owner's industry name, or the default one
  people: string;  // owner's word for customers, or the default one
  custom: boolean; // true = owner saved a Workspace profile
  profile: Profile | null;
  profileReady: boolean; // false = workspace_profiles not on the server yet
  assistants: { id: string; name: string; template_key: string | null }[];
  assistantsReady: boolean; // false = Config Core not reachable (missing feature / error)
  reload: () => Promise<void>;
};
export const WorkspaceCtx = createContext<Workspace | null>(null);
export function useWorkspace(): Workspace {
  const c = useContext(WorkspaceCtx);
  if (!c) throw new Error('WorkspaceCtx missing');
  return c;
}

export const ROLE_LABEL = { owner: 'Chủ sở hữu', manager: 'Quản lý', staff: 'Nhân viên' } as const;
