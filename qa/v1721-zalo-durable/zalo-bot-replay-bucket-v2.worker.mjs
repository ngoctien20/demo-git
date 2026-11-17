/**
 * TIEN404 V17.21 Durable Object V2 SOURCE CANDIDATE.
 * NOT DEPLOYED. No binding migration, no public fetch handler.
 * Reuses the already-proven SQLite DO coordination pattern only; it does NOT
 * mutate current V17.5E.2 ReplayBucket or share its existing SQL rows.
 * Owner approval and private hosted QA are mandatory before any promotion.
 */
import {DurableObject} from 'cloudflare:workers';
import {initReplayV2Schema,claimReplayV2} from './zalo-sqlite-claim-v2.mjs';

export class ZaloBotReplayBucketV2 extends DurableObject {
 constructor(ctx,env){
  super(ctx,env);
  // Only schema initialization uses blockConcurrencyWhile.
  ctx.blockConcurrencyWhile(async()=>{initReplayV2Schema(ctx.storage.sql);});
 }
 async claimHashedEvent({key,digest,expiresAtMs}){
  // No await between SQL statements; no raw text, provider token or Store ID.
  return claimReplayV2(this.ctx.storage.sql,{key,digest,expiresAtMs},Date.now());
 }
}
// Intentionally NO default export, fetch route, OAuth, webhook or send logic.
