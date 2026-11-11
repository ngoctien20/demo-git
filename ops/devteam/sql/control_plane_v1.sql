-- TIEN404 Agent Factory Control Plane V1, staging-only.
-- This schema is PRIVATE, has no Data API or browser grants, and never writes customer Orders.
BEGIN;
CREATE SCHEMA IF NOT EXISTS factory_private;
REVOKE ALL ON SCHEMA factory_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS factory_private.agents (
  agent_id text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('CTO','DEVELOPER','QA','REVIEWER')),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  model_ready boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO factory_private.agents(agent_id,role,name)
VALUES
('HbTA0yKnJSoVAhJE','CTO','TIEN404 DEV TEAM — 00 CTO Coordinator'),
('QAvg1lczAAwo2iWN','DEVELOPER','TIEN404 DEV TEAM — 02 Engineer'),
('cVrtLOENAUSGhEfL','QA','TIEN404 DEV TEAM — 03 QA Independent'),
('SZrYOLXZt2MdcTDc','REVIEWER','TIEN404 DEV TEAM — 04 Security Reviewer')
ON CONFLICT(agent_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS factory_private.config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  max_parallel integer NOT NULL DEFAULT 2 CHECK(max_parallel BETWEEN 1 AND 2),
  max_fix_rounds integer NOT NULL DEFAULT 2 CHECK(max_fix_rounds BETWEEN 0 AND 2),
  max_monthly_budget_cents integer NOT NULL DEFAULT 0 CHECK(max_monthly_budget_cents >= 0),
  require_review boolean NOT NULL DEFAULT true CHECK(require_review),
  automatic_production boolean NOT NULL DEFAULT false CHECK(NOT automatic_production)
);
INSERT INTO factory_private.config(singleton) VALUES(true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS factory_private.tasks (
 task_key text PRIMARY KEY CHECK(task_key ~ '^AF-[A-Z0-9-]{5,80}$'),
 goal text NOT NULL CHECK(length(btrim(goal)) BETWEEN 10 AND 2000),
 issue_url text,
 acceptance jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(acceptance)='array'),
 state text NOT NULL DEFAULT 'NEW' CHECK(state IN
 ('NEW','SPEC_READY','IN_PROGRESS','READY_QA','QA_PASS','QA_FAIL',
  'REVIEW_PASS','REVIEW_FAIL','DONE','BLOCKED','NEEDS_APPROVAL')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision >= 0),
 branch text,
 base_sha text CHECK(base_sha IS NULL OR base_sha ~ '^[a-f0-9]{40}$'),
 candidate_sha text CHECK(candidate_sha IS NULL OR candidate_sha ~ '^[a-f0-9]{40}$'),
 qa_sha text CHECK(qa_sha IS NULL OR qa_sha ~ '^[a-f0-9]{40}$'),
 review_sha text CHECK(review_sha IS NULL OR review_sha ~ '^[a-f0-9]{40}$'),
 pr_url text,
 qa_run_url text,
 review_url text,
 checkpoint_url text,
 fix_rounds integer NOT NULL DEFAULT 0 CHECK(fix_rounds BETWEEN 0 AND 2),
 budget_cents integer NOT NULL DEFAULT 0 CHECK(budget_cents >= 0),
 spent_cents integer NOT NULL DEFAULT 0 CHECK(spent_cents BETWEEN 0 AND budget_cents),
 lease_agent_id text REFERENCES factory_private.agents(agent_id),
 lease_expires_at timestamptz,
 blocked_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS factory_tasks_state_idx ON factory_private.tasks(state,created_at);
CREATE INDEX IF NOT EXISTS factory_tasks_lease_idx ON factory_private.tasks(lease_expires_at)
 WHERE lease_expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS factory_private.events (
 event_seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 task_key text NOT NULL REFERENCES factory_private.tasks(task_key) ON DELETE RESTRICT,
 event_id text NOT NULL CHECK(length(event_id) BETWEEN 8 AND 120),
 prior_state text NOT NULL,
 next_state text NOT NULL,
 revision integer NOT NULL,
 actor_agent_id text NOT NULL REFERENCES factory_private.agents(agent_id),
 source_sha text,
 evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(evidence)='object'),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(task_key,event_id),
 UNIQUE(task_key,revision)
);
CREATE INDEX IF NOT EXISTS factory_events_task_seq_idx ON factory_private.events(task_key,event_seq);

