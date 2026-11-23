import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { evictDurableObject } from 'cloudflare:test';

const named = suffix => 't404-v1855:v1855-' + suffix + '-sandbox';
const req = (installationId, requestId) => ({
  installationId, operation: 'catalog.search', requestId,
  issuedAt: Date.now()
});
const uid = () => crypto.randomUUID();

describe('V18.5.5 SQLite Durable Object real workerd runtime - offline', () => {
  it('persists a read admission and detects duplicate server UUID', async () => {
    const instance = env.T404_READ_ADMISSION.getByName(named('materials'));
    const request = req('v1855-materials-sandbox', uid());
    const first = await instance.authorizeRead(request);
    expect(first.allowed).toBe(true);
    expect(first.status).toBe(200);
    const repeated = await instance.authorizeRead(request);
    expect(repeated.allowed).toBe(false);
    expect(repeated.code).toBe('ADMISSION_REPLAY');
  });

  it('preserves the quota and replay ledger after Durable Object eviction', async () => {
    const name = named('materials');
    const stub = env.T404_READ_ADMISSION.getByName(name);
    const request = req('v1855-materials-sandbox', uid());
    const accepted = await stub.authorizeRead(request);
    expect(accepted.allowed).toBe(true);
    await evictDurableObject(stub);
    const recovered = env.T404_READ_ADMISSION.getByName(name);
    const duplicate = await recovered.authorizeRead(request);
    expect(duplicate.allowed).toBe(false);
    expect(duplicate.code).toBe('ADMISSION_REPLAY');
  });

  it('enforces 20 admitted and 10 rate-limited during concurrent RPC calls', async () => {
    // Separate instance per test to keep test store deterministic.
    // Installation ID is intentionally fixed by the server-side authority
    // contract, so preserve the exact known DO instance name here.
    const instance = env.T404_READ_ADMISSION.getByName(named('grocery'));
    const decisions = await Promise.all(Array.from({length: 30}, () =>
      instance.authorizeRead(req('v1855-grocery-sandbox', uid()))
    ));
    expect(decisions.filter(x => x.allowed).length).toBe(20);
    expect(decisions.filter(x => x.code === 'ADMISSION_RATE_LIMIT').length).toBe(10);
  });

  it('rejects caller-requested cross-installation DO name', async () => {
    const instance = env.T404_READ_ADMISSION.getByName(named('materials'));
    const wrong = await instance.authorizeRead(req('v1855-grocery-sandbox', uid()));
    expect(wrong.allowed).toBe(false);
    expect(wrong.code).toBe('ADMISSION_INSTALLATION_MISMATCH');
  });
});
