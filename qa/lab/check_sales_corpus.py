"""Check the four Project CSV inputs without emitting prompts or captured replies."""
import argparse
import csv
import json
from collections import Counter
from pathlib import Path


def read_cases(path, required):
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not required.issubset(reader.fieldnames or ()):
            raise ValueError("Missing required columns")
        rows = list(reader)
    if not rows or any(not row["case_id"].strip() for row in rows):
        raise ValueError("Empty case list or ID")
    return rows


def audit(history, multi, single, copy):
    columns = {"case_id", "chatInput", "expected_behavior", "actual_output"}
    baseline = read_cases(single, columns)
    if single.read_bytes() != copy.read_bytes():
        raise ValueError("Single-turn copies differ")
    recorded = read_cases(history, columns)
    turns = read_cases(multi, {"case_id", "turns_json", "expected_behavior", "status"})
    keys = ("case_id", "chatInput", "expected_behavior")
    signatures = {tuple(row[key] for key in keys) for row in baseline}
    if len({row["case_id"] for row in baseline}) != len(baseline):
        raise ValueError("Duplicate baseline ID")
    if signatures != {tuple(row[key] for key in keys) for row in recorded}:
        raise ValueError("History and baseline definitions differ")
    if len({row["case_id"] for row in turns}) != len(turns):
        raise ValueError("Duplicate multi-turn ID")
    turn_counts = Counter()
    for row in turns:
        messages = json.loads(row["turns_json"])
        if not isinstance(messages, list) or not messages or not all(
            isinstance(message, str) and message.strip() for message in messages
        ):
            raise ValueError("Invalid conversation")
        turn_counts[len(messages)] += 1
    return dict(turn_counts=dict(turn_counts), single=len(baseline), history_rows=len(recorded),
                repeated_history_rows=len(recorded) - len(signatures),
                baseline_outputs=sum(bool(row["actual_output"].strip()) for row in baseline),
                multi=len(turns), multi_status=dict(Counter(row["status"] for row in turns)))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ("history", "multi", "single", "copy"):
        parser.add_argument(arg, type=Path)
    print(json.dumps(audit(**vars(parser.parse_args())), sort_keys=True))
