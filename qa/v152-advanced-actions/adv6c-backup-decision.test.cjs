'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const baseline=require('../v152-pre6c-security/p0-release-baseline.readonly.json');
const {decideOneTimeBackup,CONTRACT}=require('./adv6c-backup-decision.cjs');
const sample=()=>structuredClone(baseline);
test('01 current staging evidence makes one-time export DENIED',()=>{
  const r=decideOneTimeBackup({baseline});
  assert.equal(r.contract,CONTRACT);
  assert.equal(r.decision,'DENY_ONE_TIME_REAL_BACKUP_EXPORT');
  assert.equal(r.oneTimeApprovalGranted,false);
  assert.equal(r.privateBackupExportAuthorized,false);
  assert.equal(r.recordsRead,0);
  assert.equal(r.recordsModified,0);
});
test('02 forged controller checkbox and reviewer checkboxes are never authority',()=>{
  const r=decideOneTimeBackup({
    baseline,controllerApproval:{approved:true,signer:'fake-controller'},
    securityApproval:{approved:true},
    operatorAuthorization:{approved:true},
    ownerEvidence:{verified:true,backup:{approved:true}}
  });
  assert.equal(r.decision,'DENY_ONE_TIME_REAL_BACKUP_EXPORT');
  assert.equal(r.unverifiedClaimCount,3);
  assert.equal(r.productionReleaseAuthorized,false);
});
test('03 metadata-only triple signature is not hosted JWT/backup certification',()=>{
  const r=decideOneTimeBackup({baseline,
    privatePacketReview:{status:'SIGNED_METADATA_ONLY_PENDING_INDEPENDENT_PRIVATE_INSPECTION',
      distinctSignerRoles:3,actualHostedJwtVerified:false}
  });
  assert.equal(r.evidenceMetadataSignaturesReceived,true);
  assert.equal(r.backupExportExecuted,false);
  assert.equal(r.restoreVerified,false);
  assert.equal(r.hostedJwtRlsProofPassed,false);
});
test('04 all-green fake snapshots cannot auto-release a real backup export',()=>{
  const b=sample();
  for(const [k,v] of Object.entries(b)){
    if(v&&typeof v==='object'&&!Array.isArray(v)){
      for(const c of Object.keys(v)){
       if(typeof v[c]==='boolean')v[c]=true;
      }
    }
  }
  const r=decideOneTimeBackup({baseline:b,
    privatePacketReview:{status:'SIGNED_METADATA_ONLY_PENDING_INDEPENDENT_PRIVATE_INSPECTION'}
  });
  assert.equal(r.oneTimeApprovalGranted,false);
  assert.equal(r.productionReleaseAuthorized,false);
  assert.equal(r.databaseRoleChangeAuthorized,false);
});
test('05 project mismatch and missing baseline remain hard DENY',()=>{
  for(const b of [{},{project_ref:'another-project'},undefined]){
    const r=decideOneTimeBackup({baseline:b});
    assert.equal(r.privateBackupExportAuthorized,false);
    assert.equal(r.decision,'DENY_ONE_TIME_REAL_BACKUP_EXPORT');
  }
});
test('06 no export, mutation, send or credentials in public verdict',()=>{
  const r=decideOneTimeBackup({baseline});
  assert.equal(r.providerSendAuthorized,false);
  assert.equal(r.databaseRoleChangeAuthorized,false);
  assert.equal(r.backupExportExecuted,false);
  assert(!JSON.stringify(r).includes('accessToken'));
  assert(!JSON.stringify(r).includes('databasePassword'));
});
