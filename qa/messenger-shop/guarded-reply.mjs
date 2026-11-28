// Stage only. book resolves verified Page/sender; model receives bounded text
// only. Retried provider calls, if enabled separately, must reserve again.
export async function guardedReply(book, model, envelope, message) {
  const reply = book.customerMessage(envelope, message);
  if (reply.status !== 'ask_clarification' || message.payload || !message.text) return reply;
  return model({shop:envelope.page,sender:envelope.sender,event:envelope.event},message.text);
}
