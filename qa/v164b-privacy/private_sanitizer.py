#!/usr/bin/env python3
"""V16.4B PRIVATE/offline QA corpus sanitizer.
PUBLIC REPO CONTAINS THIS TOOL, NOT THE USER'S QA DATA.
No network, no models, no provider send, no credential reads and no customer writes.
Original prompts must never be printed, logged or committed.
All output is UNAPPROVED FOR PROVIDER TRANSFER pending a human review.
"""
from __future__ import annotations
import argparse,csv,hashlib,io,json,os,pathlib,re,collections,stat,tempfile

SCHEMAS={
 'single':('case_id','chatInput','expected_behavior','actual_output'),
 'dialogue':('case_id','group','mode','turns_json','expected_behavior','status'),
 'historical':('case_id','chatInput','expected_behavior','actual_output')}
MASKS=(
 ('provider_key',re.compile(r'(?<!\w)(?:sk-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{16,})')),
 ('email',re.compile(r'(?<![\w.+-])[\w.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')),
 ('url',re.compile(r'https?://[^\s<>"\u201d]+',re.I)),
 ('vn_phone',re.compile(r'(?<!\d)(?:\+84|0)\d{9}(?!\d)')),
 ('long_numeric_id',re.compile(r'(?<!\d)\d{11,18}(?!\d)')) )
CSV_FORMULA=re.compile(r'^\s*[=+\-@]')
CASE_ID=re.compile(r'^QA\d{2}$')
SAFE_OUTPUTS={'local_corpus':'QA_PRIVATE_REDACTED_REVIEW_REQUIRED.json',
 'audit':'QA_PRIVATE_SANITIZATION_AUDIT.json'}
MAX_BYTES=2_000_000
def sha(raw:bytes)->str:return hashlib.sha256(raw).hexdigest()
def load_csv(path:pathlib.Path,kind:str):
 raw=path.read_bytes()
 if len(raw)>MAX_BYTES:raise ValueError('PRIVATE_FILE_TOO_LARGE')
 try:text=raw.decode('utf-8-sig')
 except UnicodeDecodeError:raise ValueError('UTF8_REQUIRED') from None
 try:r=csv.DictReader(io.StringIO(text,newline=''))
 except csv.Error:raise ValueError('CSV_PARSE_ERROR') from None
 if tuple(r.fieldnames or ())!=SCHEMAS[kind]:raise ValueError('STRICT_PRIVATE_CSV_SCHEMA_REQUIRED')
 rows=list(r)
 if any(None in row or any(x is None for x in row.values()) for row in rows):raise ValueError('MALFORMED_PRIVATE_CSV')
 if not all(CASE_ID.fullmatch(row.get('case_id','')) for row in rows):raise ValueError('QA_ONLY_CASE_ID_REQUIRED')
 return rows,sha(raw)
def validate(single,dialogue,historical):
 s,sd=load_csv(single,'single');d,dd=load_csv(dialogue,'dialogue');h,hd=load_csv(historical,'historical')
 ids=lambda rows:collections.Counter(x['case_id'] for x in rows)
 if len(s)!=96 or len(ids(s))!=96 or set(ids(s))!={f'QA{i:02}' for i in range(1,97)}:
  raise ValueError('EXPECTED_96_UNIQUE')
 if len(d)!=36 or len(ids(d))!=36 or set(ids(d))!={f'QA{i:02}' for i in range(1,37)}:
  raise ValueError('EXPECTED_36_UNIQUE')
 if len(h)!=97 or len(ids(h))!=96 or ids(h)['QA01']!=2:raise ValueError('HISTORICAL_DUPLICATE_BASELINE_DRIFT')
 if any(row['actual_output'].strip() for row in s):raise ValueError('SINGLE_ALREADY_HAS_MODEL_OUTPUT')
 if any(row['status']!='NOT_RUN' or row['mode']!='dialogue' for row in d):raise ValueError('DIALOGUE_SHOULD_BE_NOT_RUN')
 parsed=[];counts=collections.Counter()
 for row in d:
  try:turns=json.loads(row['turns_json'])
  except json.JSONDecodeError:raise ValueError('INVALID_DIALOGUE_JSON') from None
  if not isinstance(turns,list) or not(1<=len(turns)<=12) or any(not isinstance(t,str) or not t.strip() for t in turns):
   raise ValueError('INVALID_DIALOGUE_STRUCTURE')
  parsed.append(turns);counts[len(turns)]+=1
 if sum(len(x) for x in parsed)!=71 or counts!={1:9,2:21,3:4,4:2}:
  raise ValueError('EXPECTED_71_DIALOGUE_TURNS_AND_DISTRIBUTION')
 return (s,d,h,parsed),{'single':sd,'dialogue':dd,'historical':hd}
