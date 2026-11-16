"""Synthetic-only unit tests: NEVER include user-uploaded transcripts in GitHub CI."""
import unittest,tempfile, pathlib, json, stat, copy
from freeze_private_canary import make_packet,private_write,CASES,EXPECT_TURNS
def make_source():
 records=[]
 for i in range(1,97):
  key=f"SINGLE:QA{i:02}"
  records.append({"case_key":key,"turns":["Synthetic QA only"],"expected_behavior":"synthetic gold not accepted",
   "send_to_provider_allowed":False})
 for i in range(1,37):
  key=f"MULTI:QA{i:02}"
  n=EXPECT_TURNS.get(key,1)
  records.append({"case_key":key,"turns":["Synthetic QA only"]*n,
   "expected_behavior":"Mock tool no real order",
   "send_to_provider_allowed":False})
 return {"contains_residual_PII_risk":True,"cases":records}
class FreezeTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory()
  self.addCleanup(self.tmp.cleanup)
  self.root=pathlib.Path(self.tmp.name)
  self.f=self.root/"private.json"
  self.src=make_source()
  self.save()
 def save(self):self.f.write_text(json.dumps(self.src,ensure_ascii=False),encoding="utf-8")
 def test_01_eight_cases(self):self.assertEqual(len(make_packet(self.f)[0]["cases"]),8)
 def test_02_correct_case_order(self):self.assertEqual(tuple(x["case_key"] for x in make_packet(self.f)[0]["cases"]),CASES)
 def test_03_fourteen_turns(self):self.assertEqual(make_packet(self.f)[1]["counts"]["turn_requests_per_model"],14)
 def test_04_24_pairs(self):self.assertEqual(make_packet(self.f)[1]["counts"]["candidate_case_pairs_at_three_models"],24)
 def test_05_42_requests(self):self.assertEqual(make_packet(self.f)[1]["counts"]["minimum_model_turn_requests_at_three_models"],42)
 def test_06_gold_stays_unapproved(self):self.assertTrue(all(x["source_gold_independent_acceptance"]=="NOT_REVIEWED" for x in make_packet(self.f)[0]["cases"]))
 def test_07_privacy_stays_unapproved(self):self.assertTrue(all(x["privacy_classification"]=="NOT_REVIEWED" for x in make_packet(self.f)[0]["cases"]))
 def test_08_reviewer_absent(self):self.assertTrue(all(x["reviewer_a"]["identity_verified"] is False for x in make_packet(self.f)[0]["cases"]))
 def test_09_transfer_never_allowed(self):self.assertTrue(all(x["provider_transfer_allowed"] is False for x in make_packet(self.f)[0]["cases"]))
 def test_10_model_not_run(self):self.assertTrue(all(x["model_execution_status"]=="NOT_RUN" for x in make_packet(self.f)[0]["cases"]))
 def test_11_no_provider_authorization(self):self.assertFalse(make_packet(self.f)[1]["provider_send_allowed"])
 def test_12_no_budget_authorization(self):self.assertEqual(make_packet(self.f)[1]["approved_paid_budget_usd"],0)
 def test_13_has_privacy_risk_flag(self):
  self.src["contains_residual_PII_risk"]=False;self.save()
  with self.assertRaisesRegex(ValueError,"PII_RISK_FLAG"):make_packet(self.f)
 def test_14_missing_case(self):
  self.src["cases"]=self.src["cases"][:-1];self.save()
  with self.assertRaisesRegex(ValueError,"SOURCE_132_CASES"):make_packet(self.f)
 def test_15_duplicate_case(self):
  self.src["cases"][0]["case_key"]=self.src["cases"][1]["case_key"];self.save()
  with self.assertRaisesRegex(ValueError,"DUPLICATE_PRIVATE"):make_packet(self.f)
 def test_16_send_allowed_true_rejected(self):
  self.src["cases"][0]["send_to_provider_allowed"]=True;self.save()
  with self.assertRaisesRegex(ValueError,"UNSAFE_PROVIDER_SEND_FLAG"):make_packet(self.f)
 def test_17_even_new_flag_true_rejected(self):
  self.src["cases"][0]["provider_transfer_allowed"]=True;self.save()
  with self.assertRaisesRegex(ValueError,"UNSAFE_PROVIDER_SEND_FLAG"):make_packet(self.f)
 def test_18_mutated_turn_count_refused(self):
  self.src["cases"][0]["turns"].append("unexpected extra turn");self.save()
  with self.assertRaisesRegex(ValueError,"CANARY_TURN_COUNT_DRIFT"):make_packet(self.f)
 def test_19_sensitive_phone_regex_counts(self):
  self.src["cases"][0]["turns"][0]="Synthetic 0901234567";self.save()
  self.assertEqual(make_packet(self.f)[1]["residual_regex_hits_selected_8"]["VN_PHONE"],1)
 def test_20_private_file_mode_and_no_overwrite(self):
  out=self.root/"restricted";p=private_write(out,"V164E_PRIVATE_AUDIT_METADATA_ONLY.json",make_packet(self.f)[1])
  self.assertEqual(stat.S_IMODE(p.stat().st_mode),0o600)
  self.assertEqual(stat.S_IMODE(out.stat().st_mode),0o700)
  with self.assertRaises(FileExistsError):private_write(out,p.name,{})
 def test_21_arbitrary_output_name_denied(self):
  with self.assertRaisesRegex(ValueError,"OUTPUT_NAME_DENIED"):private_write(self.root,"../secret.json",{})
 def test_22_private_source_sha256_exists(self):self.assertEqual(len(make_packet(self.f)[1]["source_private_redacted_sha256"]),64)
 def test_23_policy_tags_frozen(self):
  c={x["case_key"]:x["required_policy_tags"] for x in make_packet(self.f)[0]["cases"]}
  self.assertIn("STALE_PREVIEW_CONFLICT",c["MULTI:QA28"])
  self.assertIn("EXPECTED_TOTAL_REQUIRED",c["MULTI:QA20"])
 def test_24_never_certifies_independent_human(self):self.assertFalse(make_packet(self.f)[1]["external_independent_privacy_acceptance"])
 def test_25_explicit_no_send_flag_required(self):
  self.src["cases"][0].pop("send_to_provider_allowed");self.save()
  with self.assertRaisesRegex(ValueError,"EXPLICIT_NO_SEND_FLAG"):make_packet(self.f)
 def test_26_extra_sensitive_field_rejected(self):
  self.src["cases"][0]["secret_token"]="PRIVATE";self.save()
  with self.assertRaisesRegex(ValueError,"UNEXPECTED_PRIVATE_DATA_FIELD"):make_packet(self.f)
 def test_27_real_model_output_in_input_rejected(self):
  self.src["cases"][0]["actual_output"]="unverified real reply";self.save()
  with self.assertRaisesRegex(ValueError,"REAL_MODEL_OUTPUT_IN_SOURCE"):make_packet(self.f)
 def test_28_noncanonical_source_case_set_rejected(self):
  self.src["cases"][-1]["case_key"]="MULTI:QA99";self.save()
  with self.assertRaisesRegex(ValueError,"EXACT_SOURCE_CASE_ID_SET_REQUIRED"):make_packet(self.f)
if __name__=="__main__":unittest.main(verbosity=2)
