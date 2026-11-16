/**
 * CBOT-MSG-CANARY-02B — Meta screenshot callback ↔ live n8n graph match.
 *
 * Diagnostic only. All approvals remain false; a structural match and a
 * user's Page ownership assertion are not credentials, signed permissions,
 * a real QA PSID binding, or permission to modify Published workflow.
 */
const strict=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype &&
 Object.keys(x).length===keys.length &&
 Object.keys(x).every(k=>keys.includes(k));
const fail=(reason)=>Object.freeze({contract:"T404_CANARY02B_DECISION_V1",
 verdict:"NO_GO_LIVE_PATCH",reason,structural_plan_valid:false,
 callback_path_matches_live:false,page_access:"USER_ATTESTED_ONLY",
 can_modify_published:false,can_send:false,can_write_orders:false,
 can_use_token:false,can_change_webhook:false,send_count:0});
export function assessCallbackAndDraft(b,d){
 if(!b||!d)return fail("MISSING_EVIDENCE");
 const bk=['contract','observed_date_jst','evidence_sources','meta_callback_domain',
 'meta_callback_path','screenshot_callback_configured','screenshot_verify_token_masked',
 'screenshot_messages_row_visible','owner_full_control','page_token_possession',
 'published_workflow_id','published_version_id','published_active','published_node_count',
 'webhook_get_node','webhook_post_node','webhook_get_path','webhook_post_path',
 'signature_verified_before_extract','duplicate_guard_node','loop_node',
 'loop_message_output_index','loop_message_target','shared_prepare_node',
 'prepare_accepts_incoming_output','shared_send_node','shared_send_count',
 'live_attached_business_tool_nodes','live01_execution_id','live01_received_by_user',
 'native_page_app_subscription_inspected','qa_recipient_private_allowlist_verified',
 'approved_workflow_cutover_diff','actual_published_change'];
 if(!strict(b,bk))return fail("INVALID_CALLBACK_BASELINE_SHAPE");
 const dk=['contract','stage','enabled','target_workflow_id',
 'target_published_version','callback_path','get_verify_node','post_ingress_node',
 'insertion_from_node','insertion_output_index','original_target_node',
 'guard_node','deterministic_node',
 'guard_requires_native_page_owner_attestation','guard_requires_signed_meta_event',
 'guard_requires_deduplicated_message','guard_requires_private_page_allowlist',
 'guard_requires_private_qa_sender_allowlist',
 'guard_requires_short_lived_one_use_consent','guard_requires_exact_input_marker',
 'guard_unknown_or_unlisted_goes_to_legacy','canary_greeting',
 'canary_node_response_field','canary_tool_workflow_nodes',
 'canary_http_request_nodes','canary_model_nodes','canary_catalog_reads',
 'canary_order_writes','new_webhooks','new_send_nodes','shared_prepare_node',
 'shared_send_node','route_mutually_exclusive','rollback_to_published_version',
 'recipient_psid_not_stored_in_repo','page_id_not_stored_in_repo',
 'tokens_not_stored_in_repo','owner_exact_diff_signed',
 'private_authority_and_recipient_verified','release_authorized'];
 if(!strict(d,dk))return fail("INVALID_CANDIDATE_SHAPE");
 if(b.contract!=="T404_CBOT_MSG_CANARY02B_CALLBACK_AND_ROUTE_BASELINE_V1"||
 b.published_workflow_id!=="Z7FdV7uDvApfbURQ"||
 b.published_version_id!=="d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92"||
 b.published_node_count!==27||b.published_active!==true||
 b.screenshot_callback_configured!==true||b.screenshot_verify_token_masked!==true||
 b.owner_full_control!=="USER_ATTESTED_NOT_INDEPENDENTLY_REVIEWED"||
 b.page_token_possession!=="USER_ATTESTED_NOT_EXPOSED"||
 b.live01_execution_id!=="4176"||b.live01_received_by_user!==true||
 b.native_page_app_subscription_inspected!==false||
 b.qa_recipient_private_allowlist_verified!==false||
 b.approved_workflow_cutover_diff!==false||b.actual_published_change!==false)
 return fail("CALLBACK_PROOF_CLAIM_INVALID");
 if(b.meta_callback_domain!=="ngoctien20.app.n8n.cloud"||
 b.meta_callback_path!=="/webhook/tien404-messenger-qa"||
 b.webhook_get_path!==b.webhook_post_path||
 b.webhook_get_path!=="tien404-messenger-qa"||
 b.webhook_get_node!=="Webhook"||
 b.webhook_post_node!=="Webhook1"||
 b.shared_send_count!==1)
 return fail("CALLBACK_PATH_OR_SENDER_MISMATCH");
 const tools=["create_order","manage_order","update_order_address",
 "get_order_status","create_support_ticket"];
 if(!Array.isArray(b.live_attached_business_tool_nodes)||
 b.live_attached_business_tool_nodes.length!==5||
 !tools.every(t=>b.live_attached_business_tool_nodes.includes(t))||
 b.signature_verified_before_extract!==true||
 b.duplicate_guard_node!=="Skip Duplicate Message ID"||
 b.loop_node!=="Loop One Message"||
 b.loop_message_output_index!==1||
 b.loop_message_target!=="Messenger AI Agent"||
 b.shared_prepare_node!=="Prepare Messenger Reply"||
 b.prepare_accepts_incoming_output!==true||
 b.shared_send_node!=="Send Messenger Reply - CONFIGURE TOKEN")
 return fail("LIVE_ROUTING_BASELINE_CHANGED_REAUDIT_REQUIRED");
 if(d.contract!=="T404_CBOT_MSG_CANARY02B_ISOLATED_DRAFT_INSERTION_V1"||
 d.stage!=="PROPOSED_SOURCE_ONLY_NO_N8N_CHANGE"||d.enabled!==false||
 d.target_workflow_id!==b.published_workflow_id||
 d.target_published_version!==b.published_version_id||
 d.callback_path!==b.webhook_get_path||
 d.get_verify_node!==b.webhook_get_node||
 d.post_ingress_node!==b.webhook_post_node||
 d.insertion_from_node!==b.loop_node||
 d.insertion_output_index!==b.loop_message_output_index||
 d.original_target_node!==b.loop_message_target||
 d.shared_prepare_node!==b.shared_prepare_node||
 d.shared_send_node!==b.shared_send_node||
 d.canary_node_response_field!=="output"||
 d.rollback_to_published_version!==b.published_version_id)
 return fail("PROPOSED_INSERTION_NOT_PINNED_TO_LIVE_GRAPH");
 const needed=[
 "guard_requires_native_page_owner_attestation",
 "guard_requires_signed_meta_event","guard_requires_deduplicated_message",
 "guard_requires_private_page_allowlist",
 "guard_requires_private_qa_sender_allowlist",
 "guard_requires_short_lived_one_use_consent",
 "guard_unknown_or_unlisted_goes_to_legacy",
 "route_mutually_exclusive","recipient_psid_not_stored_in_repo",
 "page_id_not_stored_in_repo","tokens_not_stored_in_repo"
 ];
 if(needed.some(k=>d[k]!==true)||
 d.guard_requires_exact_input_marker!=="TIEN404-CANARY-LIVE02"||
 !String(d.canary_greeting||"").startsWith("TIEN404-CANARY-01:")||
 !Array.isArray(d.canary_tool_workflow_nodes)||d.canary_tool_workflow_nodes.length>0||
 !Array.isArray(d.canary_http_request_nodes)||d.canary_http_request_nodes.length>0||
 !Array.isArray(d.canary_model_nodes)||d.canary_model_nodes.length>0||
 d.canary_catalog_reads!==0||d.canary_order_writes!==0||
 d.new_webhooks!==0||d.new_send_nodes!==0)
 return fail("CANDIDATE_CAN_SEND_OR_BYPASS_SECURITY");
 if(d.owner_exact_diff_signed!==false||
 d.private_authority_and_recipient_verified!==false||
 d.release_authorized!==false)
 return fail("FALSE_PRIVATE_APPROVAL_IN_SOURCE");
 return Object.freeze({contract:"T404_CANARY02B_DECISION_V1",
 verdict:"NO_GO_LIVE_PATCH",reason:"STRUCTURE_MATCHES_BUT_LIVE_AUTHORIZATION_MISSING",
 structural_plan_valid:true,callback_path_matches_live:true,
 page_access:"USER_ATTESTED_ONLY",no_new_webhook:true,one_existing_send:true,
 candidate_requires_exact_marked_qa_message:true,
 can_modify_published:false,can_send:false,can_write_orders:false,
 can_use_token:false,can_change_webhook:false,send_count:0});
}
