-- V17.2C.37: SYNTHETIC fixtures, no credentials or customer rows.
INSERT INTO tien404_v172c36_multiline_qa.private_intents(
 intent_ref,tenant_ref,store_ref,actor_ref,installation_ref,channel,provider_event_ref,
 source_lane,origin_workflow_id,expected_total_vnd,provider_verified,
 session_current,confirmation_verified,challenge_consumed,valid_until)
 VALUES ('v37-hold-B','tenant-1','store-B','actor-B','inst-B','zalo', 'event37-hold-B', 'commerce_v2_candidate','commerce_v2_candidate_no_send',308000,true,true,true,true,clock_timestamp()+interval '1 hour'),
('v37-due-B','tenant-1','store-B','actor-B','inst-B','zalo', 'event37-due-B', 'commerce_v2_candidate','commerce_v2_candidate_no_send',308000,true,true,true,true,clock_timestamp()+interval '1 hour'),
('v37-cancel-B','tenant-1','store-B','actor-B','inst-B','zalo', 'event37-cancel-B', 'commerce_v2_candidate','commerce_v2_candidate_no_send',308000,true,true,true,true,clock_timestamp()+interval '1 hour'),
('v37-race-B','tenant-1','store-B','actor-B','inst-B','zalo', 'event37-race-B', 'commerce_v2_candidate','commerce_v2_candidate_no_send',308000,true,true,true,true,clock_timestamp()+interval '1 hour'),
('v37-outbox-fail-B','tenant-1','store-B','actor-B','inst-B','zalo', 'event37-outbox-fail-B', 'commerce_v2_candidate','commerce_v2_candidate_no_send',308000,true,true,true,true,clock_timestamp()+interval '1 hour'),
('v37-reserve-fault-B','tenant-1','store-B','actor-B','inst-B','zalo', 'event37-reserve-fault-B', 'commerce_v2_candidate','commerce_v2_candidate_no_send',308000,true,true,true,true,clock_timestamp()+interval '1 hour'),
('v37-due-C','tenant-2','store-C','actor-C','inst-C','messenger', 'event37-due-C', 'commerce_v2_candidate','commerce_v2_candidate_no_send',428000,true,true,true,true,clock_timestamp()+interval '1 hour');
INSERT INTO tien404_v172c36_multiline_qa.intent_lines(
 intent_ref,sku,quantity,expected_unit_vnd)
 VALUES ('v37-hold-B','SKU-A',1,259000),
('v37-hold-B','SKU-B',1,49000),
('v37-due-B','SKU-A',1,259000),
('v37-due-B','SKU-B',1,49000),
('v37-cancel-B','SKU-A',1,259000),
('v37-cancel-B','SKU-B',1,49000),
('v37-race-B','SKU-A',1,259000),
('v37-race-B','SKU-B',1,49000),
('v37-outbox-fail-B','SKU-A',1,259000),
('v37-outbox-fail-B','SKU-B',1,49000),
('v37-reserve-fault-B','SKU-A',1,259000),
('v37-reserve-fault-B','SKU-B',1,49000),
('v37-due-C','SKU-A',1,359000),
('v37-due-C','SKU-B',1,69000);
INSERT INTO tien404_v172c36_multiline_qa.private_transitions(
 action_ref,order_ref,tenant_ref,store_ref,actor_ref,action_type,
 authorized,provider_verified,session_current,challenge_consumed,valid_until)
 VALUES ('act37-confirm-hold-B','SYN36-v37-hold-B','tenant-1','store-B','actor-B','confirm',true,true,true,true,clock_timestamp()+interval '1 hour'),
('act37-cancel-B','SYN36-v37-cancel-B','tenant-1','store-B','actor-B','cancel',true,true,true,true,clock_timestamp()+interval '1 hour'),
('act37-race-cancel-B','SYN36-v37-race-B','tenant-1','store-B','actor-B','cancel',true,true,true,true,clock_timestamp()+interval '1 hour');
