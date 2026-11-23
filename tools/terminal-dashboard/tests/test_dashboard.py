"""Test offline cho tien404_dash (không gọi mạng)."""
import datetime as dt
import io
import json
import sys
import unittest
import urllib.error
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import tien404_dash as d  # noqa: E402

FAKE_TOKEN = "ghp_" + "A" * 36
NOW = dt.datetime(2026, 11, 23, 15, 0, tzinfo=dt.timezone.utc)


class FakeResp(io.BytesIO):
    def __init__(self, payload, status=200, headers=None):
        super().__init__(json.dumps(payload).encode())
        self.status = status
        self.headers = headers or {"X-RateLimit-Remaining": "4999"}

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def fake_api(routes, seen):
    def opener(req, timeout=0):
        seen.append(req)
        path = req.full_url.replace(d.API, "")
        for prefix, payload in routes.items():
            if path.startswith(prefix):
                return FakeResp(payload)
        raise urllib.error.HTTPError(req.full_url, 404, "nf", {}, None)
    return opener


ROUTES = {
    "/repos/o/r/commits/develop/check-runs": {"check_runs": [
        {"name": "a", "status": "completed", "conclusion": "success"},
        {"name": "b", "status": "completed", "conclusion": "failure"},
        {"name": "c", "status": "in_progress", "conclusion": None}]},
    "/repos/o/r/commits/develop": {"sha": "abcdef1234", "commit": {"message": "Hello\nbody",
                                     "committer": {"date": "2026-11-23T13:00:00Z"}}},
    "/repos/o/r/pulls": [{"number": 7, "title": "Thử nghiệm tiếng Việt", "draft": True,
                          "created_at": "2026-11-22T15:00:00Z", "head": {"sha": "sha7"}, "base": {"ref": "develop"}}],
    "/repos/o/r/commits/sha7/check-runs": {"check_runs": [{"name": "x", "status": "completed", "conclusion": "success"}]},
}


class SummaryTests(unittest.TestCase):
    def test_summarize(self):
        s = d.summarize_checks(ROUTES["/repos/o/r/commits/develop/check-runs"]["check_runs"])
        self.assertEqual((s["pass"], s["fail"], s["pending"], s["total"]), (1, 1, 1, 3))


class ReaderTests(unittest.TestCase):
    def test_snapshot_uses_only_get_and_hides_token(self):
        seen = []
        r = d.GitHubReader("o/r", token=FAKE_TOKEN, opener=fake_api(ROUTES, seen))
        snap = r.snapshot("develop")
        self.assertTrue(seen)
        self.assertTrue(all(req.get_method() == "GET" for req in seen))
        self.assertEqual(snap["head"]["message"], "Hello")
        self.assertEqual(snap["prs"][0]["checks"]["pass"], 1)
        self.assertEqual(snap["rate_remaining"], "4999")
        self.assertNotIn(FAKE_TOKEN, json.dumps(snap))
        out = d.render(snap, [], [], now=NOW, color=False)
        self.assertNotIn(FAKE_TOKEN, out)

    def test_http_error_message_is_redacted(self):
        def boom(req, timeout=0):
            raise OSError("proxy said Authorization: Bearer " + FAKE_TOKEN)
        r = d.GitHubReader("o/r", token=FAKE_TOKEN, opener=boom)
        with self.assertRaises(RuntimeError) as cm:
            r.get("/x")
        self.assertNotIn(FAKE_TOKEN, str(cm.exception))

    def test_no_token_no_auth_header(self):
        seen = []
        d.GitHubReader("o/r", opener=fake_api(ROUTES, seen)).get("/repos/o/r/pulls")
        self.assertIsNone(seen[0].get_header("Authorization"))


class RedactTests(unittest.TestCase):
    def test_patterns(self):
        for secret in [FAKE_TOKEN, "github_pat_" + "b" * 30, "sbp_" + "c" * 30,
                       "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.abcdefghijk"]:
            self.assertNotIn(secret, d.redact(f"lỗi {secret} cuối"))

    def test_explicit_secret(self):
        self.assertEqual(d.redact("x mysecret y", ["mysecret"]), "x *** y")


class RenderTests(unittest.TestCase):
    def setUp(self):
        self.snap = json.loads((HERE / "data" / "sample_github.json").read_text(encoding="utf-8"))
        self.tasks = json.loads((HERE / "data" / "tasks.json").read_text(encoding="utf-8"))
        self.services = [d.check_service(s) for s in json.loads((HERE / "data" / "services.json").read_text(encoding="utf-8"))]

    def test_every_line_fits_width(self):
        for width in (72, 100, 120):
            for ascii_only in (False, True):
                out = d.render(self.snap, self.tasks, self.services, now=NOW, width=width,
                               color=False, ascii_only=ascii_only, mode="OFFLINE")
                for line in out.splitlines():
                    self.assertLessEqual(d.disp_width(line), width, (width, line))

    def test_color_output_has_green_on_black(self):
        out = d.render(self.snap, self.tasks, self.services, now=NOW)
        self.assertIn(d.BG, out)
        self.assertIn(d.GREEN, out)

    def test_ascii_mode_is_ascii_boxes(self):
        out = d.render(self.snap, [], [], now=NOW, color=False, ascii_only=True)
        self.assertNotIn("┌", out)
        self.assertNotIn("█", out)

    def test_samples_are_labelled(self):
        out = d.render(None, [], self.services, now=NOW, color=False)
        self.assertIn("[MẪU]", out)

    def test_done_tasks_hidden(self):
        out = d.render(None, [{"status": "done", "title": "đã xong ABC"}], [], now=NOW, color=False)
        self.assertNotIn("đã xong ABC", out)
        self.assertIn("Không còn việc", out)

    def test_error_shown(self):
        out = d.render(None, [], [], now=NOW, color=False, error="GitHub HTTP 403")
        self.assertIn("GitHub HTTP 403", out)

    def test_vietnam_time(self):
        out = d.render(None, [], [], now=NOW, color=False)
        self.assertIn("23/11/2026 22:00:00", out)


class ServiceTests(unittest.TestCase):
    def test_sample_passthrough(self):
        s = d.check_service({"name": "n8n", "source": "sample", "state": "paused"})
        self.assertTrue(s["sample"])
        self.assertEqual(s["state"], "paused")

    def test_http_requires_https(self):
        s = d.check_service({"name": "x", "source": "http", "health_url": "http://insecure"})
        self.assertEqual(s["state"], "unknown")

    def test_http_up_and_down(self):
        seen = []
        up = d.check_service({"name": "w", "source": "http", "health_url": "https://h/ok"},
                             opener=lambda req, timeout=0: (seen.append(req), FakeResp({}, 200))[1])
        self.assertEqual(up["state"], "up")
        self.assertFalse(up["sample"])
        self.assertEqual(seen[0].get_method(), "GET")
        self.assertIsNone(seen[0].get_header("Authorization"))

        def fail(req, timeout=0):
            raise urllib.error.HTTPError(req.full_url, 503, "x", {}, None)
        down = d.check_service({"name": "w", "source": "http", "health_url": "https://h/ok"}, opener=fail)
        self.assertEqual(down["state"], "down")


class CliTests(unittest.TestCase):
    def test_offline_cli_runs(self):
        buf = io.StringIO()
        old = sys.stdout
        sys.stdout = buf
        try:
            rc = d.main(["--offline", "--no-anim", "--no-color", "--width", "90"])
        finally:
            sys.stdout = old
        self.assertEqual(rc, 0)
        self.assertIn("VIỆC ĐANG CHỜ", buf.getvalue())


if __name__ == "__main__":
    unittest.main()
