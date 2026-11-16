'use strict';
/*
 * V15.2 ADV.5.1 — additive compatibility adapter between
 * ADV.4 Studio UI action vocabulary (PR #162) and ADV.5 server receipt
 * vocabulary (PR #152). NO-SEND / NO-ISSUE / NO-AUTH / NO-PRODUCTION.
 * This must NOT be mistaken for a merge of the sibling branches.
 */
const adapter=require('../v147-custom-studio/advanced-safe-channel-adapters.js');
const server=require('./signed-action-registry.cjs');
const studioApi=require('../v147-custom-studio/studio-core.js');
const ALIASES=Object.freeze({
  VIEW_CATALOG:Object.freeze({serverAction:'CATALOG',semantic:'CATALOG_VIEW'}),
  REQUEST_QUOTE:Object.freeze({serverAction:'QUOTE',semantic:'PRICE_QUOTE'}),
  ASK_STAFF:Object.freeze({serverAction:'ASK_STAFF',semantic:'HUMAN_HANDOFF_HINT'}),
  VIEW_POLICY:Object.freeze({serverAction:'POLICY',semantic:'POLICY_VIEW'}),
  CATALOG:Object.freeze({serverAction:'CATALOG',semantic:'CATALOG_VIEW'}),
  QUOTE:Object.freeze({serverAction:'QUOTE',semantic:'PRICE_QUOTE'}),
  POLICY:Object.freeze({serverAction:'POLICY',semantic:'POLICY_VIEW'}),
  ORDER_REQUEST:Object.freeze({serverAction:'ORDER_REQUEST',semantic:'ORDER_REQUEST_HINT_ONLY'}),
  ORDER_REQUEST_DRAFT:Object.freeze({serverAction:null,semantic:'DRAFT_CREATION_NOT_EQUIVALENT'}),
  TRACK_ORDER:Object.freeze({serverAction:null,semantic:'PRIVATE_ORDER_LOOKUP_NOT_AVAILABLE'}),
  OPEN_VERIFIED_LINK:Object.freeze({serverAction:null,semantic:'APPROVED_LINK_BACKEND_NOT_AVAILABLE'})
});
const BLOCKED=new Set(['ORDER_REQUEST_DRAFT','TRACK_ORDER','OPEN_VERIFIED_LINK']);
const fail=s=>{throw new Error(s)};
function mapAction(uiAction){
  if(typeof uiAction!=='string'||!Object.hasOwn(ALIASES,uiAction))
    fail('ADV5_ACTION_VOCABULARY_DENIED');
  const spec=ALIASES[uiAction],serverAction=spec.serverAction;
  if(serverAction&&!server.ACTIONS.includes(serverAction))
    fail('ADV5_SERVER_ACTION_REGISTRY_DRIFT');
  return Object.freeze({
    source:'STUDIO_ACTION_VOCABULARY_QA',
    uiAction,semantic:spec.semantic,serverAction,
    executable:false,canIssueReceipt:false,needsVerifiedIdentity:true,
    needsStoreRlsProof:true,needsDurableAtomicNonce:true,
    requiresExplicitCustomerConfirmation:
      ['ORDER_REQUEST','ORDER_REQUEST_DRAFT'].includes(uiAction),
    blocked:BLOCKED.has(uiAction),reason:BLOCKED.has(uiAction)?
      spec.semantic:'SERVER_GATEWAY_NOT_AUTHORIZED_FROM_STUDIO'
  });
}
function preview({shop,channel,raw,uiAction,studio,api=studioApi}={}){
  // The provider adapter independently compiles trusted Store fixtures.
  // Never accept caller-supplied price/stock/store in an output object.
  if(!Object.hasOwn(studioApi.FIXTURES,shop))fail('ADV5_STORE_SCOPE_UNKNOWN');
  if(!server.CHANNELS.includes(channel))fail('ADV5_CHANNEL_SCOPE_UNKNOWN');
  const translation=mapAction(uiAction);
  const source=adapter.build({raw,shop,channel,...(studio?{studio}:{}),api});
  const fixture=studioApi.FIXTURES[shop];
  if(source.tenantId!==fixture.tenantId||source.storeId!==fixture.storeId||
     source.channel!==channel||source.delivery?.canSend!==false||
     source.delivery?.providerPayload!==null||
     source.delivery?.recipient!==null||
     source.security?.actionExecutable!==false||
     source.providerSends!==0||source.hostedWrites!==0)
    fail('ADV5_PREVIEW_SCOPE_OR_DELIVERY_INVALID');
  const recommendation=source.actionProposal?.actionKey||null;
  const mismatch=Boolean(recommendation&&
    translation.serverAction!==recommendation);
  return Object.freeze({
    contract:'T404_ADV5_STUDIO_ACTION_CROSSWALK_NO_SEND_V1',
    lifecycle:'EXPERIMENTAL',qaOnly:true,
    tenantId:source.tenantId,storeId:source.storeId,
    shop,channel,adapterKind:source.adapterKind,
    semanticComponent:source.selectedComponent,
    plainText:source.message?.text||'',
    adapterFallbackReasons:source.fallbackReasons,
    configuredAction:translation,
    suggestedModelAction:recommendation,
    suggestionMismatch:mismatch,
    interaction:Object.freeze({
      label:uiAction,disabled:true,providerPayload:null,signedToken:null,
      identityVerified:false,providerPermissionVerified:false,
      durableNonceCertified:false,merchantConsentVerified:false,
      approvedRecipient:null,approvedMediaUrl:null,approvedLinkUrl:null
    }),
    status:translation.blocked?'ACTION_SEMANTICS_UNSUPPORTED':
      mismatch?'SUGGESTION_DIFFERENT_FROM_CONFIG':'NO_SEND_PREVIEW_ONLY',
    orderCreated:false,orderLookedUp:false,readCustomerData:false,
    canSign:false,canExecute:false,canSend:false,canPublish:false,
    realModelCalls:0,hostedWrites:0,providerSends:0
  });
}
function inspectCompatibility(){
  return Object.freeze({
    contract:'T404_ADV5_CROSSWALK_AUDIT_V1',
    notMergedSiblingBranches:true,
    sourceStudioPr:162,sourceAdapterPr:152,
    noSentMessages:true,canRelease:false,canIssueReceipt:false,
    actions:Object.freeze(Object.keys(ALIASES).map(mapAction)),
    channels:server.CHANNELS.slice()
  });
}
function sign(){fail('ADV5_STUDIO_CROSSWALK_SIGN_DISABLED')}
function execute(){fail('ADV5_STUDIO_CROSSWALK_EXECUTE_DISABLED')}
function send(){fail('ADV5_STUDIO_CROSSWALK_SEND_DISABLED')}
module.exports=Object.freeze({ALIASES,mapAction,preview,inspectCompatibility,sign,execute,send});