def scrub(value:str,counts):
 if not isinstance(value,str):raise ValueError('UNEXPECTED_TEXT_TYPE')
 for name,pattern in MASKS:
  value,n=pattern.subn('[QA_REDACTED_'+name.upper()+']',value)
  counts[name]+=n
 # Never allow CSV spreadsheet formula execution if a future exporter materializes this.
 if CSV_FORMULA.match(value):counts['spreadsheet_formula_prefix']+=1;value='[QA_TEXT_PREFIX_GUARD] '+value
 return value
def sanitize(single,dialogue,historical):
 (s,d,h,turns),fingerprints=validate(single,dialogue,historical)
 counts=collections.Counter()
 synthetic=[]
 for row in s:
  synthetic.append({'case_key':'SINGLE:'+row['case_id'],'turns':[scrub(row['chatInput'],counts)],
    'expected_behavior':scrub(row['expected_behavior'],counts),
    'actual_output':None,'source_kind':'LOCAL_REDACTED_CANDIDATE_ONLY',
    'privacy_gate':'HUMAN_REVIEW_REQUIRED','send_to_provider_allowed':False})
 for row,t in zip(d,turns):
  synthetic.append({'case_key':'MULTI:'+row['case_id'],'turns':[scrub(x,counts) for x in t],
    'expected_behavior':scrub(row['expected_behavior'],counts),
    'actual_output':None,'source_kind':'LOCAL_REDACTED_CANDIDATE_ONLY',
    'privacy_gate':'HUMAN_REVIEW_REQUIRED','send_to_provider_allowed':False})
 # Historical outputs intentionally excluded from candidate data and golden fixtures.
 hist_counts=collections.Counter()
 for row in h:
  scrub(row['chatInput'],hist_counts)
  scrub(row['expected_behavior'],hist_counts)
  scrub(row['actual_output'],hist_counts)
 report={
  'contract':'T404_V164B_PRIVATE_SANITIZATION_AUDIT_V1',
  'source_fingerprints_sha256':fingerprints,
  'single_count':len(s),'dialogue_count':len(d),'dialogue_turn_count':sum(map(len,turns)),
  'case_count':len(synthetic),'genuine_multi_turn':sum(len(t)>1 for t in turns),
  'one_turn_in_dialogue_pack':sum(len(t)==1 for t in turns),
  'candidate_redaction_counts':dict(sorted(counts.items())),
  'historical_screening_counts':dict(sorted(hist_counts.items())),
  'historical_text_exported':False,'raw_source_exported':False,
  'private_candidate_output_contains_redacted_text':True,
  'automated_detection_can_miss_names_and_addresses':True,
  'pii_review_complete':False,'provider_transfer_allowed':False,
  'golden_behavior_independently_reviewed':False,'model_evaluation_ran':False,
  'status':'BLOCKED_PENDING_MANUAL_PRIVACY_CLASSIFICATION'}
 return synthetic,report
def write_private(directory:pathlib.Path,filename:str,obj):
 if filename not in SAFE_OUTPUTS.values():raise ValueError('OUTPUT_NAME_DENIED')
 directory.mkdir(mode=0o700,parents=True,exist_ok=True)
 if directory.is_symlink() or not directory.is_dir():raise ValueError('OUTPUT_DIR_SYMLINK_DENIED')
 target=directory/filename
 payload=(json.dumps(obj,ensure_ascii=False,indent=2,sort_keys=True)+'\n').encode('utf-8')
 flags=os.O_WRONLY|os.O_CREAT|os.O_EXCL
 if hasattr(os,'O_NOFOLLOW'):flags|=os.O_NOFOLLOW
 fd=os.open(target,flags,0o600)
 try:
  with os.fdopen(fd,'wb') as f:f.write(payload)
 except BaseException:
  try:target.unlink()
  except OSError:pass
  raise
 return target
def main(argv=None):
 p=argparse.ArgumentParser()
 p.add_argument('--single',type=pathlib.Path,required=True)
 p.add_argument('--dialogue',type=pathlib.Path,required=True)
 p.add_argument('--historical',type=pathlib.Path,required=True)
 p.add_argument('--private-output-dir',type=pathlib.Path)
 a=p.parse_args(argv)
 data,report=sanitize(a.single,a.dialogue,a.historical)
 if a.private_output_dir:
  write_private(a.private_output_dir,SAFE_OUTPUTS['local_corpus'],{
   'contract':'T404_V164B_LOCAL_REDACTED_CORPUS_V1',
   'classification':'PRIVATE_REVIEW_REQUIRED_NOT_FOR_PROVIDER',
   'cases':data,'model_calls':0,'provider_transfer_allowed':False})
  write_private(a.private_output_dir,SAFE_OUTPUTS['audit'],report)
 print(json.dumps({'status':report['status'],'case_count':report['case_count'],
   'dialogue_turn_count':report['dialogue_turn_count'],
   'redaction_type_counts':report['candidate_redaction_counts'],
   'historical_screening_type_counts':report['historical_screening_counts'],
   'private_files_written':bool(a.private_output_dir),'raw_source_printed':False}))
 return 0
if __name__=='__main__':raise SystemExit(main())
