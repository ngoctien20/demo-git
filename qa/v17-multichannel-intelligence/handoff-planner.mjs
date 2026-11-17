// TIEN404 V17 — clean-room, source-only, NO-SEND human handoff planner.
// This module NEVER calls Meta/Zalo, never persists a state or grants authority.
// All three inputs are server-resolved, not raw client claims. Requires atomic CAS
// on (tenantId, storeId, bindingId, conversationId, revision) to apply proposals.
const CHANNELS = new Set(['messenger', 'zalo_bot', 'zalo_oa', 'website_widget']);
const STATES = new Set(['BOT_ACTIVE', 'HANDOFF_PENDING', 'HUMAN_ACTIVE', 'RESUME_PENDING']);
const STAFF = new Set(['OWNER', 'MANAGER', 'STAFF']);
const ID = /^[A-Za-z0-9_.:-]{2,128}$/;
const REQ = new Set(['REQUEST_HUMAN', 'ACK_HUMAN', 'REQUEST_RESUME', 'ACK_RESUME']);
const validId = x => typeof x === 'string' && ID.test(x);
const fail = code => Object.freeze({
  accepted: false, code, noSend: true, noOrderWrite: true,
  publishAllowed: false, providerCallExecuted: false
});
function trustedScope(conversation, binding, authority) {
  return conversation && binding && authority &&
    conversation.source === 'TRUSTED_SERVER_CONVERSATION' &&
    binding.source === 'TRUSTED_SERVER_INSTALLATION' &&
    authority.source === 'TRUSTED_AUTHORIZATION' &&
    authority.verified === true && authority.sessionActive === true &&
    binding.status === 'active' && binding.storeActive === true &&
    binding.subscriptionActive === true &&
    CHANNELS.has(binding.channel) && conversation.channel === binding.channel &&
    [conversation.tenantId, conversation.storeId, conversation.bindingId,
      conversation.conversationId, authority.actorId].every(validId) &&
    [binding.tenantId, binding.storeId, binding.id,
      authority.tenantId, authority.storeId].every(validId) &&
    conversation.tenantId === binding.tenantId &&
    conversation.storeId === binding.storeId &&
    conversation.bindingId === binding.id &&
    authority.tenantId === conversation.tenantId &&
    authority.storeId === conversation.storeId &&
    ['OWNER', 'MANAGER', 'STAFF', 'SYSTEM'].includes(authority.role) &&
    STATES.has(conversation.status) &&
    Number.isSafeInteger(conversation.revision) && conversation.revision > 0 &&
    (conversation.pendingRequestId === null || validId(conversation.pendingRequestId)) &&
    (conversation.assignedStaffId === null || validId(conversation.assignedStaffId));
}
function checkReceipt(receipt, conversation, binding, type) {
  if (!receipt || receipt.command !== type || receipt.verified !== true ||
      receipt.bindingId !== conversation.bindingId ||
      receipt.conversationId !== conversation.conversationId ||
      receipt.relatedRequestId !== conversation.pendingRequestId ||
      !validId(receipt.receiptId)) return false;
  if (binding.channel === 'messenger') {
    return receipt.source === 'TRUSTED_META_HANDOVER_WEBHOOK' &&
      binding.metaHandoverApproved === true &&
      validId(binding.metaAppId) &&
      receipt.metaAppId === binding.metaAppId &&
      receipt.metaPageRef === binding.accountRef &&
      receipt.threadOwnerConfirmed === true;
  }
  // Zalo Bot/OA and Website: internal staff-assignment ACK, NOT native Meta handover.
  return receipt.source === 'TRUSTED_INTERNAL_STAFF_ACK' &&
    receipt.providerOperationConfirmed === false;
}
function cloneOutput(c, next, action, command, extra = {}) {
  return Object.freeze({
    accepted: true, code: 'OFFLINE_TRANSITION_PROPOSAL', noSend: true,
    noOrderWrite: true, publishAllowed: false, providerCallExecuted: false,
    mustPersistAtomicCAS: true,
    cas: Object.freeze({
      tenantId: c.tenantId, storeId: c.storeId, bindingId: c.bindingId,
      conversationId: c.conversationId, expectedRevision: c.revision
    }),
    proposed: Object.freeze({
      ...c, status: next, revision: c.revision + 1,
      botSuppressed: next !== 'BOT_ACTIVE',
      lastCommandId: command.id,
      ...extra
    }),
    operationPlan: action
  });
}
/**
 * action REQUEST_HUMAN, ACK_HUMAN, REQUEST_RESUME, ACK_RESUME.
 * command is a server-approved command; actor and binding MUST be separately
 * verified in a private backend. A passed JS object proves nothing in hosted use.
 */
