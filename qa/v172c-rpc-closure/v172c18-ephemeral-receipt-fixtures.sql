-- Synthetic fixture only for ephemeral GitHub PostgreSQL, NEVER Supabase.
INSERT INTO tien404_v172c18_private.consent_receipts
(receipt_id,actor_slot,project_ref,tenant_ref,store_ref,subject_ref,scope,reviewer_ref,auth_evidence_ref,issued_at,expires_at)
VALUES
(repeat('a',32),'QA_A','ephemeral-qa','synthetic-t','store-a','subject-a','synthetic_catalog_readonly_no_send_no_write','reviewer','synthetic-auth-a',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '10 minutes'),
(repeat('b',32),'QA_B','ephemeral-qa','synthetic-t','store-b','subject-b','synthetic_catalog_readonly_no_send_no_write','reviewer','synthetic-auth-b',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '10 minutes'),
(repeat('c',32),'QA_B','ephemeral-qa','synthetic-t','store-b','subject-b','synthetic_catalog_readonly_no_send_no_write','reviewer','synthetic-auth-b',clock_timestamp()-interval '20 minutes',clock_timestamp()-interval '10 minutes');
UPDATE tien404_v172c18_private.consent_receipts SET state='revoked' WHERE receipt_id=repeat('b',32);
