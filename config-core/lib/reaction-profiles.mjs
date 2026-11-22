// TIEN404 V21.2 — Page-scoped reaction profiles (pure policy data, no provider side effects).
// Recommendations NEVER enable a Page. Actual configuration needs verified owner published consent.
// Only emoji with prior Meta tester UAT (❤️ and 👍) are supported here.
import { classifyLightweightReaction } from './social-reactions.mjs';

export const REACTION_PROFILES_VERSION = 't404.reaction-profiles.v1';

const definition = (id, enabled, cooldownSeconds, maxPerHour, intents, expandedCopy=false) =>
  Object.freeze({ id, enabled, cooldownSeconds, maxPerHour,
    intents: Object.freeze({ ...intents }), expandedCopy });

export const REACTION_PROFILES = Object.freeze({
  silent: definition('silent', false, null, 0, { thanks:false, praise:false }),
  restrained: definition('restrained', true, 600, 1, { thanks:true, praise:false }),
  friendly: definition('friendly', true, 300, 2, { thanks:true, praise:true }),
  expressive: definition('expressive', true, 90, 5, { thanks:true, praise:true }, true),
});

// Only a trusted tenant/Page registry may assign an industry. Strings from chat text are not authority.
const industries = [
  // Regulated, consequential, or sensitive Pages should not react with emojis.
  ['healthcare', 'silent', ['silent']],
  ['legal', 'silent', ['silent']],
  ['banking_finance', 'silent', ['silent']],
  ['insurance', 'silent', ['silent']],
  ['public_services', 'silent', ['silent']],
  ['crisis_support', 'silent', ['silent']],
  ['funeral_services', 'silent', ['silent']],
  ['professional_services', 'silent', ['silent']],
  // Order- or quote-heavy retailers: polite, not chatty.
  ['construction_materials', 'restrained', ['silent','restrained','friendly']],
  ['wholesale', 'restrained', ['silent','restrained','friendly']],
  ['hardware', 'restrained', ['silent','restrained','friendly']],
  ['grocery', 'friendly', ['silent','restrained','friendly']],
  ['retail_general', 'friendly', ['silent','restrained','friendly']],
  // Consumer/community-facing Pages may benefit from warmer, more frequent reactions.
  ['fashion', 'friendly', ['silent','restrained','friendly','expressive']],
  ['beauty', 'friendly', ['silent','restrained','friendly','expressive']],
  ['food_beverage', 'friendly', ['silent','restrained','friendly','expressive']],
  ['hospitality', 'friendly', ['silent','restrained','friendly','expressive']],
  ['artist', 'expressive', ['silent','restrained','friendly','expressive']],
  ['music', 'expressive', ['silent','restrained','friendly','expressive']],
  ['entertainment', 'expressive', ['silent','restrained','friendly','expressive']],
  ['creator', 'expressive', ['silent','restrained','friendly','expressive']],
  ['community', 'expressive', ['silent','restrained','friendly','expressive']],
  ['events', 'expressive', ['silent','restrained','friendly','expressive']],
];
export const INDUSTRY_REACTION_RULES = Object.freeze(Object.fromEntries(
  industries.map(([industryId,recommendedProfileId,allowedProfiles])=>[
    industryId,Object.freeze({industryId,recommendedProfileId,allowedProfiles:Object.freeze(allowedProfiles)})
  ])
));

const deny = reason => Object.freeze({ status:'blocked', reason });

/** UI recommendation only; never a deployment or consent decision. Unknown industries remain OFF. */
export function suggestReactionProfile(industryId) {
  const rule = INDUSTRY_REACTION_RULES[industryId];
  const candidate = REACTION_PROFILES[rule?.recommendedProfileId ?? 'silent'];
  return Object.freeze({ industryId: rule?.industryId ?? 'unclassified',
    recommendedProfileId:candidate.id, enabledByDefault:false,
    allowedProfiles:rule?.allowedProfiles ?? Object.freeze(['silent']),
    requiresOwnerPublish:true });
}

