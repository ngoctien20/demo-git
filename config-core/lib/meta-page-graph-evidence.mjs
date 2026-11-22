// TIEN404 V21.7 — READ-ONLY Meta Graph response assessment, server-side only.
// Pure function: NO HTTP, NO Meta token, NO OAuth callback, NO credentials.
// Caller must retrieve Graph responses through a trusted authenticated server
// transport; never accept these "evidence" values from browsers, chat, or LLMs.

export const META_GRAPH_EVIDENCE_VERSION = 't404.meta-page-graph-evidence.v1';
const REQUIRED_PERMISSIONS = Object.freeze([
  'pages_show_list','pages_manage_metadata','pages_messaging'
]);
const PAGE_ID=/^[1-9][0-9]{4,24}$/;
const block=reason=>Object.freeze({status:'blocked',reason,sendAllowed:false});
const arr=x=>Array.isArray(x)?x:null;
const str=x=>typeof x==='string'&&x.length>0;

export function assessMetaPageGraphReadOnlyEvidence(evidence,expected,nowSeconds) {
  if(!expected || !PAGE_ID.test(expected.appId||'') ||
      !PAGE_ID.test(expected.metaPageId||'') ||
      !PAGE_ID.test(expected.metaActorId||'') ||
      !Number.isSafeInteger(nowSeconds) || nowSeconds<=0)
    return block('untrusted_expected_meta_context');
  if(!evidence || typeof evidence!=='object' || Array.isArray(evidence))
    return block('graph_evidence_missing');

  // /debug_token?input_token=[USER_TOKEN]&access_token=[APP_TOKEN]
  // Both tokens belong only on the trusted gateway. Never serialize them.
  const t=evidence.tokenDebug?.data;
  if(!t || typeof t!=='object' || Array.isArray(t) ||
      t.is_valid!==true || String(t.app_id||'')!==expected.appId ||
      t.type!=='USER' || String(t.user_id||'')!==expected.metaActorId ||
      !Number.isSafeInteger(t.expires_at) || t.expires_at<=nowSeconds ||
      (t.data_access_expires_at!==undefined &&
        (!Number.isSafeInteger(t.data_access_expires_at)||
          t.data_access_expires_at<=nowSeconds)))
    return block('meta_user_token_invalid_or_wrong_app');

  const scopes=arr(t.scopes);
  if(!scopes || scopes.some(s=>!str(s)) ||
      REQUIRED_PERMISSIONS.some(required=>!scopes.includes(required)))
    return block('meta_oauth_scopes_missing');

  // If Meta supplies target-level scopes, check the Page is included.
  if(t.granular_scopes!==undefined){
    const granular=arr(t.granular_scopes);
    if(!granular) return block('invalid_granular_scope_evidence');
    for(const permission of REQUIRED_PERMISSIONS){
      const matches=granular.filter(g=>g?.scope===permission);
      if(matches.length && !matches.some(g=>
        arr(g.target_ids)?.some(id=>String(id)===expected.metaPageId)))
        return block('meta_page_not_in_granular_scope');
    }
  }

  // GET /me/accounts?fields=id,tasks (server only; no Page tokens in evidence)
  // Require exactly ONE matching Page in the returned collection.
  const accounts=arr(evidence.pageAccounts?.data);
  if(!accounts) return block('meta_page_accounts_missing');
  const found=accounts.filter(a=>String(a?.id||'')===expected.metaPageId);
  if(found.length!==1 || !arr(found[0].tasks)?.includes('MESSAGING'))
    return block('meta_messaging_task_missing_or_wrong_page');

  // GET /{PAGE_ID}/subscribed_apps — read-only. A Page in an inbox is NOT
  // evidence that this particular Meta app is subscribed.
  const subscriptions=arr(evidence.pageSubscribedApps?.data);
  if(!subscriptions) return block('meta_subscribed_apps_unavailable');
  const subscription=subscriptions.filter(s=>String(s?.id||'')===expected.appId);
  if(subscription.length!==1) return block('meta_app_not_subscribed_on_page');
  const fields=arr(subscription[0].subscribed_fields);
  if(!fields || !fields.includes('messages'))
    return block('meta_message_webhook_not_subscribed');

  return Object.freeze({
    status:'attestable_candidate',sendAllowed:false,
    appId:expected.appId,metaPageId:expected.metaPageId,
    // This is an unsealed, ephemeral result, never an authorization object.
    requiresOwnerStoreBinding:true,
    requiresValidOAuthStateAndOneTimeNonce:true,
    requiresSignedReceipt:true,
    requiresIndependentOwnerConsent:true,
    checkedAtSeconds:nowSeconds,
    permissions:Object.freeze([...REQUIRED_PERMISSIONS]),
  });
}
