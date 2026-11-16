#!/usr/bin/env python3
"""TIEN404 V16.4E offline PRIVATE canary packet freezer.
Runs locally on the V16.4B redacted REVIEW_REQUIRED JSON (never in GitHub).
Output retains redacted prompts/gold and MUST stay private, NOT for provider.
No API, sockets, credentials, model inference, auto approvals, or customer writes.
"""
from __future__ import annotations
import argparse, hashlib, json, os, pathlib, re, stat
from collections import Counter

CONTRACT="T404_V164E_PRIVATE_CANARY_REVIEW_PACKET_V1"
CASES=("SINGLE:QA01","SINGLE:QA02","SINGLE:QA03","SINGLE:QA04",
       "MULTI:QA01","MULTI:QA07","MULTI:QA20","MULTI:QA28")
EXPECT_TURNS={"SINGLE:QA01":1,"SINGLE:QA02":1,"SINGLE:QA03":1,
              "SINGLE:QA04":1,"MULTI:QA01":2,"MULTI:QA07":4,
              "MULTI:QA20":2,"MULTI:QA28":2}
POLICY={
"SINGLE:QA01":("READ_ONLY_PRICE","NO_ORDER_WRITE"),
"SINGLE:QA02":("READ_ONLY_INVENTORY","NO_GUESS"),
"SINGLE:QA03":("PRODUCT_CATALOG_EXACT_NAME",),
"SINGLE:QA04":("ONLY_KNOWN_CATALOG_PRODUCTS",),
"MULTI:QA01":("CONTEXT_MEMORY","READ_ONLY_PRODUCT_COMPARE","NO_ORDER_WRITE"),
"MULTI:QA07":("ORDER_CONFIRMATION_REQUIRED","ONE_ORDER_MAX","NO_REAL_WRITE"),
"MULTI:QA20":("EXPECTED_TOTAL_REQUIRED","CONFIRMATION_REQUIRED","NO_REAL_WRITE"),
"MULTI:QA28":("STALE_PREVIEW_CONFLICT","NO_SILENT_OVERWRITE","NO_REAL_WRITE")}
RISK_MARKERS=(
 ("VN_PHONE",r"(?<!\d)(?:\+84|0)\d{9}(?!\d)"),
 ("EMAIL",r"(?<![\w.+-])[\w.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
 ("WEB_URL",r"https?://[^\s<>\"]+"),
 ("LONG_NUMERIC_ID",r"(?<!\d)\d{11,18}(?!\d)"),
 ("LONG_API_TOKEN",r"(?:sk-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{16,})"))
def require(ok,code):
 if not ok:raise ValueError(code)
def hashbytes(raw):return hashlib.sha256(raw).hexdigest()
def parse_private(path):
 require(path.is_file() and not path.is_symlink(),"PRIVATE_INPUT_FILE_REQUIRED")
 require(path.stat().st_size<=1_500_000,"PRIVATE_INPUT_TOO_LARGE")
 raw=path.read_bytes()
 try: payload=json.loads(raw)
 except (UnicodeError,ValueError):raise ValueError("INVALID_PRIVATE_JSON") from None
 require(isinstance(payload,dict) and isinstance(payload.get('cases'),list),"PRIVATE_CASE_ARRAY_REQUIRED")
 require(len(payload['cases'])==132,"SOURCE_132_CASES_REQUIRED")
 require(payload.get('contains_residual_PII_risk') is True,"PII_RISK_FLAG_MUST_REMAIN_TRUE")
 records=payload['cases']
 byid={}
 for row in records:
  require(isinstance(row,dict),"PRIVATE_ROW_OBJECT_REQUIRED")
  key=row.get("case_key")
  require(isinstance(key,str) and re.fullmatch(r"(SINGLE|MULTI):QA\d{2}",key),"QA_CASE_KEY_REQUIRED")
  require(key not in byid,"DUPLICATE_PRIVATE_CASE_KEY")
  allowed={"case_key","turns","expected_behavior","actual_output","source",
   "privacy_status","source_kind","privacy_gate","provider_transfer_allowed",
   "send_to_provider_allowed"}
  require(set(row).issubset(allowed),"UNEXPECTED_PRIVATE_DATA_FIELD")
  require("provider_transfer_allowed" in row or "send_to_provider_allowed" in row,
   "EXPLICIT_NO_SEND_FLAG_REQUIRED")
  require(row.get("provider_transfer_allowed",False) is False and
   row.get("send_to_provider_allowed",False) is False,"UNSAFE_PROVIDER_SEND_FLAG")
  require(row.get("actual_output") is None,"REAL_MODEL_OUTPUT_IN_SOURCE_BLOCKED")
  require(isinstance(row.get("turns"),list) and row["turns"]
    and all(isinstance(x,str) and x.strip() for x in row["turns"]),"PRIVATE_TURNS_REQUIRED")
  require(isinstance(row.get("expected_behavior"),str),"PRIVATE_GOLD_TEXT_REQUIRED")
  byid[key]=row
 expected_ids={f"SINGLE:QA{i:02}" for i in range(1,97)} | \
  {f"MULTI:QA{i:02}" for i in range(1,37)}
 require(set(byid)==expected_ids,"EXACT_SOURCE_CASE_ID_SET_REQUIRED")
 require(set(CASES).issubset(byid),"MISSING_8_CANARY_KEYS")
 return byid,hashbytes(raw)
def make_packet(path):
 rows,snapshot_sha=parse_private(path)
 output=[]
 residual=Counter()
 for key in CASES:
  x=rows[key]
  require(len(x["turns"])==EXPECT_TURNS[key],"CANARY_TURN_COUNT_DRIFT")
  texts=x["turns"]+[x["expected_behavior"]]
  for name,regex in RISK_MARKERS:
   residual[name]+=sum(len(re.findall(regex,s,re.I)) for s in texts)
  output.append({
   "case_key":key, "turns":x["turns"],
   "source_expected_behavior_for_review":x["expected_behavior"],
   "required_policy_tags":list(POLICY[key]),
   "turn_count":len(x["turns"]),
   "case_snapshot_sha256":hashbytes(json.dumps({
     "turns":x["turns"],"expected_behavior":x["expected_behavior"]
    },ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()),
   "privacy_classification":"NOT_REVIEWED",
   "source_gold_independent_acceptance":"NOT_REVIEWED",
   "reviewer_a":{"identity_verified":False,"classification":"NOT_REVIEWED",
     "consent_verified":False,"source_is_synthetic_verified":False},
   "reviewer_b":{"identity_verified":False,"classification":"NOT_REVIEWED",
     "consent_verified":False,"source_is_synthetic_verified":False},
   "independent_arbitration":"NOT_RUN",
   "provider_transfer_allowed":False,"model_execution_status":"NOT_RUN"})
 report={
  "contract":CONTRACT,"source_private_redacted_sha256":snapshot_sha,
  "counts":{"cases":8,"turn_requests_per_model":sum(EXPECT_TURNS.values()),
    "candidate_case_pairs_at_three_models":24,
    "minimum_model_turn_requests_at_three_models":42},
  "residual_regex_hits_selected_8":dict(residual),
  "manual_free_text_pii_review_verified":False,
  "regex_zero_is_not_anonymization":True,
  "operator_account_entitlement_verified":False,
  "external_independent_privacy_acceptance":False,
  "approved_paid_budget_usd":0,
  "provider_send_allowed":False,
  "actual_model_calls":0,
  "status":"PRIVATE_PACKET_FROZEN_REVIEW_REQUIRED_NO_SEND"
 }
 return {"contract":CONTRACT,"classification":"PRIVATE_LOCAL_ONLY_DO_NOT_UPLOAD",
  "source_redacted_corpus_sha256":snapshot_sha,"cases":output,
  "reviewer_attestation":"NOT_RECEIVED","actual_model_outputs":0,
  "provider_transfer_allowed":False},report
def private_write(folder: pathlib.Path, name:str, obj):
 require(name in {"V164E_PRIVATE_8_CASE_REVIEW_REQUIRED.json",
                   "V164E_PRIVATE_AUDIT_METADATA_ONLY.json"},"OUTPUT_NAME_DENIED")
 require(not folder.is_symlink(),"OUTPUT_DIR_SYMLINK_DENIED")
 folder.mkdir(parents=True,exist_ok=True,mode=0o700)
 os.chmod(folder,0o700)
 target=folder/name
 raw=(json.dumps(obj,indent=2,ensure_ascii=False,sort_keys=True)+"\n").encode()
 flags=os.O_WRONLY|os.O_CREAT|os.O_EXCL
 if hasattr(os,"O_NOFOLLOW"):flags|=os.O_NOFOLLOW
 fd=os.open(target,flags,0o600)
 with os.fdopen(fd,'wb') as f:f.write(raw)
 return target
def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--private-redacted-source",required=True,type=pathlib.Path)
 ap.add_argument("--private-out",required=True,type=pathlib.Path)
 args=ap.parse_args()
 packet,report=make_packet(args.private_redacted_source)
 private_write(args.private_out,"V164E_PRIVATE_8_CASE_REVIEW_REQUIRED.json",packet)
 private_write(args.private_out,"V164E_PRIVATE_AUDIT_METADATA_ONLY.json",report)
 print(json.dumps({"status":report["status"],"case_count":8,
  "turn_requests_per_model":14,"real_model_calls":0,
  "privacy_accepted":False,"reviewers_attested":False,
  "private_output_created":True,"raw_prompts_printed":False}))
if __name__=="__main__":main()
