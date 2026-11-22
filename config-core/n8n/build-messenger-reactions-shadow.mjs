// Generate a Messenger Code-node SHADOW gate. Always pass-through; no provider send, no credential.
// Integration point: Classify explicit human request -> this gate -> Human handoff request?
// The public generator has ZERO Page identifiers. Page policies are private and default OFF.
import { readFileSync } from 'node:fs';
const lib = readFileSync(new URL('../lib/social-reactions.mjs', import.meta.url), 'utf8')
  .replace(/^export /gm, '');
const output = `// V21 Social Reactions: SHADOW GATE, NO SEND, ALL PAGES OFF.
${lib}
const PAGE_POLICIES = Object.freeze({}); // PageId -> trusted policy, none approved
function getVerifiedContext() {
  try {
    const hmac = $('Verify Meta Signature').first().json.verified === true;
    const timing = $('Verify Signature Timing-Safe').first().json.verified === true;
    const body = $('Webhook1').first().json.body;
    return { signatureVerified: hmac && timing, entries: body?.object === 'page' && Array.isArray(body.entry) ? body.entry : [] };
  } catch { return { signatureVerified: false, entries: [] }; }
}
function originalInbound(row, entries) {
  for (const entry of entries) {
    if (String(entry.id ?? '') !== String(row.pageId ?? '') || !Array.isArray(entry.messaging)) continue;
    for (const e of entry.messaging) {
      const m = e.message || {};
      if (e.postback || m.quick_reply?.payload || m.is_echo === true || m.is_deleted === true) continue;
      if (String(e.sender?.id ?? '') !== String(row.senderId ?? '') ||
          String(e.recipient?.id ?? '') !== String(row.pageId ?? '') ||
          String(m.mid ?? '') !== String(row.messageId ?? '') ||
          String(m.text ?? '').trim() !== String(row.chatInput ?? '').trim()) continue;
      let at = Number(e.timestamp);
      if (at > 0 && at < 1e12) at *= 1000;
      return { at, matched: true };
    }
  }
  return null;
}
const context = getVerifiedContext();
return $input.all().map((item, index) => {
  const row = item.json || {};
  const policy = Object.hasOwn(PAGE_POLICIES, String(row.pageId)) ? PAGE_POLICIES[String(row.pageId)] : null;
  if (!policy || policy.enabled !== true) return { json: row, pairedItem: { item: index } };
  // No inferred pending/ownership flags. All evidence must be supplied by trusted adapters.
  const inbound = originalInbound(row, context.entries);
  const now = Date.now();
  const validAge = inbound && Number.isFinite(inbound.at) && inbound.at <= now + 5000 && now - inbound.at >= 0 && now - inbound.at < 3600000;
  const event = {
    channel: 'messenger', kind: inbound ? 'message' : 'unknown', messageType: String(row.mediaType ?? ''),
    tenantId: policy.tenantId, pageId: String(row.pageId ?? ''),
    senderId: String(row.senderId ?? ''), messageId: String(row.messageId ?? ''), text: row.chatInput,
  };
  const gate = {
    featureEnabled: policy.enabled === true,
    signatureVerified: context.signatureVerified === true,
    tenantResolved: policy.trustedTenantResolved === true,
    pageAuthorized: policy.trustedPageAuthorized === true && !!inbound,
    botOwnsThread: policy.freshThreadOwnershipVerified === true,
    withinMessagingWindow: !!validAge,
    cooldownGranted: policy.atomicClaimSucceeded === true,
    allowedPageIds: Array.isArray(policy.allowedPageIds) ? policy.allowedPageIds : [],
    handoffActive: policy.handoffClear !== true || row.pauseAction === 'handoff',
    handoffPending: policy.handoffClear !== true,
    commercePending: policy.commerceClear !== true,
    approvalPending: policy.approvalClear !== true,
    menuAction: !!row.menuPayload || !!row.menuMode || row.mediaType === 'menu_reply',
    orderAction: !!row.selectedSku || !!row.fastPath || row.mediaType === 'product_detail',
    privilegedAction: !!row.privilegedAction,
    toolCallPlanned: !!row.toolCallPlanned || /^QA_CORE:/i.test(String(row.chatInput ?? '')),
  };
  const d = decideSocialReaction(event, gate);
  // Never route/send a reaction from this node. Even an approved candidate
  // continues through the pre-existing handoff/voice/menu/AI path.
  return { json: { ...row, socialReactionShadow: {
    version: SOCIAL_REACTIONS_VERSION, mode: d.mode, reason: d.reason,
    ...(d.mode === 'reaction_candidate' ? { emoji: d.emoji } : {}),
    outgoingSendEnabled: false,
  } }, pairedItem: { item: index } };
});
`;
process.stdout.write(output);
