import unittest
from ops.devteam.state_machine import initial_task,transition,GateError
URL="https://linear.app/ngoctien20/issue/NGO-15"
PR="https://github.com/ngoctien20/demo-git/pull/20"
RUN="https://github.com/ngoctien20/demo-git/actions/runs/123"

class StateTests(unittest.TestCase):
    def setUp(self):
        self.t=initial_task("NGO-15",URL)
        self.n=0
    def go(self, to, **kw):
        self.n+=1
        self.t=transition(self.t,dict(event_id=f"event-{self.n:04d}",to=to,expected_revision=self.t["revision"],**kw))
    def start(self):
        self.go("SPEC_READY",owner="Engineer",acceptance_tests=["tenant isolation"])
        self.go("IN_PROGRESS",branch="ops/ngo15",base_sha="a"*40)
        self.go("READY_QA",commit_sha="b"*40,pr_url=PR)
    def test_fail_fix_qa_review_done(self):
        self.start()
        self.go("QA_FAIL",commit_sha="b"*40,run_url=RUN)
        self.go("IN_PROGRESS",branch="ops/ngo15",base_sha="b"*40)
        self.go("READY_QA",commit_sha="c"*40,pr_url=PR)
        self.go("QA_PASS",commit_sha="c"*40,run_url=RUN)
        self.go("REVIEW_PASS",commit_sha="c"*40,review_url=PR)
        self.go("DONE",ci_pass=True,pr_is_draft=True,checkpoint_url=PR)
        self.assertEqual((self.t["state"],self.t["fix_rounds"]),("DONE",1))
    def test_idempotency_and_stale_revision(self):
        ev=dict(event_id="event-once",to="SPEC_READY",expected_revision=0,owner="Engineer",acceptance_tests=["qa"])
        a=transition(self.t,ev)
        self.assertEqual(transition(a,ev),a)
        with self.assertRaisesRegex(GateError,"Stale"): transition(a,{**ev,"event_id":"event-later"})
    def test_cannot_skip_gate(self):
        self.start()
        with self.assertRaises(GateError): self.go("DONE",ci_pass=True,checkpoint_url=PR)
        self.go("QA_PASS",commit_sha="b"*40,run_url=RUN)
        with self.assertRaises(GateError): self.go("DONE",ci_pass=True,checkpoint_url=PR)
        self.go("REVIEW_PASS",commit_sha="b"*40,review_url=PR)
        with self.assertRaisesRegex(GateError,"checkpoint"): self.go("DONE",ci_pass=True,pr_is_draft=True)
    def test_sha_mismatch(self):
        self.start()
        with self.assertRaisesRegex(GateError,"candidate SHA"): self.go("QA_PASS",commit_sha="x"*40,run_url=RUN)
    def test_fix_limit(self):
        self.start()
        for i in range(2):
            old=chr(98+i)*40
            self.go("QA_FAIL",commit_sha=old,run_url=RUN)
            self.go("IN_PROGRESS",branch="ops/ngo15",base_sha=old)
            self.go("READY_QA",commit_sha=chr(99+i)*40,pr_url=PR)
        self.go("QA_FAIL",commit_sha="d"*40,run_url=RUN)
        with self.assertRaisesRegex(GateError,"Fix cap"): self.go("IN_PROGRESS",branch="ops/ngo15",base_sha="d"*40)
        self.go("BLOCKED",reason="Two attempts exhausted")
        self.assertEqual(self.t["state"],"BLOCKED")
    def test_budget_or_production_change_denied(self):
        ev=dict(event_id="event-test",to="SPEC_READY",expected_revision=0,owner="Eng",acceptance_tests=["qa"])
        with self.assertRaisesRegex(GateError,"Budget"): transition(self.t,{**ev,"estimated_cost_usd":0.01})
        with self.assertRaisesRegex(GateError,"Production"): transition(self.t,{**ev,"requires_production_change":True})
    def test_invalid_spec_and_missing_evidence(self):
        with self.assertRaisesRegex(GateError,"Acceptance"): self.go("SPEC_READY",owner="Eng")
        self.start()
        with self.assertRaisesRegex(GateError,"evidence"): self.go("QA_PASS",commit_sha="b"*40)
    def test_input_not_mutated(self):
        old=self.t
        self.go("SPEC_READY",owner="Engineer",acceptance_tests=["qa"])
        self.assertEqual((old["state"],old["revision"],old["events"]),("NEW",0,[]))

if __name__=="__main__": unittest.main()
