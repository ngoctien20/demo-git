'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {PROJECT,TABLES,HISTORICAL,classify} = require('./v176-evidence-gate.cjs');
const fresh = () => ({
  projectRef: PROJECT, capturedDateJst: '2026-11-17',
  owner: {tenants:2,products:2,orders:2,customers:0,allMemberships:3,activeOwnerMemberships:3,authUsers:3,storageBuckets:0,storageObjects:0,tenantsWithProductOrderOwner:2},
  tables: TABLES.map(name => ({name,rls:true,forceRls:true,hasStoreId:false,policyCount:1,permissiveCount:1,storeQualifiedPolicies:0,anonSelect:false,authSelect:true})),
  canonicalStoresPresent:false,storeMembershipsPresent:false,
  historicalH11R:HISTORICAL,historicalApplicationEntries:5,historicalAuthEntries:0,historicalStorageEntries:0
});
function blocked(s,claims){const r=classify(s,claims);assert.equal(r.status,'HOSTED_M0_STORE_JWT_NO_GO');for(const k of ['canApplyM1','canBackfill','canAlterRls','canCommitOrder','canRevokeRpc','canPublish','realJwtStoreIsolationTested','isolatedRestoreTested','selfReportCanAuthorize'])assert.equal(r[k],false);return r;}
test('real read-only aggregate snapshot classified, never migration-authorized',()=>{const r=blocked(fresh());assert.equal(r.snapshotStructurallyMatchesReadOnlyBaseline,true);assert.equal(r.tenantOwnerMembershipObserved,true);});
test('missing source cannot authorize',()=>assert.equal(blocked(undefined).snapshotStructurallyMatchesReadOnlyBaseline,false));
test('wrong project cannot authorize',()=>{const x=fresh();x.projectRef='wrong';assert.equal(blocked(x).snapshotStructurallyMatchesReadOnlyBaseline,false);});
test('stale/suspect capture cannot authorize',()=>{const x=fresh();x.capturedDateJst='2027-01-01';assert.equal(blocked(x).snapshotStructurallyMatchesReadOnlyBaseline,false);});
test('missing canonical table fails structurally',()=>{const x=fresh();x.tables.pop();assert.equal(blocked(x).snapshotStructurallyMatchesReadOnlyBaseline,false);});
test('duplicated table fails structurally',()=>{const x=fresh();x.tables[0].name='products';assert.equal(blocked(x).snapshotStructurallyMatchesReadOnlyBaseline,false);});
test('a missing RLS toggle fails structurally',()=>{const x=fresh();x.tables[1].rls=false;assert.equal(blocked(x).snapshotStructurallyMatchesReadOnlyBaseline,false);});
test('Store column state changed requires new live evidence',()=>{const x=fresh();x.tables[2].hasStoreId=true;assert.equal(blocked(x).snapshotStructurallyMatchesReadOnlyBaseline,false);});
test('policy changes require new live evidence',()=>{const x=fresh();x.tables[3].permissiveCount=0;assert.equal(blocked(x).snapshotStructurallyMatchesReadOnlyBaseline,false);});
test('owner count changes require new live evidence',()=>{const x=fresh();x.owner.activeOwnerMemberships=4;assert.equal(blocked(x).snapshotStructurallyMatchesReadOnlyBaseline,false);});
test('Auth change requires new recovery evidence',()=>{const x=fresh();x.owner.authUsers=4;assert.equal(blocked(x).snapshotStructurallyMatchesReadOnlyBaseline,false);});
test('Storage object appearing requires a recovery plan',()=>{const x=fresh();x.owner.storageObjects=1;assert.equal(blocked(x).snapshotStructurallyMatchesReadOnlyBaseline,false);});
test('historical H11R cannot be rewritten as full backup',()=>{const x=fresh();x.historicalAuthEntries=3;assert.equal(blocked(x).historicalH11RProvesCurrentHostedRecovery,false);});
test('claiming full backup / independent signers does not authorize',()=>{const x=fresh();const r=blocked(x,{fullService:true,backupVerified:true,restored:true,m1Approved:true,merchantSigned:true,reviewerSigned:true,storeJwtPassed:true});assert.equal(r.selfReportCanAuthorize,false);});
test('imaginary canonical Store tables do not auto-authorize',()=>{const x=fresh();x.canonicalStoresPresent=true;x.storeMembershipsPresent=true;assert.equal(blocked(x).snapshotStructurallyMatchesReadOnlyBaseline,false);});
test('no private ids, JWT, customer data, backup paths in output',()=>{const r=blocked(fresh(),{secret:'NO_LOG',privateId:'NO_LOG'});const text=JSON.stringify(r);assert.ok(!text.includes('NO_LOG'));assert.equal(r.sourceRecordsOrTokensEmitted,false);});
