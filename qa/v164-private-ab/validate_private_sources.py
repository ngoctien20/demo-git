#!/usr/bin/env python3
"""V16.4 private CSV validator. STDOUT: COUNTS and HASHES ONLY.
Offline-only; never sends or prints chatInput, turns_json, expected_behavior,
actual_output, names, phones or raw user records. Needs explicit local file paths.
No external libraries, network, credentials, model API or public fixture upload.
"""
from __future__ import annotations
import argparse,csv,hashlib,io,json,pathlib,re,collections
SINGLE_FIELDS=['case_id','chatInput','expected_behavior','actual_output']
MULTI_FIELDS=['case_id','group','mode','turns_json','expected_behavior','status']
HISTORICAL_FIELDS=SINGLE_FIELDS
ID=re.compile(r'^QA\d{2}$')
PHONE=re.compile(r'(?<!\d)(?:\+84|0)\d{9}(?!\d)')
def digest(raw:bytes)->str:return hashlib.sha256(raw).hexdigest()
def read_csv(p:pathlib.Path,cols:list[str]):
    if p.stat().st_size>2_000_000:raise ValueError('PRIVATE_DATASET_SIZE_BOUND')
    raw=p.read_bytes()
    try:source=raw.decode('utf-8-sig')
    except UnicodeDecodeError:raise ValueError('CSV_ENCODING_NOT_UTF8') from None
    reader=csv.DictReader(io.StringIO(source,newline=''))
    if reader.fieldnames!=cols:raise ValueError('CSV_SCHEMA_MISMATCH')
    rows=list(reader)
    if any(None in r or any(v is None for v in r.values()) for r in rows):
        raise ValueError('CSV_MALFORMED_ROW')
    return rows,digest(raw),source
def ids(rows):
    out=[r['case_id'] for r in rows]
    if any(not ID.fullmatch(x) for x in out):raise ValueError('INVALID_CASE_ID')
    return out
def analyze(single:pathlib.Path,multi:pathlib.Path,historical:pathlib.Path|None=None):
    s,sh,st=read_csv(single,SINGLE_FIELDS)
    m,mh,mt=read_csv(multi,MULTI_FIELDS)
    if len(s)!=96 or len(set(ids(s)))!=96 or {f'QA{i:02}' for i in range(1,97)}!=set(ids(s)):
        raise ValueError('SINGLE_EXPECTED_96_UNIQUE')
    if len(m)!=36 or len(set(ids(m)))!=36 or {f'QA{i:02}' for i in range(1,37)}!=set(ids(m)):
        raise ValueError('DIALOGUE_EXPECTED_36_UNIQUE')
    if any((r.get('actual_output') or '').strip() for r in s):
        raise ValueError('SINGLE_OUTPUT_NONEMPTY_REQUIRES_NEW_BASELINE_AND_REVIEW')
    if any(r['status']!='NOT_RUN' or r['mode']!='dialogue' for r in m):
        raise ValueError('DIALOGUE_NOT_UNRUN_OR_INVALID_MODE')
    turns=[]
    for r in m:
        try:arr=json.loads(r['turns_json'])
        except json.JSONDecodeError:raise ValueError('INVALID_DIALOGUE_JSON') from None
        if not isinstance(arr,list) or not(1<=len(arr)<=12) or any(
                not isinstance(x,str) or not x.strip() for x in arr):
            raise ValueError('INVALID_DIALOGUE_STRUCTURE')
        turns.append(len(arr))
    dist=dict(sorted(collections.Counter(turns).items()))
    if sum(turns)!=71 or dist!={1:9,2:21,3:4,4:2}:
        raise ValueError('DIALOGUE_TURN_DISTRIBUTION_DRIFT')
    result={'contract':'T404_V164_PRIVATE_LOCAL_SOURCE_AUDIT_V1',
      'source_type':'USER_PROVIDED_LOCAL_CSV_NOT_UPLOADED',
      'single_rows':96,'single_unique_ids':96,'single_blank_output':96,
      'dialogue_pack_rows':36,'dialogue_unique_ids':36,
      'dialogue_turns':71,'dialogue_turn_distribution':{str(k):v for k,v in dist.items()},
      'genuine_multi_turn_cases':27,'one_turn_in_dialogue_pack':9,
      'case_model_pairs_for_3_candidates':396,
      'min_model_requests_for_full_3_candidate_turn_replay':501,
      'source_sha256':{'single':sh,'dialogue':mh},
      'phones_like_tokens_detected_by_regex':len(PHONE.findall(st))+len(PHONE.findall(mt)),
      'possible_PII_needs_independent_review':True,
      'model_outputs_evaluated':0,'model_api_calls':0,'certified_quality_pass':0,
      'contents_or_prompts_exported':False,
      'ready_for_paid_api':False}
    if historical:
        h,hh,ht=read_csv(historical,HISTORICAL_FIELDS)
        c=collections.Counter(ids(h))
        if len(h)!=97 or len(c)!=96 or c.get('QA01')!=2:
            raise ValueError('HISTORICAL_SOURCE_EXPECTED_QA01_DUPLICATE')
        result['historical_rows']=97
        result['historical_unique_ids']=96
        result['historical_qa01_duplicate']=True
        result['source_sha256']['historical']=hh
        result['phones_like_tokens_detected_by_regex']+=len(PHONE.findall(ht))
    return result
def self_test():
    single='\n'.join([','.join(SINGLE_FIELDS)]+[
      f'QA{i:02},qa synthetic question,expected synthetic,' for i in range(1,97)])+'\n'
    counts=[2,3,1,2,3,3,4,4,2,2,2,2,2,2,2,2,1,1,3,2,2,2,2,2,1,1,1,2,1,1,2,2,2,2,2,1]
    stream=io.StringIO(newline='')
    w=csv.DictWriter(stream,fieldnames=MULTI_FIELDS);w.writeheader()
    for i,n in enumerate(counts,1):
        w.writerow({'case_id':f'QA{i:02}','group':'QA','mode':'dialogue',
          'turns_json':json.dumps(['QA synthetic turn']*n),
          'expected_behavior':'safe','status':'NOT_RUN'})
    def parse(s,cols):
        r=csv.DictReader(io.StringIO(s))
        assert r.fieldnames==cols
        return list(r)
    s=parse(single,SINGLE_FIELDS);m=parse(stream.getvalue(),MULTI_FIELDS)
    assert len(s)==96 and len(m)==36
    assert {len(json.loads(x['turns_json'])):counts.count(len(json.loads(x['turns_json']))) for x in m}=={1:9,2:21,3:4,4:2}
    assert sum(counts)==71
    assert len(PHONE.findall(single))==0
    return {'status':'PASS','cases':96+36,'dialogue_turns':sum(counts),
     'synthetic_self_test_only':True,'real_source_not_required_in_public_CI':True}
if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--single',type=pathlib.Path)
    ap.add_argument('--multi',type=pathlib.Path)
    ap.add_argument('--historical',type=pathlib.Path)
    ap.add_argument('--self-test',action='store_true')
    ap.add_argument('--out',type=pathlib.Path)
    args=ap.parse_args()
    if args.self_test:result=self_test()
    else:
        if not args.single or not args.multi:ap.error('--single and --multi required')
        result=analyze(args.single,args.multi,args.historical)
    encoded=json.dumps(result,indent=2,ensure_ascii=False)
    if args.out:
        if args.out.exists():raise SystemExit('OUTPUT_EXISTS_REFUSE_OVERWRITE')
        args.out.write_text(encoded+'\n',encoding='utf-8')
    print(encoded)
