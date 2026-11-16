-- TIEN404 AI — CBOT-MSG-CANARY-03B
-- TRANSACTIONAL, PRIVATE ONE-TIME SEND ATTEMPT RESERVATION — REVIEW ONLY.
-- NOT RUN, NOT EXPOSED as Supabase RPC, not n8n Data Table upsert.
--
-- Positional input parameters MUST be supplied by the authorized trusted
-- internal handler AFTER native Meta HMAC, Page/recipient owner approval,
-- private HMAC digests and exact published workflow version are verified:
--  $1 :: uuid  — privately pre-approved canary_id (not from chat/body)
--  $2 :: text  — trusted Page binding HMAC-SHA256
--  $3 :: text  — trusted recipient binding HMAC-SHA256
--  $4 :: text  — pinned approved greeting configuration SHA256
--  $5 :: text  — HMAC-SHA256 of signed native Meta message event
--  $6 :: text  — signed webhook text, exact marker, NOT authority itself
--
-- Must be run by a separately approved internal privileged worker with a
-- reviewed RLS/GRANT scope (NONE provisioned by schema draft).
-- No user-facing claims or SQL execution endpoints.

BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET LOCAL statement_timeout = '3000ms';
SET LOCAL lock_timeout = '1500ms';

WITH eligible AS MATERIALIZED (
  SELECT a.canary_id, a.page_binding_hmac, a.recipient_binding_hmac
  FROM t404_canary_private.page_only_authorizations AS a
  WHERE a.canary_id = $1::uuid
    AND a.page_binding_hmac = $2::text
    AND a.recipient_binding_hmac = $3::text
    AND a.approved_profile_sha256 = $4::text
    AND a.state = 'APPROVED'
    AND a.marker = $6::text
    AND a.valid_from <= clock_timestamp()
    AND a.expires_at > clock_timestamp()
  FOR UPDATE OF a
)
INSERT INTO t404_canary_private.one_shot_send_attempt_claims
  (canary_id, event_hmac, page_binding_hmac, recipient_binding_hmac)
SELECT a.canary_id, $5::text, a.page_binding_hmac, a.recipient_binding_hmac
FROM eligible AS a
WHERE true -- disambiguates INSERT...SELECT...ON CONFLICT in PostgreSQL
ON CONFLICT DO NOTHING
RETURNING canary_id;

COMMIT;

-- OPERATOR/WORKER CONTRACT (the only acceptable interpretation):
-- Exactly 1 returned row + successful COMMIT means one application-level
-- claimant MAY attempt exactly ONE provider HTTP call, with ALL retries OFF.
-- 0 rows, lock timeout, any SQL error, ambiguous COMMIT or absent consent
-- means NO provider call. Do not "select then insert", release, or rearm.
-- Even with an atomic DB claim, exactly-once external delivery CANNOT be
-- guaranteed across Meta HTTP timeouts. Unknown send outcomes must be held
-- for operator adjudication, never automatically retried.
-- In n8n, avoid 2 workers invoking the same claimant path without a shared
-- database, and never rely on in-memory Set or Data Table upsert as proof.
