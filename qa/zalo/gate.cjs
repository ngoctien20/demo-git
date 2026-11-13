// Input contract is the verified V1 normalizer output. Ingress identity comes from the caller.
function checkFixture(event, approvedChat) {
  if (!event || event.stage !== 'READ_ONLY' || event.accepted !== true ||
      event.eventName !== 'message.text.received' || event.chatType !== 'PRIVATE') return 'unsupported';
  if (approvedChat !== 'qa-owner' || event.chatId !== approvedChat) return 'recipient_denied';
  if (typeof event.messageId !== 'string' || !/^qa-[a-z0-9-]{1,60}$/.test(event.messageId)) return 'bad_event';
  if (typeof event.text !== 'string' || !event.text.trim() || event.text.length > 512) return 'bad_text';
  return 'ok';
}
module.exports={checkFixture};
