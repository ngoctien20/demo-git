/**
 * V17.4P-HOSTED.2 stage-A preparation only. No API, no deployment.
 * Never turn an editable JSON file into permission to create resources.
 */
export const CONTRACT='T404_V174P_HOSTED2_INACTIVE_ADMISSION_V1';
const WORKER='tien404-v174p-private-qa-issuer';
const requiredApproval=[
 'exact_qa_origin','account_isolation_approved','authorized_operator_list_private_attested',
 'owner_authorization_record','max_qa_requests','qa_spend_envelope_usd',
 'worker_account_wide_limit_reviewed','durable_object_account_wide_limit_reviewed',
 'stored_data_charge_reviewed','rollback_owner_attested'
];
const isObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const props=x=>isObject(x)?Object.keys(x):[];
export function evaluateStageA(config,request){
 const reasons=[];
 const ok=(key,yes)=>{if(!yes)reasons.push(key);};
 const c=isObject(config)?config:{},r=isObject(request)?request:{};
 ok('exact_worker_name',c.name===WORKER);
 ok('worker_module_path',c.main==='./hosted-issuer.worker.mjs');
 ok('workers_dev_off',c.workers_dev===false);
 ok('preview_urls_off',c.preview_urls===false);
 ok('no_worker_routes',Array.isArray(c.routes)&&c.routes.length===0&&c.route===undefined);
 ok('no_cron_or_queue_triggers',c.triggers===undefined);
 ok('no_live_service_bindings',!['services','r2_buckets','d1_databases','kv_namespaces','queues','hyperdrive','ai'].some(x=>props(c).includes(x)));
 ok('no_secret_values_in_config',!['V174P_SESSION_HMAC_KEY','V174P_ACCESS_JWKS_JSON'].some(x=>
   props(c.vars).includes(x))&&c.secrets_store_secrets===undefined&&c.secrets===undefined);
 ok('strict_qa_only',isObject(c.vars)&&c.vars.V174P_MODE==='QA_SYNTHETIC_ONLY'&&
   c.vars.V174P_OWNER_PROOF_STATUS==='UNVERIFIED_QA_ONLY');
 ok('no_auto_active_origin_or_audience',!['V174P_ISSUER_ORIGIN','V174P_ACCESS_AUD','V174P_ACCESS_ISSUER'].some(x=>props(c.vars).includes(x)));
 ok('dedicated_sqlite_do_binding',Array.isArray(c.durable_objects?.bindings)&&
   c.durable_objects.bindings.length===1&&
   c.durable_objects.bindings[0]?.name==='V174P_REPLAY_DO'&&
   c.durable_objects.bindings[0]?.class_name==='V174PReplayGuard');
 ok('sqlite_only_migration',Array.isArray(c.migrations)&&c.migrations.length===1&&
   Array.isArray(c.migrations[0]?.new_sqlite_classes)&&
   c.migrations[0].new_sqlite_classes.length===1&&
   c.migrations[0].new_sqlite_classes[0]==='V174PReplayGuard');
 ok('authorization_still_pending',r.status==='AWAITING_EXPLICIT_OWNER_APPROVAL'&&
    r.scope==='SYNTHETIC_PRIVATE_QA_NO_SEND_NO_COMMERCE'&&
    r.deploy_strategy?.automatic_deploy===false);
 ok('no_commerce_or_provider_send',r.commercial_read_write_allowed===false&&
    r.provider_send_allowed===false&&r.ai_model_calls_allowed===false);
 const approval=isObject(r.approval_required)?r.approval_required:{};
 const pending=requiredApproval.filter(key=>approval[key]===null||approval[key]===false||approval[key]===undefined);
 return Object.freeze({contract:CONTRACT,
  status:reasons.length===0?'SOURCE_TEMPLATE_SAFE_FOR_REVIEW':'BLOCKED_SOURCE_TEMPLATE',
  reasons,pending_authorizations:pending,
  can_deploy:false,can_enable_access:false,can_run_external_canary:false,
  would_modify_cloudflare:false,commercial_authorized:false});
}
