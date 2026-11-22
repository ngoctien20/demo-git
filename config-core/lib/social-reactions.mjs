// TIEN404 AI Social Reactions V21 — pure decision gate, NO NETWORK / NO SIDE EFFECTS.
// This module is intentionally NOT wired into the live Messenger workflow.
// An adapter must verify Meta HMAC, resolve tenant/Page identity, confirm bot thread ownership,
// atomically claim the dedupe key and obtain owner approval before enabling any real send.
// Customer reactions are never consent to order, payment, admin or deployment changes.

export const SOCIAL_REACTIONS_VERSION = 'v21-candidate-1';
export const SUPPORTED_CHANNELS = Object.freeze({ messenger: true, web: true, zalo_bot: false, zalo_oa: false });
export const REACTION_EMOJI = Object.freeze({ THANKS: '❤️', PRAISE: '👍' });

function stringId(x) {
  return typeof x === 'string' && x.length >= 2 && x.length <= 512 && /^[A-Za-z0-9._:$-]+$/.test(x);
}
const pass = (reason) => ({ mode: 'pass_through', reason });
const skip = (reason) => ({ mode: 'skip', reason });

// Intentional conservative allowlist: no bare "OK", thumbs up, "đồng ý" or "tiếp tục"
// because those can be business approvals or human-handoff instructions.
export function classifyLightweightReaction(text) {
  if (typeof text !== 'string' || text.length > 160) return null;
  const clean = text.normalize('NFC').toLocaleLowerCase('vi')
    .replace(/\s+/gu, ' ').trim().replace(/[\s.!！。🙏😊🥰❤♥👍\uFE0F]+$/gu, '').trim();
  if (!clean || clean.includes('?')) return null;
  if (/(?:đặt|mua|giá|tồn|ship|hàng|hủy|huỷ|đổi|trả|đơn|tiền|thanh toán|chuyển khoản|mã|otp|tiếp tục|đồng ý|duyệt|xác nhận|migration|supabase|deploy|xoá|xóa|quyền|nhân viên|quản lý|hỗ trợ|gấp|khẩn|lỗi|không)/iu.test(clean)) return null;
  if (/^(?:cảm ơn|cám ơn|thanks|thank you|thankyou|tks)(?:\s+(?:shop|ad|admin|bạn|nha|nhé|ạ|nhiều|rất|lắm))*$/u.test(clean)) return REACTION_EMOJI.THANKS;
  if (/^(?:yêu shop|shop dễ thương|dễ thương quá)(?:\s+(?:nha|nhé|quá|ạ))*$/u.test(clean)) return REACTION_EMOJI.PRAISE;
  return null;
}

/**
 * @param {object} event trusted, normalized inbound message (NOT the raw webhook body)
 * @param {object} gate trusted adapter state; all flags are FAIL-CLOSED
 * @returns {{mode:'skip'|'pass_through'|'reaction_candidate',reason:string,emoji?:string,dedupeKey?:string,recipientId?:string,messageId?:string,pageId?:string}}
 */
export function decideSocialReaction(event, gate = {}) {
  if (!event || event.channel !== 'messenger') return pass('channel_not_supported');
  if (event.kind === 'message_reaction' || event.kind === 'echo') return skip('non_customer_message');
  if (event.kind !== 'message' || event.messageType !== 'text') return pass('not_plain_text');
  if (gate.featureEnabled !== true) return pass('feature_disabled');
  if (gate.signatureVerified !== true || gate.tenantResolved !== true || gate.pageAuthorized !== true) return pass('authority_not_verified');
  if (gate.botOwnsThread !== true || gate.withinMessagingWindow !== true) return pass('cannot_react_in_thread');
  if (gate.cooldownGranted !== true) return pass('rate_guard');
  if (gate.handoffActive === true || gate.handoffPending === true || gate.commercePending === true || gate.approvalPending === true) return pass('business_state_guard');
  if (gate.menuAction === true || gate.orderAction === true || gate.privilegedAction === true || gate.toolCallPlanned === true) return pass('action_guard');
  if (!stringId(event.tenantId) || !stringId(event.pageId) || !stringId(event.senderId) ||
      !stringId(event.messageId) || event.pageId === event.senderId) return pass('invalid_identity');
  if (!Array.isArray(gate.allowedPageIds) || !gate.allowedPageIds.includes(event.pageId)) return pass('page_not_allowlisted');
  const emoji = classifyLightweightReaction(event.text);
  if (!emoji) return pass('requires_normal_reply');
  return Object.freeze({
    mode: 'reaction_candidate', reason: 'lightweight_social_intent',
    emoji, recipientId: event.senderId, pageId: event.pageId, messageId: event.messageId,
    dedupeKey: JSON.stringify([event.tenantId, event.pageId, event.senderId, event.messageId, 'react']),
  });
}

/**
 * DRY RUN ONLY: request-shape candidate from Meta sender-action examples.
 * Does not hold credentials, issue HTTP requests, or authorize a live send.
 * The stringified payload envelope was accepted by Meta v27.0 during a one-off tester UAT (HTTP 200, execution #6711). Actual mobile UI display remains to be confirmed.
 */
export function buildMetaReactionDryRun(decision) {
  if (!decision || decision.mode !== 'reaction_candidate' ||
      !['❤️', '👍'].includes(decision.emoji) || !stringId(decision.messageId) ||
      !stringId(decision.recipientId) || !stringId(decision.pageId)) {
    throw new TypeError('reaction_decision_required');
  }
  return {
    status: 'DRY_RUN_ONLY', sendAllowed: false, provider: 'meta_messenger',
    endpoint: '/{trusted_page_id}/messages', method: 'POST',
    body: {
      recipient: { id: decision.recipientId },
      sender_action: 'react',
      payload: JSON.stringify({ message_id: decision.messageId, reaction: decision.emoji }),
    },
    dedupeKey: decision.dedupeKey,
  };
}

// React errors never mean a user request was completed. Existing text path may continue,
// but do not silently retry uncertain transport outcomes (duplicate action risk).
export function evaluateReactionSendResult(result) {
  if (result && result.transportConfirmed === true && result.providerAccepted === true) {
    return { status: 'accepted_by_provider', followup: 'none' };
  }
  return { status: 'not_confirmed', followup: 'normal_text_path_no_auto_retry' };
}

// Inbound user reactions may inform noncritical analytics, NEVER create orders or approvals.
export function classifyCustomerReactionEvent(event, gate = {}) {
  if (!event || event.channel !== 'messenger' || event.kind !== 'message_reaction' ||
      gate.signatureVerified !== true || gate.tenantResolved !== true || gate.pageAuthorized !== true) {
    return skip('unverified_or_not_reaction');
  }
  if (!stringId(event.tenantId) || !stringId(event.pageId) || !stringId(event.senderId) ||
      !stringId(event.messageId) || !Array.isArray(gate.allowedPageIds) ||
      !gate.allowedPageIds.includes(event.pageId)) return skip('reaction_identity_invalid');
  return { mode: 'signal_only', signal: 'customer_reaction', createsOrder: false,
    changesPayment: false, grantsApproval: false, triggersTool: false };
}
