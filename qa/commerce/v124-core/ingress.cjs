'use strict';
const { createHmac, timingSafeEqual } = require('node:crypto');

const fields = ['version', 'channel', 'botRef', 'senderRef', 'eventRef', 'eventType', 'chatType', 'text', 'issuedAt'];
const verifiedCustomers = new WeakSet();
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9:_-]{2,128}$/.test(value);
const canonical = envelope => JSON.stringify(fields.map(key => envelope[key]));
const isVerifiedCustomer = value => verifiedCustomers.has(value);

function validBinding(binding, now) {
  if (binding.revoked === true || binding.revokedAt != null) return false;
  if (binding.revoked !== undefined && typeof binding.revoked !== 'boolean') return false;
  if (binding.validFrom != null && !(Date.parse(binding.validFrom) <= now)) return false;
  if (binding.expiresAt != null && !(now < Date.parse(binding.expiresAt))) return false;
  return binding.active === true && binding.mode === 'qa-preview' &&
    identifier(binding.tenantId) && identifier(binding.storeId);
}

function createQaIngressVerifier({registry, internalKey, clock = Date.now, maxSkewMs = 120000} = {}) {
  if (!Buffer.isBuffer(internalKey) || internalKey.length < 32) throw Error('QA_INTERNAL_KEY_REQUIRED');
  if (!Array.isArray(registry) || !registry.length) throw Error('QA_REGISTRY_REQUIRED');
  if (!Number.isSafeInteger(maxSkewMs) || maxSkewMs < 1 || maxSkewMs > 120000) throw Error('QA_SKEW_INVALID');
  const key = Buffer.from(internalKey);
  const hash = value => createHmac('sha256', key).update(value).digest('hex');
  return Object.freeze({verify(envelope) {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) ||
        Object.keys(envelope).length !== fields.length + 1 || !fields.every(f => Object.hasOwn(envelope, f)) ||
        !Object.hasOwn(envelope, 'signature') || envelope.version !== 1 || envelope.channel !== 'qa-fixture' ||
        envelope.eventType !== 'message.text.received' || envelope.chatType !== 'PRIVATE' ||
        ![envelope.botRef, envelope.senderRef, envelope.eventRef].every(identifier) ||
        typeof envelope.text !== 'string' || !envelope.text.trim() || envelope.text.length > 512 ||
        typeof envelope.issuedAt !== 'string' || typeof envelope.signature !== 'string' ||
        !/^[a-f0-9]{64}$/.test(envelope.signature)) throw Error('QA_ENVELOPE_INVALID');
    const now = clock(), issuedAt = Date.parse(envelope.issuedAt);
    if (!Number.isFinite(now) || !Number.isFinite(issuedAt) || Math.abs(now - issuedAt) > maxSkewMs)
      throw Error('QA_TIMESTAMP_REJECTED');
    if (!timingSafeEqual(Buffer.from(hash(canonical(envelope)), 'hex'), Buffer.from(envelope.signature, 'hex')))
      throw Error('QA_SIGNATURE_REJECTED');
    const matches = registry.filter(r => r.channel === envelope.channel && r.botRef === envelope.botRef);
    if (matches.length !== 1 || !validBinding(matches[0], now)) throw Error('QA_BOT_MAPPING_INVALID');
    const {tenantId, storeId} = matches[0];
    const scope = [tenantId, storeId, envelope.channel, envelope.botRef];
    const context = Object.freeze({
      trust: 'SIGNED_INTERNAL_QA_FIXTURE', role: 'CUSTOMER', tenantId, storeId, channel: envelope.channel,
      botRef: envelope.botRef, scopeKey: JSON.stringify(scope), issuedAt,
      actorHash: hash(JSON.stringify(['actor', ...scope, envelope.senderRef])),
      receiptHash: hash(JSON.stringify(['receipt', ...scope, envelope.senderRef, envelope.eventRef])),
      chatType: envelope.chatType, eventType: envelope.eventType, text: envelope.text
    });
    verifiedCustomers.add(context);
    return context;
  }});
}
module.exports = {createQaIngressVerifier, canonical, isVerifiedCustomer};
