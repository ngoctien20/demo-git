'use strict';
/* Reproducible cross-PR contract report. No I/O outside local artifact. */
const fs=require('node:fs'),path=require('node:path');
const bridge=require('./studio-action-crosswalk.cjs');
const server=require('./signed-action-registry.cjs');
const result=bridge.inspectCompatibility();
const manifest={
  report:'TIEN404_V152_ADV5_STUDIO_ACTION_COMPATIBILITY',
  date:'2026-11-16',
  sourceOnly:true,qaOnly:true,notReleased:true,
  branchReconciliationRequired:true,
  sourceRefs:{studioPr:162,adapterActionPr:152,canonicalUatPr:159,
    successorGatewayPr:163},
  sourceSignedActionVersion:server.VERSION,
  actionMappings:result.actions,
  blockedMappings:result.actions.filter(x=>x.blocked).map(x=>x.uiAction),
  mappedPreviewHints:result.actions.filter(x=>!x.blocked).map(x=>x.uiAction),
  criticalGates:{
    productionAuthorization:false,verifiedOwnerJwt:false,
    hostedSameTenantStoreRls:false,providerAccountEntitlements:false,
    durableAtomicReplay:false,realOrderLookup:false,
    secureWriteTransaction:false,paidModelBenchmark:false,
    actualProviderSend:false,ownerUatApproved:false
  },
  writes:0,providerSends:0,realModelCalls:0,
  status:'QA_CONTRACT_CHECKS_ONLY__PRODUCTION_BLOCKED'
};
const folder='qa-artifacts-v152-adv5';
fs.mkdirSync(folder,{recursive:true});
const filename=path.join(folder,'studio-action-crosswalk-manifest.json');
fs.writeFileSync(filename,JSON.stringify(manifest,null,2)+'\n');
console.log('ADV5 source-only manifest',filename,'aliases',manifest.actionMappings.length,
  'blocked',manifest.blockedMappings.join(','));
