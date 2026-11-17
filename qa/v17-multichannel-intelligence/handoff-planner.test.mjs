import test from 'node:test';
import assert from 'node:assert/strict';
import { planHandoff, canBotReply } from './handoff-planner.mjs';

function fixture(channel = 'messenger') {
  return {
    conversation: { source: 'TRUSTED_SERVER_CONVERSATION', tenantId: 'tenant-A',
      storeId: 'store-A', bindingId: 'binding-A', conversationId: 'conv-A',
      channel, status: 'BOT_ACTIVE', revision: 1, pendingRequestId: null,
      assignedStaffId: null, lastCommandId: null, botSuppressed: false },
    binding: { source: 'TRUSTED_SERVER_INSTALLATION', id: 'binding-A',
      tenantId: 'tenant-A', storeId: 'store-A', channel, accountRef: 'page-A',
      status: 'active', storeActive: true, subscriptionActive: true,
      metaHandoverApproved: true, metaAppId: 'meta-app-A',
      targetInboxAppId: 'meta-inbox', aiEnabled: true },
    authority: { source: 'TRUSTED_AUTHORIZATION', verified: true,
      sessionActive: true, actorId: 'owner-A', role: 'OWNER',
      tenantId: 'tenant-A', storeId: 'store-A' },
    command: { action: 'REQUEST_HUMAN', id: 'request-H', expectedRevision: 1,
      staffId: 'staff-A' }
  };
}
function receipt(f, action = 'ACK_HUMAN') {
  return { command: action, verified: true, bindingId: f.binding.id,
    conversationId: f.conversation.conversationId,
    relatedRequestId: f.conversation.pendingRequestId,
    receiptId: 'receipt-AA',
    source: f.binding.channel === 'messenger' ?
      'TRUSTED_META_HANDOVER_WEBHOOK' : 'TRUSTED_INTERNAL_STAFF_ACK',
    metaAppId: f.binding.metaAppId, metaPageRef: f.binding.accountRef,
    threadOwnerConfirmed: true, providerOperationConfirmed: false };
}
function humanPending(f = fixture()) {
  const r = planHandoff(f);
  assert.equal(r.accepted, true, JSON.stringify(r));
  f.conversation = r.proposed;
  return f;
}
function humanActive(f = fixture()) {
  humanPending(f);
  if (f.binding.channel !== 'messenger') {
    f.authority.actorId = 'staff-A'; f.authority.role = 'STAFF';
  }
  const r = planHandoff({ ...f, command: {
    action: 'ACK_HUMAN', id: 'ack-H', expectedRevision: 2
  }, receipt: receipt(f) });
  assert.equal(r.accepted, true, JSON.stringify(r));
  f.conversation = r.proposed;
  return f;
}
function denied(code, f) {
  const r = planHandoff(f);
  assert.equal(r.accepted, false);
  assert.equal(r.code, code);
  assert.equal(r.noSend, true);
  assert.equal(r.providerCallExecuted, false);
}
test('Messenger request handover suppresses bot BEFORE provider ACK', () => {
  const r = planHandoff(fixture());
  assert.equal(r.accepted, true);
  assert.equal(r.operationPlan, 'PLAN_META_PASS_THREAD_CONTROL_NOT_EXECUTED');
  assert.equal(r.proposed.status, 'HANDOFF_PENDING');
  assert.equal(r.proposed.botSuppressed, true);
  assert.equal(r.providerCallExecuted, false);
  assert.equal(r.cas.expectedRevision, 1);
  assert.equal(canBotReply(r.proposed), false);
});
test('Messenger needs verified webhook ACK to mark human active', () => {
  const f = humanPending();
  const r = planHandoff({ ...f, command: {
    action: 'ACK_HUMAN', id: 'ack-H', expectedRevision: 2
  }, receipt: receipt(f) });
  assert.equal(r.accepted, true);
  assert.equal(r.proposed.status, 'HUMAN_ACTIVE');
  assert.equal(r.proposed.pendingRequestId, null);
  assert.equal(canBotReply(r.proposed), false);
});
test('Meta human→bot requires two-stage external confirmation', () => {
  const f = humanActive();
  const pending = planHandoff({ ...f, command: {
    action: 'REQUEST_RESUME', id: 'resume-R', expectedRevision: 3
  } });
  assert.equal(pending.accepted, true);
  assert.equal(pending.proposed.status, 'RESUME_PENDING');
  assert.equal(canBotReply(pending.proposed), false);
  f.conversation = pending.proposed;
  const returned = planHandoff({ ...f, command: {
    action: 'ACK_RESUME', id: 'return-ACK', expectedRevision: 4
  }, receipt: receipt(f, 'ACK_RESUME') });
  assert.equal(returned.accepted, true);
  assert.equal(returned.proposed.status, 'BOT_ACTIVE');
  assert.equal(returned.proposed.botSuppressed, false);
  assert.equal(canBotReply(returned.proposed), true);
});
test('Zalo OA handover uses internal-only staff ACK, not Meta API', () => {
  const f = fixture('zalo_oa');
  const r = planHandoff(f);
  assert.equal(r.accepted, true);
  assert.equal(r.operationPlan, 'PLAN_INTERNAL_STAFF_ASSIGNMENT_ONLY');
  assert.equal(r.providerCallExecuted, false);
  f.conversation = r.proposed; f.authority.role = 'STAFF'; f.authority.actorId = 'staff-A';
  const a = planHandoff({ ...f, command: {
    action: 'ACK_HUMAN', id: 'ack-H', expectedRevision: 2
  }, receipt: receipt(f) });
  assert.equal(a.accepted, true);
});
test('Zalo Bot handover is internal, not native Meta', () => {
  const r = planHandoff(fixture('zalo_bot'));
  assert.equal(r.operationPlan, 'PLAN_INTERNAL_STAFF_ASSIGNMENT_ONLY');
});
test('Website handover is internal, not native Meta', () => {
  const r = planHandoff(fixture('website_widget'));
  assert.equal(r.operationPlan, 'PLAN_INTERNAL_STAFF_ASSIGNMENT_ONLY');
});
test('Meta native Handover capability must be approved and Page bound', () => {
  const f = fixture(); f.binding.metaHandoverApproved = false;
  denied('META_HANDOVER_NOT_APPROVED', f);
  const g = fixture(); g.binding.targetInboxAppId = '';
  denied('META_HANDOVER_NOT_APPROVED', g);
});
test('Unverified actor blocked', () => {
  const f = fixture(); f.authority.verified = false;
  denied('SCOPE_OR_AUTHORITY_DENIED', f);
});
test('Revoked session blocked', () => {
  const f = fixture(); f.authority.sessionActive = false;
  denied('SCOPE_OR_AUTHORITY_DENIED', f);
});
test('Cross-Store actor blocked even same Tenant', () => {
  const f = fixture(); f.authority.storeId = 'store-B';
  denied('SCOPE_OR_AUTHORITY_DENIED', f);
});
test('Cross-Tenant binding blocked', () => {
  const f = fixture(); f.binding.tenantId = 'tenant-B';
  denied('SCOPE_OR_AUTHORITY_DENIED', f);
});
test('Wrong channel mapping blocked', () => {
  const f = fixture(); f.binding.channel = 'zalo_oa';
  denied('SCOPE_OR_AUTHORITY_DENIED', f);
});
test('Revoked installation blocked', () => {
  const f = fixture(); f.binding.status = 'revoked';
  denied('SCOPE_OR_AUTHORITY_DENIED', f);
});
test('Expired subscription blocks transitions', () => {
  const f = fixture(); f.binding.subscriptionActive = false;
  denied('SCOPE_OR_AUTHORITY_DENIED', f);
});
test('AI cannot unilaterally handoff without policy approval', () => {
  const f = fixture(); f.authority.role = 'SYSTEM'; f.authority.policyApproved = false;
  denied('AI_ESCALATION_NOT_APPROVED', f);
});
test('Missing target staff blocks handoff', () => {
  const f = fixture(); f.command.staffId = '';
  denied('ASSIGNED_STAFF_REQUIRED', f);
});
test('Stale CAS revision blocked', () => {
  const f = fixture(); f.command.expectedRevision = 5;
  denied('STALE_REVISION', f);
});
test('Identical command replay blocked', () => {
  const f = humanPending();
  denied('DUPLICATE_COMMAND', f);
});
test('Cannot request second handoff while first pending', () => {
  const f = humanPending(); f.command.id = 'request-other'; f.command.expectedRevision = 2;
  denied('NOT_BOT_CONTROLLED', f);
});
test('No handoff ACK without independently authenticated receipt', () => {
  const f = humanPending();
  denied('HANDOFF_RECEIPT_NOT_TRUSTED', {
    ...f, command: { action: 'ACK_HUMAN', id: 'ack-H', expectedRevision: 2 }
  });
});
test('Meta ACK for wrong Page is rejected', () => {
  const f = humanPending(); const rec = receipt(f); rec.metaPageRef = 'page-OTHER';
  denied('HANDOFF_RECEIPT_NOT_TRUSTED', {
    ...f, receipt: rec, command: { action: 'ACK_HUMAN', id: 'ack-H', expectedRevision: 2 }
  });
});
test('Meta ACK without thread ownership confirmation rejected', () => {
  const f = humanPending(); const rec = receipt(f); rec.threadOwnerConfirmed = false;
  denied('HANDOFF_RECEIPT_NOT_TRUSTED', {
    ...f, receipt: rec, command: { action: 'ACK_HUMAN', id: 'ack-H', expectedRevision: 2 }
  });
});
test('Zalo cannot use forged Meta receipt to release bot', () => {
  const f = humanPending(fixture('zalo_oa')); const rec = receipt(f);
  rec.source = 'TRUSTED_META_HANDOVER_WEBHOOK';
  denied('HANDOFF_RECEIPT_NOT_TRUSTED', {
    ...f, receipt: rec, command: { action: 'ACK_HUMAN', id: 'ack-H', expectedRevision: 2 }
  });
});
test('Unassigned staff cannot ACK internal takeover', () => {
  const f = humanPending(fixture('zalo_bot'));
  f.authority.actorId = 'staff-B'; f.authority.role = 'STAFF';
  denied('STAFF_ACK_NOT_AUTHORIZED', {
    ...f, receipt: receipt(f), command: { action: 'ACK_HUMAN', id: 'ack-H', expectedRevision: 2 }
  });
});
test('Unassigned staff cannot resume', () => {
  const f = humanActive();
  f.authority.role = 'STAFF'; f.authority.actorId = 'staff-B';
  denied('RESUME_NOT_AUTHORIZED', {
    ...f, command: { action: 'REQUEST_RESUME', id: 'resume-R', expectedRevision: 3 }
  });
});
test('Open critical case cannot automatically reenable bot', () => {
  const f = humanActive();
  denied('CRITICAL_CASE_REQUIRES_HUMAN', {
    ...f, command: {
      action: 'REQUEST_RESUME', id: 'resume-R', expectedRevision: 3,
      unresolvedCriticalIssue: true
    }
  });
});
test('Out-of-order provider return rejected', () => {
  const f = humanPending();
  denied('RESUME_NOT_PENDING', {
    ...f, receipt: receipt(f, 'ACK_RESUME'),
    command: { action: 'ACK_RESUME', id: 'return-ACK', expectedRevision: 2 }
  });
});
test('Bot stays muted when stuck pending; no automatic timeout reopening', () => {
  const f = humanPending();
  assert.equal(canBotReply(f.conversation), false);
  assert.equal(f.conversation.botSuppressed, true);
});
test('Disable AI before resume prevents premature reenable', () => {
  const f = humanActive();
  const pending = planHandoff({ ...f,
    command: { action: 'REQUEST_RESUME', id: 'resume-R', expectedRevision: 3 }
  });
  f.conversation = pending.proposed; f.binding.aiEnabled = false;
  denied('BOT_REENABLE_NOT_APPROVED', {
    ...f, command: { action: 'ACK_RESUME', id: 'return-ACK', expectedRevision: 4 },
    receipt: receipt(f, 'ACK_RESUME')
  });
});
test('Invalid action and source-only actor cannot escalate', () => {
  const f = fixture(); f.command.action = 'DELETE_ORDER';
  denied('INVALID_COMMAND', f);
  const g = fixture(); g.authority.source = 'CLIENT_SELF_REPORTED';
  denied('SCOPE_OR_AUTHORITY_DENIED', g);
});
