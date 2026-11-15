#!/usr/bin/env python3
"""Synthetic regression only. Never uses real workflow definitions."""
import importlib.util
import json
import pathlib
import tempfile
import unittest
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("live03e_export_validator", ROOT / "live03e_verify_n8n_export.py")
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)

manifest = json.loads((ROOT / "live03e-n8n-workflow-inventory.json").read_text())
versions = json.loads((ROOT / "live03e-active-version-differences.json").read_text())


def make_workflows():
    return [
        {"id": row["id"], "name": "synthetic-fixture", "active": row["active"], "nodes": [], "connections": {}}
        for row in manifest["workflows"]
    ]


def write_json(folder, data):
    p = pathlib.Path(folder) / "workflows.json"
    p.write_text(json.dumps({"workflows": data}), encoding="utf-8")
    return p


class ExportVerifierTests(unittest.TestCase):
    def test_fixture_counts_match_manifest(self):
        self.assertEqual(len(make_workflows()), 98)
        self.assertEqual(sum(w["active"] for w in make_workflows()), 19)

    def test_complete_json_export_coverage_pass(self):
        with tempfile.TemporaryDirectory() as d:
            r = verifier.evaluate(write_json(d, make_workflows()), manifest, versions)
            self.assertEqual(r["definition_coverage"], "PASS")
            self.assertEqual(r["active_found"], 19)
            self.assertFalse(r["restore_tested"])
            self.assertFalse(r["ready_for_production"])
            self.assertEqual(r["draft_published_pairs_unverified"], 4)

    def test_zip_export_coverage_pass_without_extracting(self):
        with tempfile.TemporaryDirectory() as d:
            z = pathlib.Path(d) / "backup.zip"
            with zipfile.ZipFile(z, "w") as f:
                f.writestr("workflows.json", json.dumps(make_workflows()))
            self.assertEqual(verifier.evaluate(z, manifest, versions)["definition_coverage"], "PASS")

    def test_directory_of_separate_json_workflows_pass(self):
        with tempfile.TemporaryDirectory() as d:
            for i, item in enumerate(make_workflows()):
                (pathlib.Path(d) / f"wf{i:03d}.json").write_text(json.dumps(item))
            self.assertEqual(verifier.evaluate(pathlib.Path(d), manifest, versions)["definition_coverage"], "PASS")

    def test_missing_active_definition_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            data = make_workflows()
            active = next(w for w in data if w["active"])
            data = [x for x in data if x["id"] != active["id"]]
            r = verifier.evaluate(write_json(d, data), manifest, versions)
            self.assertEqual(r["definition_coverage"], "BLOCKED")
            self.assertEqual(r["missing_workflows"], 1)
            self.assertEqual(r["active_found"], 18)

    def test_duplicate_workflow_ids_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            items = make_workflows()
            r = verifier.evaluate(write_json(d, items + [items[0]]), manifest, versions)
            self.assertEqual(r["definition_coverage"], "BLOCKED")
            self.assertEqual(r["duplicate_ids"], 1)

    def test_exported_active_false_conflict_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            items = make_workflows()
            a = next(w for w in items if w["active"])
            a["active"] = False
            r = verifier.evaluate(write_json(d, items), manifest, versions)
            self.assertEqual(r["definition_coverage"], "BLOCKED")
            self.assertEqual(r["active_conflicts"], 1)

    def test_missing_active_status_is_reported_not_silently_fabricated(self):
        with tempfile.TemporaryDirectory() as d:
            items = make_workflows()
            items[0].pop("active")
            r = verifier.evaluate(write_json(d, items), manifest, versions)
            self.assertTrue("active_status_unknown" in r)

    def test_declared_version_pair_mismatch_reported(self):
        with tempfile.TemporaryDirectory() as d:
            items = make_workflows()
            target = next(w for w in items if w["id"] == versions["different"][0]["id"])
            target["versionId"] = "some-stale-draft"
            target["activeVersionId"] = "some-stale-published"
            r = verifier.evaluate(write_json(d, items), manifest, versions)
            self.assertEqual(r["draft_published_pairs_mismatch"], 1)
            self.assertFalse(r["ready_for_production"])

    def test_oversized_zip_entry_denied(self):
        with tempfile.TemporaryDirectory() as d:
            z = pathlib.Path(d) / "large.zip"
            with zipfile.ZipFile(z, "w") as f:
                f.writestr("large.json", "x" * (verifier.MAX_ENTRY_BYTES + 1))
            with self.assertRaisesRegex(ValueError, "ENTRY_TOO_LARGE"):
                list(verifier._read_documents(z))

    def test_missing_export_file_denied(self):
        with self.assertRaisesRegex(ValueError, "EXPORT_PATH_NOT_FOUND"):
            list(verifier._read_documents(pathlib.Path("/path-not-existing-n8n-qa-01392.json"))


if __name__ == "__main__":
    unittest.main()
