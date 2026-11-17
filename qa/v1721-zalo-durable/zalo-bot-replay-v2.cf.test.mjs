import {env} from 'cloudflare:workers';
import {evictDurableObject, runInDurableObject} from 'cloudflare:test';
import {describe,it,expect} from 'vitest';

// LOCAL Workers runtime only, no public endpoints, real providers or credentials.
// Each test obtains an isolated named DO. Real Cloudflare billing: zero.
const key = n => String(n).padStart(64,'0');
const digest = n => String(n).padStart(64,'a');
const fresh = name => env.ZALO_REPLAY_V2.getByName('V1721_LOCAL_ONLY_'+name);
const claim = (stub,n=1,d=1) => stub.claimHashedEvent({
 key:key(n),digest:digest(d),expiresAtMs:Date.now()+60_000
});

describe('ZaloBotReplayBucketV2 on local Cloudflare Workers runtime',()=>{
  it('persists a claim in SQLite and detects exact duplicate and conflict',async()=>{
    const stub=fresh('duplicate_conflict');
    expect(await claim(stub,1,1)).toBe('CLAIMED');
    expect(await claim(stub,1,1)).toBe('DUPLICATE');
    expect(await claim(stub,1,2)).toBe('CONFLICT');
    const rows=await runInDurableObject(stub,instance=>instance.ctx.storage.sql.exec(
      'SELECT event_key,payload_digest FROM zalo_bot_replay_claims_v2'
    ).toArray());
    expect(rows).toHaveLength(1);
    expect(rows[0].event_key).toBe(key(1));
  });
  it('handles 100 concurrent calls at one durable Object with exactly one claim',async()=>{
    const stub=fresh('parallel100');
    const verdicts=await Promise.all(Array.from({length:100},()=>claim(stub,2,3)));
    expect(verdicts.filter(x=>x==='CLAIMED')).toHaveLength(1);
    expect(verdicts.filter(x=>x==='DUPLICATE')).toHaveLength(99);
    expect(verdicts.filter(x=>x==='CONFLICT')).toHaveLength(0);
  });
  it('keeps separate Durable Object identities independently isolated',async()=>{
    const a=fresh('store_a'),b=fresh('store_b');
    expect(await claim(a,4,5)).toBe('CLAIMED');
    expect(await claim(b,4,6)).toBe('CLAIMED');
    expect(await claim(a,4,6)).toBe('CONFLICT');
    expect(await claim(b,4,6)).toBe('DUPLICATE');
  });
  it('retains claimed state after test-simulated DO eviction',async()=>{
    const stub=fresh('evict_recover');
    expect(await claim(stub,7,8)).toBe('CLAIMED');
    await evictDurableObject(stub);
    expect(await claim(stub,7,8)).toBe('DUPLICATE');
    expect(await claim(stub,7,9)).toBe('CONFLICT');
  });

});