/** Strict published-policy profile validation; no client-controlled fallback. */
export function validatePublishedReactionProfile(industryId, profileId, settings) {
  const rule=INDUSTRY_REACTION_RULES[industryId], profile=REACTION_PROFILES[profileId];
  if(!rule || !profile) return deny('unknown_industry_or_profile');
  if(!rule.allowedProfiles.includes(profileId)) return deny('profile_disallowed_for_industry');
  if(!settings || typeof settings!=='object' || Array.isArray(settings) ||
      settings.profileId!==profileId) return deny('profile_not_bound_to_policy');
  if(profileId==='silent') return deny('silent_profile_cannot_enable');
  // Owner can be MORE conservative than a preset, never more aggressive.
  if(!settings.intents || typeof settings.intents!=='object' || Array.isArray(settings.intents) ||
      Object.keys(settings.intents).sort().join(',')!=='praise,thanks' ||
      typeof settings.intents.thanks!=='boolean' || typeof settings.intents.praise!=='boolean' ||
      (!settings.intents.thanks && !settings.intents.praise) ||
      (settings.intents.thanks && !profile.intents.thanks) ||
      (settings.intents.praise && !profile.intents.praise)) return deny('profile_intents_exceeded');
  if(!Number.isSafeInteger(settings.cooldownSeconds) ||
      settings.cooldownSeconds < profile.cooldownSeconds || settings.cooldownSeconds > 3600 ||
      !Number.isSafeInteger(settings.maxPerHour) || settings.maxPerHour < 1 ||
      settings.maxPerHour > profile.maxPerHour) return deny('profile_frequency_exceeded');
  return Object.freeze({status:'validated', industryId, profileId,
    expandedCopy:profile.expandedCopy, maxPerHour:settings.maxPerHour,
    cooldownSeconds:settings.cooldownSeconds,
    intents:Object.freeze({thanks:settings.intents.thanks,praise:settings.intents.praise})});
}

// Additional social-only phrases for high-interaction Pages; no business questions or approvals.
// This deliberately returns only the emoji that were one-off tested on Messenger.
const risky = /(?:\?|đặt|mua|giá|tồn|ship|hàng|hủy|huỷ|đổi|trả|đơn|tiền|thanh toán|chuyển khoản|mã|otp|tiếp tục|đồng ý|duyệt|xác nhận|migration|supabase|deploy|xoá|xóa|quyền|nhân viên|quản lý|hỗ trợ|gấp|khẩn|lỗi|không|khiếu nại|hoàn tiền|bảo hành|bệnh|đau)/iu;

export function classifyReactionForProfile(text, profileId) {
  const profile=REACTION_PROFILES[profileId];
  if(!profile || !profile.enabled) return null;
  const ordinary=classifyLightweightReaction(text);
  if(ordinary) return ordinary;
  if(!profile.expandedCopy || typeof text!=='string' || text.length>120) return null;
  const t=text.normalize('NFC').toLocaleLowerCase('vi')
    .replace(/\s+/gu,' ').trim().replace(/[.!！。🙏😊🥰❤♥👍\uFE0F]+$/gu,'').trim();
  if(!t || risky.test(t)) return null;
  if(/^(?:cảm ơn nhiều|cám ơn nhiều|cảm ơn mọi người|cảm ơn cả nhà|cảm ơn các bạn|thank you so much|thanks a lot)(?:\s+(?:nha|nhé|ạ|nhiều|lắm))?$/u.test(t))
    return '❤️';
  if(/^(?:shop xịn quá|đỉnh quá|tuyệt vời|hay quá|đỉnh thật|xuất sắc|quá tuyệt|fan cứng đây)(?:\s+(?:nha|nhé|ạ|luôn|quá))?$/u.test(t))
    return '👍';
  return null;
}
