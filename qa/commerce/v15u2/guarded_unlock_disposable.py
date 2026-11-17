#!/usr/bin/env python3
"""Guarded review-only SQL -> tempfile for *already verified local PG17 disposable*.
Does not connect to database. NEVER emit an unlocked SQL to hosted or GitHub logs.
"""
from pathlib import Path
import os,sys,re

EXPECTED = {
    "01_MAPPING_SCHEMA_REVIEW_ONLY.sql": "REVIEW_ONLY_V15_0_10U1_NO_APPROVED_MIGRATION",
    "02_READER_POLICY_REVIEW_ONLY.sql": "REVIEW_ONLY_NO_APPROVED_JWT_ROLE_BRIDGE",
    "03_ROLLBACK_REVIEW_ONLY.sql": "REVIEW_ONLY_ROLLBACK_NOT_APPROVED",
}
def unlock(source:Path,destination:Path)->None:
    if os.environ.get("TIEN404_PG17_DISPOSABLE_QA")!="ONE_TIME_APPROVED_ONLY":
        raise RuntimeError("ENV_APPROVAL_MISSING")
    if os.environ.get("PGHOST") != "127.0.0.1" or os.environ.get("PGDATABASE")!="tien404_v15u2_disposable":
        raise RuntimeError("DISPOSABLE_TARGET_NOT_VERIFIED")
    if source.name not in EXPECTED:raise RuntimeError("SOURCE_NOT_A_REVIEW_SQL")
    if source.parent.resolve()==destination.parent.resolve() or destination.resolve()==source.resolve():
        raise RuntimeError("DO_NOT_OVERWRITE_REVIEW_SOURCE")
    text=source.read_text(encoding="utf-8")
    line="DO $$ BEGIN RAISE EXCEPTION '"+EXPECTED[source.name]+"'; END $$;"
    if text.count(line)!=1 or text.count("REVIEW_ONLY_")<1 or text.count("BEGIN;")!=1 or text.count("COMMIT;")!=1:
        raise RuntimeError("SOURCE_REVIEW_GUARD_CHANGED")
    output=text.replace(line,"-- One-time disposable PG17 review guard intentionally suppressed by guarded wrapper",1)
    if "REVIEW_ONLY_" in output and "RAISE EXCEPTION 'REVIEW_ONLY_" in output:
        raise RuntimeError("UNEXPECTED_ACTIVE_GUARD")
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(output,encoding="utf-8")
if __name__=="__main__":
    if len(sys.argv)!=3:raise SystemExit("Usage: source.sql disposable_tempfile.sql")
    unlock(Path(sys.argv[1]),Path(sys.argv[2]))