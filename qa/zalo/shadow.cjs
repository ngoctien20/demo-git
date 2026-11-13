// n8n private subworkflow. No public trigger, outbound transport, session writes
// or chat text in the output. The owner chat ID is injected at build time only.
function inspectShadow(event, approvedChat) {
  if (typeof approvedChat !== 'string' || !approvedChat) return {decision:'disabled'};
  if (!event || event.stage !== 'READ_ONLY' || event.accepted !== true ||
      event.eventName !== 'message.text.received' || event.chatType !== 'PRIVATE')
    return {decision:'unsupported'};
  if (event.chatId !== approvedChat) return {decision:'recipient_denied'};
  if (typeof event.messageId !== 'string' || !event.messageId.trim() ||
      typeof event.text !== 'string' || !event.text.trim() || event.text.length > 512)
    return {decision:'invalid'};
  return {decision:'eligible_for_shadow'};
}
module.exports={inspectShadow};
