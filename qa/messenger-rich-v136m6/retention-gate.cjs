'use strict';
/**
 * V13.6M.6 — retention REVIEW only. NEVER DELETE events or keys here.
 * A replay after deleting a unique row could be treated as new, so this
 * planner merely groups synthetic rows for owner review. No DML/cron.
 */
const DAY=86400000;
const fail=code=>{const e=new Error(code);e.code=code;throw e};
const STATUSES=new Set(['CLAIMED','PREVIEW_READY','REJECTED']);
function planSyntheticRetention({
 mode='BLOCKED',rows,now=Date.now,retentionDays=30,
 policyApproved=false,tombstoneContinuityVerified=false
}={}){
 if(mode!=='SYNTHETIC_RETENTION_REVIEW')fail('M6_RETENTION_OFFLINE_ONLY');
 if(typeof now!=='function'||!Number.isSafeInteger(now())||now()<1||
    !Number.isInteger(retentionDays)||retentionDays<30||retentionDays>365||
    !Array.isArray(rows)||rows.length>5000)
   fail('M6_RETENTION_INPUT_INVALID');
 const result={UNFINISHED:0,TOO_RECENT:0,LEGAL_HOLD:0,
   OUTBOX_PENDING:0,INVALID_ROW:0,REPLAY_CONTINUITY_UNVERIFIED:0,
   ELIGIBLE_FOR_OWNER_REVIEW:0};
 const cutoff=now()-retentionDays*DAY;
 const seen=new Set();
 for(const row of rows){
  if(!row||typeof row.id!=='string'||row.id.length>128||seen.has(row.id)||
     !STATUSES.has(row.status)||!Number.isSafeInteger(row.claimedAtMs)||
     row.claimedAtMs>now()||row.claimedAtMs<1){
   result.INVALID_ROW++;
   continue;
  }
  seen.add(row.id);
  let reason;
  if(row.status==='CLAIMED'||row.completedAtMs===null||
     !Number.isSafeInteger(row.completedAtMs)||
     row.completedAtMs<row.claimedAtMs||row.completedAtMs>now())
   reason='UNFINISHED';
  else if(row.legalHold===true)reason='LEGAL_HOLD';
  else if(row.outboxPending===true)reason='OUTBOX_PENDING';
  else if(row.completedAtMs>cutoff||row.expiresAtMs>now()||
      !Number.isSafeInteger(row.expiresAtMs)||row.expiresAtMs<row.claimedAtMs)
   reason='TOO_RECENT';
  else if(policyApproved!==true||tombstoneContinuityVerified!==true)
   reason='REPLAY_CONTINUITY_UNVERIFIED';
  else reason='ELIGIBLE_FOR_OWNER_REVIEW';
  result[reason]++;
 }
 return Object.freeze({
  mode:'SYNTHETIC_RETENTION_REVIEW',
  counts:Object.freeze(result),
  assessedCount:rows.length,reviewEligibleCount:result.ELIGIBLE_FOR_OWNER_REVIEW,
  // Even if review prerequisites pass, no statement is executed.
  deletionAuthorized:false,deletionExecuted:false,
  automaticTombstonePruningEnabled:false,
  keyRemovalAuthorized:false,realHostedRetentionVerified:false
 });
}
module.exports={planSyntheticRetention};
