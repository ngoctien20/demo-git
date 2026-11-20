import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateQrAdmission, resolveInboundReadOnly, signSyntheticProof, PROOF_SCOPES } from './qr-admission-offline.mjs';

const KEY = 'only-synthetic-disposable-key-do-not-use-live';
const NOW = 1_800_000_000_000;
const store = { id: 'store-A', tenantId: 'tenant-1', status: 'active' };
const installation = { id: 'install-A', storeId: store.id, tenantId: store.tenantId, botId: 'bot-A', status: 'verified', revokedAt: null, operatorVerifiedOrigin: 'https://fixture.zalo.invalid' };
const proof = (scope, overrides={}) => signSyntheticProof({scope, installationId: installation.id, storeId: store.id, botId: installation.botId, eventId: '', url: '', issuedAt: NOW-60_000, expiresAt: NOW+60_000, nonce: 'synthetic-nonce-01', ...overrides}, KEY);
const candidate = (overrides={}) => evaluateQrAdmission({store, installation,ownerProof:proof(PROOF_SCOPES.OWNER),providerProof:proof(PROOF_SCOPES.PROVIDER),linkProof:proof(PROOF_SCOPES.LINK,{url:'https://fixture.zalo.invalid/bot-A'}),fixtureKey:KEY, now: NOW, ...overrides});

// Candidate != live authorization even when the synthetic fixture passes.
test('synthetic full evidence is candidate only, never permits sending/QR issuance',()=>{
 const r=candidate(); assert.equal(r.status,'OFFLINE_CANDIDATE');assert.equal(r.qrPayload,null);assert.equal(r.liveReady,false); assert.equal(r.canSend,false);assert.equal(r.canWrite,false);
});
for (const [title, patch] of [
 ['revoked installation',{installation:{...installation,revokedAt:NOW-5}}],
 ['unknown installation',{installation:{...installation,status:'draft'}}],
 ['disabled store',{store:{...store,status:'paused'}}],
 ['cross store',{installation:{...installation,storeId:'store-B'}}],
 ['cross tenant',{installation:{...installation,tenantId:'tenant-2'}}],
 ['missing owner proof',{ownerProof:null}],
 ['invalid provider proof',{providerProof:{...proof(PROOF_SCOPES.PROVIDER),signature:'0'.repeat(64)}}],
 ['missing link proof',{linkProof:null}],
 ['expired owner proof',{ownerProof:proof(PROOF_SCOPES.OWNER,{expiresAt:NOW-1})}],
 ['future owner proof',{ownerProof:proof(PROOF_SCOPES.OWNER,{issuedAt:NOW+1})}],
 ['owner wrong bot',{ownerProof:proof(PROOF_SCOPES.OWNER,{botId:'bot-B'})}],
 ['owner wrong store',{ownerProof:proof(PROOF_SCOPES.OWNER,{storeId:'store-B'})}],
 ['wrong trusted origin',{linkProof:proof(PROOF_SCOPES.LINK,{url:'https://attacker.invalid/bot-A'})}],
 ['plaintext bot token in link',{linkProof:proof(PROOF_SCOPES.LINK,{url:'https://fixture.zalo.invalid/bot-A?token=foo'})}],
 ['HTTP provider link',{linkProof:proof(PROOF_SCOPES.LINK,{url:'http://fixture.zalo.invalid/bot-A'})}],
 ['link userinfo',{linkProof:proof(PROOF_SCOPES.LINK,{url:'https://user:pass@fixture.zalo.invalid/bot-A'})}],
 ['link with URL fragment',{linkProof:proof(PROOF_SCOPES.LINK,{url:'https://fixture.zalo.invalid/bot-A#id'})}],
 ['link absent bot path',{linkProof:proof(PROOF_SCOPES.LINK,{url:'https://fixture.zalo.invalid/'})}],
 ['tampered signed URL',{linkProof:{...proof(PROOF_SCOPES.LINK,{url:'https://fixture.zalo.invalid/bot-A'}),url:'https://fixture.zalo.invalid/bot-B'}}],
 ['untrusted replacement signer',{fixtureKey:'bad-signer'}],
]) test(`fail closed: ${title}`,()=>{const r=candidate(patch);assert.equal(r.status,'DENIED');assert.equal(r.canSend,false);assert.equal(r.canWrite,false);assert.equal(r.qrPayload,null)});

const event = {id:'event-1',botId:'bot-A'};
const transportProof=proof(PROOF_SCOPES.TRANSPORT,{eventId:event.id});
const inbound=(overrides={})=>resolveInboundReadOnly({event,installation,store,transportProof,fixtureKey:KEY,now:NOW,seenEventIds:new Set(),...overrides});
test('transport-proven synthetic inbound resolves canonical store but cannot send/write',()=>{
 const r=inbound({event:{...event,storeId:'store-A'}}); assert.equal(r.status,'READ_ONLY_CANDIDATE');assert.equal(r.storeId,'store-A');assert.equal(r.canSend,false);assert.equal(r.canWrite,false);
});
for (const [title, patch] of [
 ['event spoofed bot',{event:{...event,botId:'bot-B'}}],
 ['query claiming another store',{event:{...event,storeId:'store-B'}}],
 ['body claiming another tenant',{event:{...event,tenantId:'tenant-2'}}],
 ['replayed event',{seenEventIds:new Set(['event-1'])}],
 ['wrong event signed receipt',{transportProof:proof(PROOF_SCOPES.TRANSPORT,{eventId:'event-2'})}],
 ['unsigned transport',{transportProof:null}],
 ['invalid transport signature',{transportProof:{...transportProof,signature:'0'.repeat(64)}}],
 ['stale transport proof',{transportProof:proof(PROOF_SCOPES.TRANSPORT,{expiresAt:NOW-1})}],
 ['revoked installation on inbound',{installation:{...installation,revokedAt:NOW-100}}],
 ['cross store on inbound',{store:{...store,id:'store-B'}}],
]) test(`inbound fail closed: ${title}`,()=>{const r=inbound(patch);assert.equal(r.status,'DENIED');assert.equal(r.canWrite,false);assert.equal(r.canSend,false)});
