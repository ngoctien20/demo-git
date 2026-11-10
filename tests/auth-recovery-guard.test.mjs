import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../assets/auth-login.js', import.meta.url), 'utf8');

test('URL recovery markers alone never authorize password update', () => {
  assert.match(source, /let recoveryVerified = false/);
  assert.match(source, /if \(!client \|\| !inRecovery \|\| !recoveryVerified\)/);
});

test('only a Supabase recovery event unlocks the password form', () => {
  assert.match(source, /event === 'PASSWORD_RECOVERY' && inRecovery/);
  assert.match(source, /recoveryVerified = true/);
});

test('successful recovery resets verified state', () => {
  assert.match(source, /inRecovery = false;\s*recoveryVerified = false/);
});
