import unittest,csv,io,json,pathlib,tempfile,os,stat
from private_sanitizer import SCHEMAS,validate,sanitize,scrub,write_private,SAFE_OUTPUTS
COUNTS=[2,3,1,2,3,3,4,4,2,2,2,2,2,2,2,2,1,1,3,2,2,2,2,2,1,1,1,2,1,1,2,2,2,2,2,1]
def csv_write(path,fields,rows):
 with open(path,'w',encoding='utf-8',newline='') as f:
  w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
class PrivacyFixture(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory()
  self.addCleanup(self.tmp.cleanup)
  root=pathlib.Path(self.tmp.name)
  self.single=root/'single.csv';self.dialogue=root/'dialogue.csv';self.hist=root/'historical.csv'
  s=[{'case_id':f'QA{i:02}','chatInput':'QA synthetic question '+('0901234567' if i==1 else 'text'),
    'expected_behavior':'Expected QA result','actual_output':''} for i in range(1,97)]
  d=[{'case_id':f'QA{i:02}','group':'synthetic','mode':'dialogue',
   'turns_json':json.dumps(['QA test text '+('sk-1234567890123456' if i==1 else 'dialogue')]*n),
   'expected_behavior':'redact +84901234567' if i==1 else 'safe','status':'NOT_RUN'}
    for i,n in enumerate(COUNTS,1)]
  h=[{'case_id':f'QA{i:02}','chatInput':'private baseline',
    'expected_behavior':'expected','actual_output':'QA historical response'} for i in range(1,97)]
  h.append(dict(h[0]))
  csv_write(self.single,SCHEMAS['single'],s);csv_write(self.dialogue,SCHEMAS['dialogue'],d)
  csv_write(self.hist,SCHEMAS['historical'],h)
 def go(self):return sanitize(self.single,self.dialogue,self.hist)
 def test_01_inventory(self):
  data,report=self.go()
  self.assertEqual((len(data),report['dialogue_turn_count'],report['genuine_multi_turn']),(132,71,27))
 def test_02_no_genuine_model_output(self):
  data,_=self.go();self.assertTrue(all(x['actual_output'] is None for x in data))
 def test_03_phone_redacted(self):
  data,_=self.go();self.assertIn('[QA_REDACTED_VN_PHONE]',data[0]['turns'][0])
  self.assertNotIn('0901234567',json.dumps(data))
 def test_04_api_key_redacted(self):
  data,_=self.go();self.assertIn('[QA_REDACTED_PROVIDER_KEY]',data[96]['turns'][0])
  self.assertNotIn('sk-1234567890123456',json.dumps(data))
 def test_05_provider_transfer_explicitly_false(self):
  data,report=self.go();self.assertTrue(all(x['send_to_provider_allowed'] is False for x in data))
  self.assertFalse(report['provider_transfer_allowed'])
 def test_06_historical_not_in_model_corpus(self):
  data,_=self.go();self.assertNotIn('QA historical response',json.dumps(data))
 def test_07_redacted_direct_email(self):
  import collections
  self.assertIn('[QA_REDACTED_EMAIL]',scrub('test@example.org',collections.Counter()))
 def test_08_redacted_direct_url(self):
  import collections
  self.assertIn('[QA_REDACTED_URL]',scrub('https://example.org/t?key=private',collections.Counter()))
 def test_09_long_numeric_id(self):
  import collections
  self.assertIn('[QA_REDACTED_LONG_NUMERIC_ID]',scrub('123456789012',collections.Counter()))
 def test_10_formula_injection_guard(self):
  import collections
  self.assertTrue(scrub('=IMPORTXML("x")',collections.Counter()).startswith('[QA_TEXT_PREFIX_GUARD]'))
 def test_11_strict_header_required(self):
  with self.single.open('w',encoding='utf-8') as f:f.write('case_id,input\n')
  with self.assertRaisesRegex(ValueError,'STRICT_PRIVATE_CSV_SCHEMA_REQUIRED'):self.go()
 def test_12_reject_changed_dialogue_turn_count(self):
  rows=list(csv.DictReader(self.dialogue.open(encoding='utf-8',newline='')))
  rows[0]['turns_json']=json.dumps(['wrong count'])
  csv_write(self.dialogue,SCHEMAS['dialogue'],rows)
  with self.assertRaisesRegex(ValueError,'EXPECTED_71_DIALOGUE_TURNS'):self.go()
 def test_13_output_files_private_mode(self):
  data,report=self.go();directory=pathlib.Path(self.tmp.name)/'private_data'
  target=write_private(directory,SAFE_OUTPUTS['audit'],report)
  self.assertEqual(stat.S_IMODE(target.stat().st_mode),0o600)
  self.assertEqual(stat.S_IMODE(directory.stat().st_mode),0o700)
 def test_14_refuse_overwrite(self):
  _,report=self.go();directory=pathlib.Path(self.tmp.name)/'private_data'
  write_private(directory,SAFE_OUTPUTS['audit'],report)
  with self.assertRaises(FileExistsError):write_private(directory,SAFE_OUTPUTS['audit'],report)
 def test_15_reject_arbitrary_file_path(self):
  _,report=self.go();directory=pathlib.Path(self.tmp.name)/'private_data'
  with self.assertRaisesRegex(ValueError,'OUTPUT_NAME_DENIED'):write_private(directory,'../unsafe.json',report)
 def test_16_audit_does_not_include_original_message_text(self):
  _,report=self.go();self.assertNotIn('0901234567',json.dumps(report))
 def test_17_historical_duplicate_guard(self):
  rows=list(csv.DictReader(self.hist.open(encoding='utf-8',newline='')))
  csv_write(self.hist,SCHEMAS['historical'],rows[:-1])
  with self.assertRaisesRegex(ValueError,'HISTORICAL_DUPLICATE_BASELINE_DRIFT'):self.go()
 def test_18_unicode_utf8_roundtrip(self):
  import collections
  self.assertEqual(scrub('Tư vấn áo trắng và giá sỉ',collections.Counter()),'Tư vấn áo trắng và giá sỉ')
 def test_19_report_never_certifies_privacy(self):
  _,report=self.go();self.assertFalse(report['pii_review_complete'])
  self.assertEqual(report['status'],'BLOCKED_PENDING_MANUAL_PRIVACY_CLASSIFICATION')
 def test_20_contract_zero_api(self):
  data,report=self.go();self.assertEqual(len(data),132)
  self.assertFalse(report['model_evaluation_ran'])
if __name__=='__main__':unittest.main(verbosity=2)
