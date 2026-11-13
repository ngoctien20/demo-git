import assert from 'node:assert/strict';
import {period} from '../../merchant/revenue-panel.mjs';
const when=new Date('2026-12-31T17:00:00Z');
assert.deepEqual(period('today',when),['2027-01-01','2027-01-01']);
assert.deepEqual(period('yesterday',when),['2026-12-31','2026-12-31']);
assert.deepEqual(period('week',when),['2026-12-26','2027-01-01']);
assert.deepEqual(period('year',when),['2027-01-01','2027-01-01']);
