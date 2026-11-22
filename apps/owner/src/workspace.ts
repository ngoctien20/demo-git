// V25 Universal Workspace — UI mapping layer over the existing data contracts.
//
// The database still uses V20 Store Authority (tenants → stores → store_memberships) and the V21
// Config Core (assistants, assistant_config_versions, industry_templates). This file does NOT change
// any of that: it only decides which UI words and which industry modules to show for a Store.
//
// Industry of a Workspace = union of
//   1. tenants.industry written by register_shop (free text ≤ 60; old shops: fashion/beauty/… → shop)
//   2. template_key of every Assistant in the Store (shop/artist/service/education, server-validated)
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

export type Workspace = {
  industries: Industry[];
  primary: Industry;
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
