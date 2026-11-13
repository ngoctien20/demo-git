// Server-side contract fixture only. No provider SDK, network, token or credential storage.
const {randomUUID} = require('node:crypto');

class ZaloConnectionMock {
  constructor() {
    this.pending = new Map();
  }

  begin(session, now = Date.now()) {
    if (!session?.user || !session.tenant || !['owner', 'manager'].includes(session.role))
      throw new Error('ACCESS_DENIED');
    for (const [id, item] of this.pending) {
      if (item.expires <= now) this.pending.delete(id);
    }
    const state = randomUUID();
    this.pending.set(state, {tenant: session.tenant, user: session.user, expires: now + 300000});
    return state;
  }

  callback(session, state, now = Date.now()) {
    const saved = this.pending.get(state);
    if (!saved || saved.expires <= now || !['owner', 'manager'].includes(session?.role)
        || saved.tenant !== session.tenant || saved.user !== session.user)
      throw new Error('INVALID_STATE');
    this.pending.delete(state);
    return {channel: 'zalo', status: 'waiting_for_owner', verified: false, enabled: false};
  }
}
module.exports = {ZaloConnectionMock};