CREATE TABLE IF NOT EXISTS factory_private.agent_runs (
 run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_key text NOT NULL REFERENCES factory_private.tasks(task_key) ON DELETE RESTRICT,
 agent_id text NOT NULL REFERENCES factory_private.agents(agent_id) ON DELETE RESTRICT,
 state text NOT NULL CHECK(state IN('REQUESTED','STARTED','PASS','FAIL','BLOCKED')),
 external_run_ref text,
 source_sha text,
 cost_cents integer NOT NULL DEFAULT 0 CHECK(cost_cents >= 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS factory_runs_task_idx ON factory_private.agent_runs(task_key,created_at DESC);

-- Privileged, on-demand SQL-only entrypoints. SECURITY INVOKER. No browser/API grants.
CREATE OR REPLACE FUNCTION factory_private.enqueue(
 p_task_key text,p_goal text,p_issue_url text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, factory_private
AS $fn$
BEGIN
 IF p_issue_url IS NOT NULL AND p_issue_url NOT LIKE 'https://linear.app/%'
 THEN RAISE EXCEPTION 'INVALID_ISSUE_URL'; END IF;
 INSERT INTO factory_private.tasks(task_key,goal,issue_url)
 VALUES(p_task_key,p_goal,p_issue_url);
 RETURN p_task_key;
END
$fn$;

CREATE OR REPLACE FUNCTION factory_private.claim(
 p_task_key text,p_agent_id text,p_expected_revision integer,p_seconds integer DEFAULT 180
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, factory_private
AS $fn$
DECLARE t factory_private.tasks%ROWTYPE;
BEGIN
 IF p_seconds NOT BETWEEN 30 AND 600 THEN RAISE EXCEPTION 'INVALID_LEASE'; END IF;
 PERFORM 1 FROM factory_private.agents WHERE agent_id=p_agent_id AND enabled AND model_ready;
 IF NOT FOUND THEN RAISE EXCEPTION 'AGENT_NOT_READY'; END IF;
 SELECT * INTO t FROM factory_private.tasks WHERE task_key=p_task_key FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TASK_UNKNOWN'; END IF;
 IF t.revision <> p_expected_revision THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
 IF t.state IN('DONE','BLOCKED','NEEDS_APPROVAL') THEN RAISE EXCEPTION 'TERMINAL_OR_APPROVAL_STATE'; END IF;
 IF t.lease_expires_at > clock_timestamp() AND t.lease_agent_id <> p_agent_id
 THEN RAISE EXCEPTION 'TASK_ALREADY_CLAIMED'; END IF;
 UPDATE factory_private.tasks SET
  lease_agent_id=p_agent_id,
  lease_expires_at=clock_timestamp() + make_interval(secs => p_seconds),
  revision=revision+1,updated_at=clock_timestamp()
 WHERE task_key=p_task_key;
 RETURN t.revision+1;
END
$fn$;

CREATE OR REPLACE FUNCTION factory_private.advance(
 p_task_key text,p_event_id text,p_agent_id text,p_expected_revision integer,
 p_next_state text,p_evidence jsonb DEFAULT '{}'::jsonb
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, factory_private
AS $fn$
DECLARE t factory_private.tasks%ROWTYPE;
DECLARE agent_role text;
DECLARE old_state text;
DECLARE next_fix_rounds integer;
DECLARE cost_cents integer;
DECLARE candidate text;
DECLARE new_rev integer;
DECLARE safe_evidence jsonb;
BEGIN
 -- Serialize all transitions so the global max_parallel gate cannot race.
 PERFORM pg_advisory_xact_lock(8424041);
 SELECT * INTO t FROM factory_private.tasks WHERE task_key=p_task_key FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TASK_UNKNOWN'; END IF;
 IF EXISTS(SELECT 1 FROM factory_private.events
   WHERE task_key=p_task_key AND event_id=p_event_id) THEN
   RETURN t.revision; -- idempotent replay, no mutation
 END IF;
 IF p_event_id IS NULL OR length(p_event_id) NOT BETWEEN 8 AND 120
 THEN RAISE EXCEPTION 'INVALID_EVENT_ID'; END IF;
 IF t.revision<>p_expected_revision THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
 IF t.lease_agent_id IS DISTINCT FROM p_agent_id OR t.lease_expires_at<=clock_timestamp()
 OR t.lease_expires_at IS NULL THEN RAISE EXCEPTION 'LEASE_REQUIRED'; END IF;
 SELECT role INTO agent_role FROM factory_private.agents
 WHERE agent_id=p_agent_id AND enabled AND model_ready;
 IF agent_role IS NULL THEN RAISE EXCEPTION 'AGENT_NOT_READY'; END IF;
 IF jsonb_typeof(p_evidence) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'INVALID_EVIDENCE'; END IF;
 IF COALESCE((p_evidence->>'requires_production_change')::boolean,false)
 THEN RAISE EXCEPTION 'PRODUCTION_FORBIDDEN'; END IF;
 IF COALESCE((p_evidence->>'model_call')::boolean,false)
 THEN RAISE EXCEPTION 'MODEL_CALL_REQUIRES_SEPARATE_BUDGET_APPROVAL'; END IF;
 cost_cents:=COALESCE((p_evidence->>'cost_cents')::integer,0);
 IF cost_cents<0 OR t.spent_cents+cost_cents>t.budget_cents
 THEN RAISE EXCEPTION 'BUDGET_EXCEEDED'; END IF;
 old_state:=t.state;
 IF NOT (
 (old_state='NEW' AND p_next_state IN('SPEC_READY','BLOCKED','NEEDS_APPROVAL')) OR
 (old_state='SPEC_READY' AND p_next_state IN('IN_PROGRESS','BLOCKED','NEEDS_APPROVAL')) OR
 (old_state='IN_PROGRESS' AND p_next_state IN('READY_QA','BLOCKED','NEEDS_APPROVAL')) OR
 (old_state='READY_QA' AND p_next_state IN('QA_PASS','QA_FAIL','BLOCKED')) OR
 (old_state='QA_PASS' AND p_next_state IN('REVIEW_PASS','REVIEW_FAIL','BLOCKED')) OR
 (old_state IN('QA_FAIL','REVIEW_FAIL') AND p_next_state IN('IN_PROGRESS','BLOCKED')) OR
 (old_state='REVIEW_PASS' AND p_next_state IN('DONE','BLOCKED','NEEDS_APPROVAL'))
 ) THEN RAISE EXCEPTION 'ILLEGAL_TRANSITION'; END IF;
 IF p_next_state='SPEC_READY' THEN
   IF agent_role<>'CTO' OR jsonb_typeof(p_evidence->'acceptance') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_evidence->'acceptance')=0
   THEN RAISE EXCEPTION 'CTO_SPEC_REQUIRED'; END IF;
   t.acceptance:=p_evidence->'acceptance';
 END IF;
 IF p_next_state='IN_PROGRESS' THEN
   IF agent_role<>'DEVELOPER' OR COALESCE(p_evidence->>'branch','')!~'^ops/[a-z0-9/_-]{3,90}$'
     OR COALESCE(p_evidence->>'base_sha','')!~'^[a-f0-9]{40}$'
   THEN RAISE EXCEPTION 'DEVELOPER_BRANCH_SHA_REQUIRED'; END IF;
   IF (SELECT count(*) FROM factory_private.tasks
       WHERE state IN('IN_PROGRESS','READY_QA','QA_PASS','QA_FAIL','REVIEW_PASS','REVIEW_FAIL')
       AND task_key<>p_task_key)>=2
   THEN RAISE EXCEPTION 'MAX_TWO_ACTIVE_TASKS'; END IF;
   IF old_state IN('QA_FAIL','REVIEW_FAIL') THEN
     IF t.fix_rounds >= 2 THEN RAISE EXCEPTION 'FIX_LIMIT_EXHAUSTED'; END IF;
     t.fix_rounds:=t.fix_rounds+1;
   END IF;
   t.branch:=p_evidence->>'branch';
   t.base_sha:=p_evidence->>'base_sha';
   t.candidate_sha:=NULL;t.qa_sha:=NULL;t.review_sha:=NULL;
 END IF;
 IF p_next_state='READY_QA' THEN
   IF agent_role<>'DEVELOPER' OR
       COALESCE(p_evidence->>'commit_sha','')!~'^[a-f0-9]{40}$'
       OR COALESCE(p_evidence->>'pr_url','') NOT LIKE 'https://github.com/ngoctien20/demo-git/pull/%'
   THEN RAISE EXCEPTION 'PR_AND_SHA_REQUIRED'; END IF;
   t.candidate_sha:=p_evidence->>'commit_sha';
   t.pr_url:=p_evidence->>'pr_url';
   t.qa_sha:=NULL;t.review_sha:=NULL;
 END IF;
 IF p_next_state IN('QA_PASS','QA_FAIL') THEN
   IF agent_role<>'QA' OR p_evidence->>'commit_sha' IS DISTINCT FROM t.candidate_sha
    OR COALESCE(p_evidence->>'run_url','') NOT LIKE 'https://github.com/ngoctien20/demo-git/actions/runs/%'
   THEN RAISE EXCEPTION 'INDEPENDENT_QA_EVIDENCE_REQUIRED'; END IF;
   t.qa_run_url:=p_evidence->>'run_url';
   IF p_next_state='QA_PASS' THEN t.qa_sha:=t.candidate_sha; END IF;
 END IF;
 IF p_next_state IN('REVIEW_PASS','REVIEW_FAIL') THEN
   IF agent_role<>'REVIEWER' OR p_evidence->>'commit_sha' IS DISTINCT FROM t.candidate_sha
    OR COALESCE(p_evidence->>'review_url','') NOT LIKE 'https://github.com/ngoctien20/demo-git/%'
   THEN RAISE EXCEPTION 'INDEPENDENT_REVIEW_EVIDENCE_REQUIRED'; END IF;
   t.review_url:=p_evidence->>'review_url';
   IF p_next_state='REVIEW_PASS' THEN t.review_sha:=t.candidate_sha; END IF;
 END IF;
 IF p_next_state='DONE' THEN
   IF agent_role<>'CTO' OR t.qa_sha IS NULL OR t.qa_sha IS DISTINCT FROM t.candidate_sha
     OR t.review_sha IS DISTINCT FROM t.candidate_sha
     OR COALESCE((p_evidence->>'ci_pass')::boolean,false) IS DISTINCT FROM true
     OR COALESCE((p_evidence->>'pr_is_draft')::boolean,false) IS DISTINCT FROM true
     OR COALESCE(p_evidence->>'checkpoint_url','') NOT LIKE 'https://github.com/ngoctien20/demo-git/%'
   THEN RAISE EXCEPTION 'RELEASE_GATES_NOT_MET'; END IF;
   t.checkpoint_url:=p_evidence->>'checkpoint_url';
 END IF;
 IF p_next_state IN('BLOCKED','NEEDS_APPROVAL') THEN
   IF agent_role<>'CTO' AND agent_role<>'QA' AND agent_role<>'REVIEWER'
   THEN RAISE EXCEPTION 'BLOCK_ROLE_DENIED'; END IF;
   IF length(btrim(COALESCE(p_evidence->>'reason',''))) < 6
   THEN RAISE EXCEPTION 'BLOCK_REASON_REQUIRED'; END IF;
   t.blocked_reason:=LEFT(p_evidence->>'reason',300);
 END IF;
 new_rev:=t.revision+1;
 -- Explicit allowlist: never store raw LLM messages, tokens or customer payloads.
 safe_evidence:=jsonb_strip_nulls(jsonb_build_object(
  'commit_sha',p_evidence->>'commit_sha',
  'pr_url',p_evidence->>'pr_url',
  'run_url',p_evidence->>'run_url',
  'review_url',p_evidence->>'review_url',
  'checkpoint_url',p_evidence->>'checkpoint_url',
  'reason',LEFT(COALESCE(p_evidence->>'reason',''),300)
 ));
 UPDATE factory_private.tasks SET
  state=p_next_state, revision=new_rev,acceptance=t.acceptance,
  branch=t.branch,base_sha=t.base_sha,candidate_sha=t.candidate_sha,
  qa_sha=t.qa_sha,review_sha=t.review_sha,pr_url=t.pr_url,
  qa_run_url=t.qa_run_url,review_url=t.review_url,checkpoint_url=t.checkpoint_url,
  fix_rounds=t.fix_rounds,spent_cents=t.spent_cents+cost_cents,
  blocked_reason=t.blocked_reason,
  lease_agent_id=NULL,lease_expires_at=NULL,updated_at=clock_timestamp()
 WHERE task_key=p_task_key AND revision=t.revision;
 IF NOT FOUND THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
 INSERT INTO factory_private.events(task_key,event_id,prior_state,next_state,revision,actor_agent_id,source_sha,evidence)
 VALUES(p_task_key,p_event_id,old_state,p_next_state,new_rev,p_agent_id,t.candidate_sha,safe_evidence);
 RETURN new_rev;
END
$fn$;

-- Deny all anonymous, browser and authenticated API access, even if exposed by mistake.
ALTER TABLE factory_private.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_private.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_private.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_private.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_private.agent_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA factory_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA factory_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA factory_private FROM PUBLIC,anon,authenticated;
COMMIT;
