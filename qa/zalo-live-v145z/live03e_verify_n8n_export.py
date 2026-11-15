#!/usr/bin/env python3
"""TIEN404 LIVE03E. OFFLINE/LOCAL n8n export coverage verifier.

Never uploads, prints node code, secrets, credentials, PII, or full workflow
content. Reads owner-downloaded Cloud Console export JSON / JSON ZIP only.
A PASS means definition coverage only, NOT restored workflows or credentials.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import pathlib
import sys
import zipfile

MAX_ENTRY_BYTES = 8 * 1024 * 1024
MAX_TOTAL_BYTES = 60 * 1024 * 1024
MAX_FILES = 1000


def _decode_json(data: bytes):
    if len(data) > MAX_ENTRY_BYTES:
        raise ValueError("ENTRY_TOO_LARGE")
    return json.loads(data.decode("utf-8-sig"))


def _read_documents(source: pathlib.Path):
    if not source.exists():
        raise ValueError("EXPORT_PATH_NOT_FOUND")
    size = 0
    count = 0
    if source.is_dir():
        entries = sorted(source.rglob("*.json"))
        if len(entries) > MAX_FILES:
            raise ValueError("TOO_MANY_EXPORT_FILES")
        for entry in entries:
            if entry.is_symlink() or not entry.is_file():
                raise ValueError("UNSAFE_FILE_REFERENCE")
            payload = entry.read_bytes()
            size += len(payload)
            if size > MAX_TOTAL_BYTES:
                raise ValueError("EXPORT_TOO_LARGE")
            count += 1
            yield _decode_json(payload)
    elif zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as zipped:
            entries = [x for x in zipped.infolist() if x.filename.lower().endswith(".json") and not x.is_dir()]
            if len(entries) > MAX_FILES:
                raise ValueError("TOO_MANY_EXPORT_FILES")
            for entry in entries:
                if entry.file_size > MAX_ENTRY_BYTES:
                    raise ValueError("ENTRY_TOO_LARGE")
                size += entry.file_size
                if size > MAX_TOTAL_BYTES:
                    raise ValueError("EXPORT_TOO_LARGE")
                count += 1
                # Do NOT extract, execute, or emit the ZIP contents.
                with zipped.open(entry, "r") as stream:
                    yield _decode_json(stream.read(MAX_ENTRY_BYTES + 1))
    elif source.suffix.lower() == ".json":
        payload = source.read_bytes()
        if len(payload) > MAX_TOTAL_BYTES:
            raise ValueError("EXPORT_TOO_LARGE")
        yield _decode_json(payload)
    else:
        raise ValueError("EXPORT_MUST_BE_JSON_ZIP_OR_DIRECTORY")
    if count > MAX_FILES:
        raise ValueError("TOO_MANY_EXPORT_FILES")


def _objects(doc):
    if isinstance(doc, list):
        for item in doc:
            yield from _objects(item)
    elif isinstance(doc, dict):
        if isinstance(doc.get("nodes"), list) and isinstance(doc.get("connections"), dict) and doc.get("id") is not None:
            yield doc
        elif isinstance(doc.get("workflows"), list):
            yield from _objects(doc["workflows"])
        elif isinstance(doc.get("data"), list):
            yield from _objects(doc["data"])


def evaluate(source: pathlib.Path, manifest: dict, versions: dict):
    expected = {x["id"]: x for x in manifest["workflows"]}
    actual = {}
    duplicates = 0
    for document in _read_documents(source):
        for workflow in _objects(document):
            identifier = str(workflow["id"])
            if identifier in actual:
                duplicates += 1
            actual[identifier] = workflow

    expected_ids = set(expected)
    found_ids = set(actual)
    required_active = {ident for ident, row in expected.items() if row["active"]}
    active_present = required_active & found_ids
    active_status_conflicts = sum(
        isinstance(actual[i].get("active"), bool) and actual[i]["active"] is False
        for i in active_present
    )
    missing_status = sum(
        not isinstance(actual[i].get("active"), bool) for i in active_present
    )

    # Date/version reconciliation is only provable if the owner export contains
    # both Draft and Published version IDs. A backup ZIP often does not.
    version_missing = 0
    version_mismatch = 0
    for item in versions["different"]:
        obj = actual.get(item["id"])
        if obj is None:
            continue
        draft = obj.get("versionId") or obj.get("version_id")
        published = obj.get("activeVersionId") or obj.get("publishedVersionId")
        if not (draft and published):
            version_missing += 1
        elif (draft != item["draft_version_id"] or published != item["published_version_id"]):
            version_mismatch += 1

    covers_all = expected_ids <= found_ids and duplicates == 0 and active_status_conflicts == 0
    output = {
        "gate": "TIEN404_V145Z_LIVE03E_OWNER_LOCAL_EXPORT",
        "definition_coverage": "PASS" if covers_all else "BLOCKED",
        "expected_workflows": len(expected_ids),
        "found_workflows": len(found_ids),
        "missing_workflows": len(expected_ids - found_ids),
        "active_expected": len(required_active),
        "active_found": len(active_present),
        "active_conflicts": active_status_conflicts,
        "active_status_unknown": missing_status,
        "duplicate_ids": duplicates,
        "extra_ids": len(found_ids - expected_ids),
        "draft_published_pairs_expected": len(versions["different"]),
        "draft_published_pairs_unverified": version_missing,
        "draft_published_pairs_mismatch": version_mismatch,
        "credentials_verified": False,
        "data_tables_verified": False,
        "restore_tested": False,
        "ready_for_production": False,
        "backup_secret_content_printed": False,
        "note": "Coverage check only. Export may omit active Published graph, credentials and database data.",
    }
    return output


def main():
    parser = argparse.ArgumentParser(description="Verify n8n Cloud export locally; never upload secrets.")
    parser.add_argument("export_path", help="Owner-downloaded n8n Export JSON, ZIP or folder of JSON files")
    folder = pathlib.Path(__file__).resolve().parent
    parser.add_argument("--manifest", default=str(folder / "live03e-n8n-workflow-inventory.json"))
    parser.add_argument("--versions", default=str(folder / "live03e-active-version-differences.json"))
    args = parser.parse_args()
    try:
        with open(args.manifest, encoding="utf-8") as f:
            manifest = json.load(f)
        with open(args.versions, encoding="utf-8") as f:
            versions = json.load(f)
        if manifest.get("kind") != "TIEN404_N8N_METADATA_MANIFEST_NOT_A_BACKUP" or manifest.get("workflow_count") != 98:
            raise ValueError("SOURCE_MANIFEST_INVALID")
        result = evaluate(pathlib.Path(args.export_path), manifest, versions)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["definition_coverage"] == "PASS" else 2
    except (OSError, ValueError, KeyError, zipfile.BadZipFile, UnicodeError, json.JSONDecodeError) as ex:
        # Error reasons must not contain file bytes or credentials.
        kind = ex.args[0] if ex.args and ex.args[0] in {
            "SOURCE_MANIFEST_INVALID", "EXPORT_PATH_NOT_FOUND", "ENTRY_TOO_LARGE",
            "TOO_MANY_EXPORT_FILES", "EXPORT_TOO_LARGE", "UNSAFE_FILE_REFERENCE",
            "EXPORT_MUST_BE_JSON_ZIP_OR_DIRECTORY"
        } else "EXPORT_NOT_READABLE_OR_INVALID"
        print(json.dumps({"gate": "TIEN404_V145Z_LIVE03E_OWNER_LOCAL_EXPORT", "definition_coverage": "BLOCKED", "error": kind, "ready_for_production": False}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
