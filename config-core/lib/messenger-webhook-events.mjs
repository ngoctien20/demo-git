// TIEN404 V27.4 Messenger webhook event classifier (pure, no I/O, NOT wired into live Z7Fd).
// One entry.messaging[] / entry.standby[] item -> { kind, field, action, reply, ... }.
// `reply` says whether the bot may answer this event at all; everything that is not a customer
// turn (echo, read, delivery, reaction, policy, standby…) must never trigger a bot send.
//
// Webhook field (subscribed_apps)  -> what TIEN404 uses it for
//   messages                       customer text/attachments/quick replies          (ON)
//   messaging_postbacks            buttons, Get Started, persistent menu, ice breakers (ON)
//   messaging_referrals            m.me?ref=SKU, ads, shop links                     (ON)
//   message_reactions              ❤/👍 on bot messages = soft feedback signal       (ON)
//   messaging_handovers + standby  staff took the thread in Page Inbox -> bot silent  (ON)
//   message_echoes                 NEW: Page/staff replies → pause bot for that thread, audit
//   messaging_optins               NEW: "Nhận thông báo" (notification_messages) token for
//                                  restock / order-status follow-ups outside the 24h window
//   messaging_policy_enforcement   NEW: Meta warning/block → alert owner, stop sending
//   message_reads / deliveries     OPTIONAL: read receipts for analytics (high volume)
//   message_edits                  OPTIONAL: customer edited a message → re-read if unanswered

export const RECOMMENDED_FIELDS = Object.freeze([
  { field: 'messages', status: 'on' },
  { field: 'messaging_postbacks', status: 'on' },
  { field: 'messaging_referrals', status: 'on' },
  { field: 'message_reactions', status: 'on' },
  { field: 'messaging_handovers', status: 'on' },
  { field: 'standby', status: 'on' },
  { field: 'message_echoes', status: 'add', why: 'biết khi nhân viên trả lời để bot im, ghi lịch sử đầy đủ' },
  { field: 'messaging_optins', status: 'add', why: 'khách bấm "Nhận thông báo" → báo có hàng lại/đơn hàng sau 24h hợp lệ' },
  { field: 'messaging_policy_enforcement', status: 'add', why: 'Meta cảnh báo/chặn → báo chủ shop, dừng gửi' },
  { field: 'message_reads', status: 'optional', why: 'đo tỉ lệ khách đọc; nhiều sự kiện, chỉ bật khi cần số liệu' },
  { field: 'message_deliveries', status: 'optional', why: 'xác nhận đã tới máy khách; nhiều sự kiện' },
  { field: 'message_edits', status: 'optional', why: 'khách sửa tin chưa được trả lời' },
]);

const PSID = /^\d{5,30}$/;

/**
 * @param {object} e one messaging/standby item
 * @param {{pageId:string, standby?:boolean, appId?:string}} ctx
 */
export function classifyMessengerEvent(e, { pageId, standby = false, appId } = {}) {
  if (!e || typeof e !== 'object') return { kind: 'invalid', reply: false };
  const sender = String(e.sender?.id ?? ''), recipient = String(e.recipient?.id ?? '');
  const base = { sender, recipient, ts: Number(e.timestamp) || 0 };
  // Standby: another app (Page Inbox) owns the thread. Observe only.
  if (standby) return { ...base, kind: 'standby', field: 'standby', reply: false, action: 'observe_only' };

  if (e.message?.is_echo) {
    // Echo from the Page itself. Our own app's echo carries app_id; staff typing in Inbox does not
    // (or carries another app id). Staff reply => pause the bot for this customer.
    const fromThisApp = appId && String(e.message.app_id ?? '') === String(appId);
    return { ...base, kind: fromThisApp ? 'own_echo' : 'staff_reply', field: 'message_echoes', reply: false,
      action: fromThisApp ? 'ignore' : 'pause_bot_for_thread', customer: recipient };
  }
  if (sender === String(pageId)) return { ...base, kind: 'self', reply: false, action: 'ignore' };
  if (!PSID.test(sender)) return { ...base, kind: 'invalid', reply: false, action: 'ignore' };

  if (e.message) {
    if (e.message.quick_reply) return { ...base, kind: 'quick_reply', field: 'messages', reply: true, payload: String(e.message.quick_reply.payload ?? '') };
    if (Array.isArray(e.message.attachments) && e.message.attachments.length) return { ...base, kind: 'attachment', field: 'messages', reply: true };
    return { ...base, kind: 'text', field: 'messages', reply: true };
  }
  if (e.postback) return { ...base, kind: 'postback', field: 'messaging_postbacks', reply: true, payload: String(e.postback.payload ?? ''), referral: e.postback.referral?.ref };
  if (e.referral) return { ...base, kind: 'referral', field: 'messaging_referrals', reply: true, ref: String(e.referral.ref ?? ''), source: e.referral.source };
  if (e.reaction) return { ...base, kind: 'reaction', field: 'message_reactions', reply: false, action: 'record_feedback', reaction: e.reaction.reaction, verb: e.reaction.action };
  if (e.read) return { ...base, kind: 'read', field: 'message_reads', reply: false, action: 'record_metric' };
  if (e.delivery) return { ...base, kind: 'delivery', field: 'message_deliveries', reply: false, action: 'record_metric' };
  if (e.message_edit) return { ...base, kind: 'edit', field: 'message_edits', reply: false, action: 'reread_if_unanswered' };
  if (e.optin) {
    const o = e.optin;
    if (o.type === 'notification_messages') {
      const ok = o.notification_messages_status !== 'STOP NOTIFICATIONS';
      return { ...base, kind: ok ? 'optin_granted' : 'optin_stopped', field: 'messaging_optins', reply: ok,
        action: ok ? 'store_token_server_side' : 'revoke_token', topic: o.payload, expires: o.token_expiry_timestamp,
        // the token is a credential: never echo it in replies/logs
        hasToken: typeof o.notification_messages_token === 'string' };
    }
    return { ...base, kind: 'optin', field: 'messaging_optins', reply: true, ref: o.ref };
  }
  if (e.policy_enforcement) return { ...base, kind: 'policy', field: 'messaging_policy_enforcement', reply: false, action: 'alert_owner_and_pause', policy: e.policy_enforcement.action, reason: e.policy_enforcement.reason };
  if (e.pass_thread_control) return { ...base, kind: 'thread_to_bot', field: 'messaging_handovers', reply: false, action: 'resume_bot' };
  if (e.take_thread_control || e.request_thread_control) return { ...base, kind: 'thread_to_staff', field: 'messaging_handovers', reply: false, action: 'pause_bot_for_thread' };
  if (e.app_roles) return { ...base, kind: 'app_roles', field: 'messaging_handovers', reply: false, action: 'record' };
  return { ...base, kind: 'unknown', reply: false, action: 'ignore' };
}
