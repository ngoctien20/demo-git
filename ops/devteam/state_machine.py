"""Fail-closed task state machine for TIEN404 AI DEV TEAM staging.
This pure module does NOT call models, GitHub, Linear, n8n or Supabase.
A future orchestrator MUST provide durable compare-and-swap and event storage.
"""
from copy import deepcopy

MAX_FIX_ROUNDS = 2
MAX_CONCURRENT_TASKS = 2
TRANSITIONS = {
    "NEW": {"SPEC_READY","BLOCKED","NEEDS_APPROVAL"},
    "SPEC_READY": {"IN_PROGRESS","BLOCKED","NEEDS_APPROVAL"},
    "IN_PROGRESS": {"READY_QA","BLOCKED","NEEDS_APPROVAL"},
    "READY_QA": {"QA_PASS","QA_FAIL","BLOCKED"},
    "QA_PASS": {"REVIEW_PASS","REVIEW_FAIL","BLOCKED"},
    "QA_FAIL": {"IN_PROGRESS","BLOCKED"},
    "REVIEW_FAIL": {"IN_PROGRESS","BLOCKED"},
    "REVIEW_PASS": {"DONE","BLOCKED","NEEDS_APPROVAL"},
    "DONE": set(), "BLOCKED": set(), "NEEDS_APPROVAL": set()
}

class GateError(ValueError):
    pass

def initial_task(task_id, issue_url, budget_usd=0.0):
    if not task_id or not issue_url.startswith("https://linear.app/") or budget_usd < 0:
        raise GateError("Valid task and budget required")
    return {"task_id":task_id,"issue_url":issue_url,"state":"NEW",
            "revision":0,"branch":None,"base_sha":None,"candidate_sha":None,
            "qa_sha":None,"review_sha":None,"fix_rounds":0,
            "budget_usd":float(budget_usd),"spent_usd":0.0,
            "events":[],"checkpoint_url":None,"last_pr_url":None}

def transition(task, event):
    """Return new state with explicit gates. Does not mutate input or persist."""
    if task.get("state") not in TRANSITIONS or not isinstance(event,dict):
        raise GateError("Invalid state or event")
    event_id,target=event.get("event_id"),event.get("to")
    if not isinstance(event_id,str) or len(event_id)<8:
        raise GateError("Stable event_id required")
    if any(e["event_id"]==event_id for e in task["events"]):
        return deepcopy(task)
    if event.get("expected_revision")!=task["revision"]:
        raise GateError("Stale revision / concurrent writer")
    if target not in TRANSITIONS[task["state"]]:
        raise GateError("Illegal transition")
    if event.get("environment","staging")!="staging" or event.get("requires_production_change"):
        raise GateError("Production mutation is forbidden")
    spent=task["spent_usd"]+event.get("estimated_cost_usd",0)
    if spent<0 or spent>task["budget_usd"]:
        raise GateError("Budget limit reached")
    t=deepcopy(task)
    t["spent_usd"]=float(spent)
    if target=="SPEC_READY":
        if not event.get("owner") or not event.get("acceptance_tests"):
            raise GateError("Acceptance and owner required")
    if target=="IN_PROGRESS":
        if task["state"] in {"QA_FAIL","REVIEW_FAIL"}:
            if task["fix_rounds"]>=MAX_FIX_ROUNDS:
                raise GateError("Fix cap reached")
            t["fix_rounds"]+=1
            t["candidate_sha"]=t["qa_sha"]=t["review_sha"]=None
        if not event.get("branch") or not event.get("base_sha"):
            raise GateError("One branch and base SHA required")
        t["branch"],t["base_sha"]=event["branch"],event["base_sha"]
    if target=="READY_QA":
        sha,pr=event.get("commit_sha"),event.get("pr_url")
        if not sha or not str(pr).startswith("https://github.com/"):
            raise GateError("PR and source SHA required")
        t["candidate_sha"],t["last_pr_url"]=sha,pr
        t["qa_sha"]=t["review_sha"]=None
    if target in {"QA_PASS","QA_FAIL"}:
        if event.get("commit_sha")!=t["candidate_sha"] or not event.get("run_url"):
            raise GateError("QA evidence must match candidate SHA")
        if target=="QA_PASS": t["qa_sha"]=event["commit_sha"]
    if target in {"REVIEW_PASS","REVIEW_FAIL"}:
        if event.get("commit_sha")!=t["candidate_sha"] or not event.get("review_url"):
            raise GateError("Review evidence must match candidate SHA")
        if target=="REVIEW_PASS": t["review_sha"]=event["commit_sha"]
    if target=="DONE":
        if not all((t["candidate_sha"],t["qa_sha"]==t["candidate_sha"],
                    t["review_sha"]==t["candidate_sha"],event.get("ci_pass"),
                    event.get("checkpoint_url"),event.get("pr_is_draft"))):
            raise GateError("QA and Review PASS on same SHA + CI + checkpoint required")
        t["checkpoint_url"]=event["checkpoint_url"]
    if target in {"BLOCKED","NEEDS_APPROVAL"} and not event.get("reason"):
        raise GateError("Reason required")
    t["state"]=target
    t["revision"]+=1
    t["events"].append({"event_id":event_id,"from":task["state"],
                        "to":target,"candidate_sha":t["candidate_sha"]})
    return t
