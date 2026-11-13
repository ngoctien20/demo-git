"""Offline safety replay of the owner's four CSV exports. Never print chat text."""
import csv
import json
import subprocess
import sys
from pathlib import Path

directory = Path(__file__).resolve().parent
sys.path.insert(0, str(directory.parent / "lab"))
from check_sales_corpus import audit

history, multi, single, copy = map(Path, sys.argv[1:])
print(json.dumps(audit(history, multi, single, copy)), flush=True)
cases = []
for path, multi_turn in ((single, False), (multi, True)):
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            turns = json.loads(row["turns_json"]) if multi_turn else [row["chatInput"]]
            cases.append({"id": ("multi-" if multi_turn else "") + row["case_id"], "turns": turns})
subprocess.run(["node", str(directory / "replay.cjs")], input=json.dumps(cases), text=True, check=True)
