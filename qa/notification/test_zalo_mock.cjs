const {test} = require('node:test');
const assert = require('node:assert/strict');
const {ZaloConnectionMock} = require('./zalo_mock.cjs');

test('OAuth mock binds one-time state to the initiating owner, merchant and deadline', () => {
  const mock = new ZaloConnectionMock();
  const owner = {user: 'qa', tenant: 'a', role: 'owner'};
  assert.throws(() => mock.begin({...owner, role: 'staff'}));
  const state = mock.begin(owner, 0);
  for (const other of [{tenant:'b'}, {user:'other'}, {role:'staff'}])
    assert.throws(() => mock.callback({...owner,...other}, state, 1));
  assert.deepEqual(mock.callback(owner, state, 1), {channel:'zalo',status:'waiting_for_owner',verified:false,enabled:false});
  assert.throws(() => mock.callback(owner, state, 2));
  assert.throws(() => mock.callback(owner, mock.begin(owner, 0), 300000));
});
