// Offline fixtures. Pass a pure calculation function, never a workflow client.
const assert = require('node:assert/strict');

function checkRevenue(calculate) {
  const cases = [
    ['integer', 159000, 159000],
    ['grouped VND', '159.000', 159000],
    ['currency suffix', '159.000đ', 159000],
    ['zero decimals', '159,000.00', 159000],
    ['zero', 0, 0],
    ['missing total', null, null],
    ['invalid text', 'invalid', null],
    ['negative', -1, null],
  ];
  const failures = [];
  for (const [name, total, expected] of cases) {
    const evaluate = () => calculate([{status: 'paid', total, row_number: 2}]);
    try {
      if (expected === null) assert.throws(evaluate, /Invalid paid total/);
      else assert.equal(evaluate().revenue_vnd, expected);
    } catch {
      failures.push(name);
    }
  }
  const mixed = [{status: 'paid', total: 100}, {status: 'pending', total: 300},
    {status: 'cancelled', total: 'invalid'}];
  const summary = calculate(mixed);
  for (const [key, value] of Object.entries({total_orders: 3, paid_orders: 1,
    pending_orders: 1, cancelled_orders: 1, revenue_vnd: 100})) {
    if (summary[key] !== value) failures.push('mixed statuses');
  }
  return {total: cases.length + 1, failures: [...new Set(failures)]};
}

module.exports = {checkRevenue};