export function planHandoff({ conversation: c, binding: b, authority: a,
  command, receipt = null } = {}) {
  if (!trustedScope(c, b, a)) return fail('SCOPE_OR_AUTHORITY_DENIED');
  if (!command || !REQ.has(command.action) || !validId(command.id) ||
      !Number.isSafeInteger(command.expectedRevision)) return fail('INVALID_COMMAND');
  if (command.id === c.lastCommandId ||
      command.id === c.pendingRequestId) return fail('DUPLICATE_COMMAND');
  if (command.expectedRevision !== c.revision) return fail('STALE_REVISION');
  if ((c.status === 'HUMAN_ACTIVE' || c.status === 'HANDOFF_PENDING' ||
      c.status === 'RESUME_PENDING') && c.botSuppressed !== true)
    return fail('BOT_SUPPRESSION_INVARIANT_BROKEN');
  if (command.action === 'REQUEST_HUMAN') {
    if (c.status !== 'BOT_ACTIVE' || c.botSuppressed !== false)
      return fail('NOT_BOT_CONTROLLED');
    if (!validId(command.staffId)) return fail('ASSIGNED_STAFF_REQUIRED');
    if (a.role === 'SYSTEM' && a.policyApproved !== true)
      return fail('AI_ESCALATION_NOT_APPROVED');
    const isMeta = b.channel === 'messenger';
    if (isMeta && (b.metaHandoverApproved !== true ||
        !validId(b.metaAppId) || !validId(b.accountRef) ||
        !validId(b.targetInboxAppId)))
      return fail('META_HANDOVER_NOT_APPROVED');
    return cloneOutput(c, 'HANDOFF_PENDING',
      isMeta ? 'PLAN_META_PASS_THREAD_CONTROL_NOT_EXECUTED' : 'PLAN_INTERNAL_STAFF_ASSIGNMENT_ONLY',
      command, { assignedStaffId: command.staffId, pendingRequestId: command.id });
  }
  if (command.action === 'ACK_HUMAN') {
    if (c.status !== 'HANDOFF_PENDING') return fail('HANDOFF_NOT_PENDING');
    if (!checkReceipt(receipt, c, b, 'ACK_HUMAN')) return fail('HANDOFF_RECEIPT_NOT_TRUSTED');
    if (b.channel !== 'messenger' &&
        (!STAFF.has(a.role) || (a.actorId !== c.assignedStaffId &&
          !['OWNER', 'MANAGER'].includes(a.role))))
      return fail('STAFF_ACK_NOT_AUTHORIZED');
    return cloneOutput(c, 'HUMAN_ACTIVE', 'ACK_ONLY_NO_PROVIDER_CALL',
      command, { pendingRequestId: null });
  }
  if (command.action === 'REQUEST_RESUME') {
    if (c.status !== 'HUMAN_ACTIVE') return fail('HUMAN_NOT_ACTIVE');
    if (!STAFF.has(a.role) || (a.actorId !== c.assignedStaffId &&
        !['OWNER', 'MANAGER'].includes(a.role)))
      return fail('RESUME_NOT_AUTHORIZED');
    if (command.unresolvedCriticalIssue === true)
      return fail('CRITICAL_CASE_REQUIRES_HUMAN');
    return cloneOutput(c, 'RESUME_PENDING',
      b.channel === 'messenger' ? 'PLAN_META_CONTROL_RETURN_NOT_EXECUTED' :
        'PLAN_INTERNAL_BOT_RESUME_ONLY', command, { pendingRequestId: command.id });
  }
  if (c.status !== 'RESUME_PENDING') return fail('RESUME_NOT_PENDING');
  if (!checkReceipt(receipt, c, b, 'ACK_RESUME')) return fail('RETURN_RECEIPT_NOT_TRUSTED');
  if (b.channel !== 'messenger' &&
      (!STAFF.has(a.role) || (a.actorId !== c.assignedStaffId &&
        !['OWNER', 'MANAGER'].includes(a.role))))
    return fail('STAFF_ACK_NOT_AUTHORIZED');
  if (b.aiEnabled !== true) return fail('BOT_REENABLE_NOT_APPROVED');
  return cloneOutput(c, 'BOT_ACTIVE', 'ACK_ONLY_NO_PROVIDER_CALL',
    command, { pendingRequestId: null, assignedStaffId: null });
}
export function canBotReply(conversation) {
  return conversation?.source === 'TRUSTED_SERVER_CONVERSATION' &&
    conversation.status === 'BOT_ACTIVE' && conversation.botSuppressed === false;
}
