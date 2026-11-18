'use strict';
// V17.2C.40H — S3 consent-path guard candidate. SOURCE ONLY; NOT WIRED/DEPLOYED.
// This wrapper intentionally blocks V17.2C.21/V24 consent/review calls while
// the project decision is S3. It never grants authority or forwards to backend.
const EXPECTED_REF = 'synthetic-decision-s3-v1';
const deny = reason => ({status:'DENY',reason});

function createS3LockedConsentGuard({getCurrentDecision,backend}={}) {
  if(typeof getCurrentDecision!=='function' ||
     !backend || typeof backend.intake!=='function' ||
     typeof backend.reviewPair!=='function') {
    throw new Error('S3_GUARD_SERVER_ADAPTERS_MISSING');
  }

  async function inspectLock() {
    let snapshot;
    try {
      snapshot = await getCurrentDecision();
    } catch {
      return deny('DECISION_SNAPSHOT_UNAVAILABLE');
    }
    if(!snapshot || typeof snapshot!=='object' ||
       snapshot.decision_ref!==EXPECTED_REF ||
       snapshot.decision_version!==1 ||
       snapshot.decision!=='S3' ||
       snapshot.status!=='OWNER_DECISION_LOCKED' ||
       snapshot.lock_state!=='LOCKED' ||
       snapshot.authority_effect!=='NONE' ||
       snapshot.owner_authority_verified!==false ||
       snapshot.identity_verified!==false ||
       snapshot.real_authority_requested!==false) {
      return deny('OWNER_DECISION_LOCK_UNVERIFIED');
    }
    return deny('OWNER_DECISION_S3_LOCKED');
  }

  // Ignore all caller-provided fields. No user-supplied decision, actor,
  // Tenant, Store, owner, role, session or provider value can unlock S3.
  async function intake(_untrustedInput={}) {
    return inspectLock();
  }

  async function reviewPair(_untrustedInput={}) {
    return inspectLock();
  }

  return Object.freeze({intake,reviewPair});
}

module.exports={createS3LockedConsentGuard};
