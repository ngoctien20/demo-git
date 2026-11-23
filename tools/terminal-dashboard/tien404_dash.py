#!/usr/bin/env python3
"""TIEN404 terminal dashboard — CHỈ ĐỌC.

Hiển thị trạng thái dự án (PR, CI, việc đang chờ, dịch vụ) trên nền đen chữ xanh.
Chỉ dùng thư viện chuẩn của Python 3.8+, chạy được trên Windows/macOS/Linux.

An toàn:
  * Chỉ gửi GET tới GitHub REST API công khai (và URL health check nếu bạn tự điền).
  * Token (nếu có trong GITHUB_TOKEN / GH_TOKEN) chỉ nằm trong header, không bao giờ
    được in ra hay ghi xuống đĩa; mọi thông báo lỗi đều được lọc token.
  * Không ghi, không sửa gì trên hệ thống thật.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import re
import shutil
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
DEFAULT_REPO = "ngoctien20/demo-git"
DEFAULT_BRANCH = "develop"
API = "https://api.github.com"
VN_TZ = _dt.timezone(_dt.timedelta(hours=7), "ICT")
USER_AGENT = "tien404-terminal-dashboard"

# ───────────────────────────── màu ANSI ─────────────────────────────
GREEN = "\033[32m"
BRIGHT = "\033[92m"
DIM = "\033[2;32m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"
BG = "\033[40m"
CLEAR = "\033[2J\033[H"
ANSI_RE = re.compile(r"\033\[[0-9;]*[A-Za-z]")

BANNER = [
    "████████ ██ ███████ ███    ██ ██   ██  ██████  ██   ██",
    "   ██    ██ ██      ████   ██ ██   ██ ██  ████ ██   ██",
    "   ██    ██ █████   ██ ██  ██ ███████ ██ ██ ██ ███████",
    "   ██    ██ ██      ██  ██ ██      ██ ████  ██      ██",
    "   ██    ██ ███████ ██   ████      ██  ██████       ██",
]
BANNER_ASCII = [
    "TTTTT III EEEEE N   N 4  4  000  4  4",
    "  T    I  E     NN  N 4  4 0  00 4  4",
    "  T    I  EEEE  N N N 44444 0 0 0 44444",
    "  T    I  E     N  NN    4 00  0    4",
    "  T   III EEEEE N   N    4  000     4",
]


# ─────────────────────────── bảo vệ token ───────────────────────────
TOKEN_PATTERNS = [
    re.compile(r"gh[pousr]_[A-Za-z0-9]{16,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}"),  # JWT
    re.compile(r"sb[ps]_[A-Za-z0-9_]{16,}"),  # Supabase keys mới
    re.compile(r"(?i)(bearer|token)\s+[A-Za-z0-9._-]{12,}"),
]


def redact(text: str, secrets: list[str] | None = None) -> str:
    """Xoá mọi chuỗi giống token/khoá khỏi text trước khi in."""
    text = str(text)
    for s in secrets or []:
        if s:
            text = text.replace(s, "***")
    for pat in TOKEN_PATTERNS:
        text = pat.sub("***", text)
    return text


def _env_token() -> str:
    return os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or ""


# ─────────────────────────── đo độ rộng ───────────────────────────
def disp_width(s: str) -> int:
    s = ANSI_RE.sub("", s)
    w = 0
    for ch in s:
        if unicodedata.combining(ch):
            continue
        w += 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1
    return w


def fit(s: str, width: int) -> str:
    """Cắt hoặc đệm chuỗi (không chứa ANSI) cho đúng độ rộng hiển thị."""
    s = unicodedata.normalize("NFC", s.replace("\n", " "))
    if disp_width(s) <= width:
        return s + " " * (width - disp_width(s))
    out, w = "", 0
    for ch in s:
        cw = 0 if unicodedata.combining(ch) else (2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1)
        if w + cw > width - 1:
            break
        out += ch
        w += cw
    return out + "…" + " " * (width - w - 1)


# ───────────────────────────── dữ liệu ─────────────────────────────
class GitHubReader:
    """Đọc GitHub REST API (chỉ GET). Token tuỳ chọn, không bao giờ lộ ra ngoài."""

    def __init__(self, repo: str, token: str = "", timeout: float = 10.0, opener=None):
        self.repo = repo
        self._token = token
        self.timeout = timeout
        self._open = opener or urllib.request.urlopen
        self.rate_remaining: str | None = None

    def get(self, path: str):
        req = urllib.request.Request(API + path, method="GET")
        req.add_header("Accept", "application/vnd.github+json")
        req.add_header("User-Agent", USER_AGENT)
        if self._token:
            req.add_header("Authorization", "Bearer " + self._token)
        try:
            with self._open(req, timeout=self.timeout) as resp:
                rem = resp.headers.get("X-RateLimit-Remaining") if resp.headers else None
                if rem is not None:
                    self.rate_remaining = rem
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise RuntimeError(redact(f"GitHub HTTP {e.code} tại {path}", [self._token])) from None
        except Exception as e:  # mạng, timeout, JSON…
            raise RuntimeError(redact(f"Lỗi đọc GitHub: {e}", [self._token])) from None

    def snapshot(self, branch: str, pr_limit: int = 8, pr_checks: int = 5) -> dict:
        r = self.repo
        commit = self.get(f"/repos/{r}/commits/{branch}")
        runs = self.get(f"/repos/{r}/commits/{branch}/check-runs?per_page=100")
        prs = self.get(f"/repos/{r}/pulls?state=open&sort=created&direction=desc&per_page={pr_limit}")
        pr_list = []
        for i, pr in enumerate(prs):
            item = {
                "number": pr.get("number"),
                "title": pr.get("title", ""),
                "draft": bool(pr.get("draft")),
                "created_at": pr.get("created_at"),
                "head_sha": (pr.get("head") or {}).get("sha", ""),
                "base": (pr.get("base") or {}).get("ref", ""),
                "checks": None,
            }
            if i < pr_checks and item["head_sha"]:
                try:
                    cr = self.get(f"/repos/{r}/commits/{item['head_sha']}/check-runs?per_page=100")
                    item["checks"] = summarize_checks(cr.get("check_runs", []))
                except RuntimeError:
                    item["checks"] = None
            pr_list.append(item)
        return {
            "repo": r,
            "branch": branch,
            "head": {
                "sha": commit.get("sha", ""),
                "message": next(iter(((commit.get("commit") or {}).get("message") or "").splitlines()), ""),
                "date": ((commit.get("commit") or {}).get("committer") or {}).get("date"),
            },
            "checks": summarize_checks(runs.get("check_runs", [])),
            "check_names": [
                {"name": c.get("name"), "status": c.get("status"), "conclusion": c.get("conclusion")}
                for c in runs.get("check_runs", [])
            ],
            "prs": pr_list,
            "rate_remaining": self.rate_remaining,
        }


def summarize_checks(check_runs: list) -> dict:
    s = {"pass": 0, "fail": 0, "pending": 0, "skip": 0, "total": 0}
    for c in check_runs:
        s["total"] += 1
        if c.get("status") != "completed":
            s["pending"] += 1
        elif c.get("conclusion") in ("success", "neutral"):
            s["pass"] += 1
        elif c.get("conclusion") in ("skipped", "cancelled", "stale"):
            s["skip"] += 1
        else:
            s["fail"] += 1
    return s


def load_json(path: Path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def check_service(svc: dict, opener=None, timeout: float = 5.0) -> dict:
    """Trả về trạng thái 1 dịch vụ. source='sample' dùng dữ liệu mẫu;
    source='http' gửi GET tới health_url (chỉ đọc mã HTTP, không gửi khoá)."""
    out = dict(svc)
    src = svc.get("source", "sample")
    if src == "http" and svc.get("health_url"):
        url = svc["health_url"]
        if not url.startswith("https://"):
            out.update(state="unknown", detail="chỉ chấp nhận https://")
            return out
        req = urllib.request.Request(url, method="GET", headers={"User-Agent": USER_AGENT})
        t0 = time.monotonic()
        try:
            with (opener or urllib.request.urlopen)(req, timeout=timeout) as resp:
                code = getattr(resp, "status", 200)
            ms = int((time.monotonic() - t0) * 1000)
            out.update(state="up" if 200 <= code < 400 else "down", detail=f"HTTP {code} · {ms}ms")
        except urllib.error.HTTPError as e:
            out.update(state="down", detail=f"HTTP {e.code}")
        except Exception as e:
            out.update(state="down", detail=redact(type(e).__name__))
        out["sample"] = False
    else:
        out["sample"] = True
    return out


# ───────────────────────────── vẽ ─────────────────────────────
class Painter:
    def __init__(self, width: int, color: bool = True, ascii_only: bool = False):
        self.w = width
        self.color = color
        self.ascii = ascii_only
        self.lines: list[str] = []
        b = "+-|++++" if ascii_only else "┌─│┐└┘├"
        self.tl, self.h, self.v, self.tr, self.bl, self.br, self.ml = b[0], b[1], b[2], b[3], b[4], b[5], b[6]
        self.mr = "+" if ascii_only else "┤"

    def c(self, code: str, s: str) -> str:
        return f"{code}{s}{RESET}{BG}{GREEN}" if self.color else s

    def raw(self, s: str = ""):
        self.lines.append(s)

    def box_top(self, title: str):
        t = f" {title} "
        rest = self.w - 2 - disp_width(t) - 2
        self.raw(self.c(GREEN, self.tl + self.h * 2) + self.c(BRIGHT + BOLD, t) + self.c(GREEN, self.h * max(rest, 0) + self.tr))

    def row(self, parts):
        """parts: list[(text, color)] — text không chứa ANSI. Tự cắt cho vừa ô."""
        inner = self.w - 4
        buf, used = "", 0
        for text, code in parts:
            room = inner - used
            if room <= 0:
                break
            if disp_width(text) > room:
                text = fit(text, room)
            buf += self.c(code, text)
            used += disp_width(text)
        buf += " " * (inner - used)
        self.raw(self.c(GREEN, self.v + " ") + buf + self.c(GREEN, " " + self.v))

    def sep(self):
        self.raw(self.c(DIM, self.ml + self.h * (self.w - 2) + self.mr))

    def box_bottom(self):
        self.raw(self.c(GREEN, self.bl + self.h * (self.w - 2) + self.br))

    def text(self) -> str:
        body = "\n".join(self.lines)
        return f"{BG}{GREEN}{body}{RESET}" if self.color else body


def _age(iso: str | None, now: _dt.datetime) -> str:
    if not iso:
        return "?"
    try:
        t = _dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return "?"
    sec = max(0, int((now - t).total_seconds()))
    if sec < 3600:
        return f"{sec // 60}ph"
    if sec < 86400:
        return f"{sec // 3600}g"
    return f"{sec // 86400}ng"


def _checks_badge(ch: dict | None, ascii_only: bool):
    if not ch or not ch.get("total"):
        return ("· chưa có CI", DIM)
    ok, bad, wait = ("OK", "X", "..") if ascii_only else ("✔", "✖", "◷")
    if ch["fail"]:
        return (f"{bad} {ch['fail']} lỗi/{ch['total']}", RED)
    if ch["pending"]:
        return (f"{wait} {ch['pending']} đang chạy/{ch['total']}", YELLOW)
    return (f"{ok} {ch['pass']}/{ch['total']} xanh", BRIGHT)


STATE_STYLE = {
    "up": ("● CHẠY", BRIGHT),
    "down": ("● DỪNG", RED),
    "degraded": ("● CHẬP CHỜN", YELLOW),
    "paused": ("● TẠM DỪNG", YELLOW),
    "unknown": ("● CHƯA RÕ", DIM),
}
TASK_STYLE = {
    "blocked": ("CHẶN", RED),
    "waiting": ("CHỜ", YELLOW),
    "doing": ("ĐANG LÀM", CYAN),
    "done": ("XONG", BRIGHT),
}


def render(snapshot: dict | None, tasks: list, services: list, *, now: _dt.datetime,
           width: int = 100, color: bool = True, ascii_only: bool = False,
           mode: str = "LIVE", error: str | None = None) -> str:
    p = Painter(width, color, ascii_only)
    banner = BANNER_ASCII if ascii_only else BANNER
    for ln in banner:
        pad = max(0, (width - disp_width(ln)) // 2)
        p.raw(p.c(BRIGHT + BOLD, " " * pad + ln))
    local = now.astimezone(VN_TZ).strftime("%d/%m/%Y %H:%M:%S")
    sub = f"AI SALES CONTROL · {local} (giờ VN) · chế độ {mode} · CHỈ ĐỌC"
    sub = fit(sub, width).rstrip()
    p.raw(p.c(DIM, " " * max(0, (width - disp_width(sub)) // 2) + sub))
    p.raw("")

    # ── Repo & CI
    repo = (snapshot or {}).get("repo", DEFAULT_REPO)
    p.box_top(f"REPO {repo}")
    if error:
        p.row([("! ", RED), (error, RED)])
    if snapshot:
        head = snapshot.get("head", {})
        msg = head.get("message") or ""
        p.row([(f"{snapshot.get('branch', '?')} ", BRIGHT + BOLD), (f"@ {head.get('sha', '')[:7]} ", CYAN),
               (f"({_age(head.get('date'), now)} trước) ", DIM), (msg, GREEN)])
        badge = _checks_badge(snapshot.get("checks"), ascii_only)
        p.row([("CI nhánh: ", GREEN), badge])
        failing = [c["name"] for c in snapshot.get("check_names", [])
                   if c.get("status") == "completed" and c.get("conclusion") not in ("success", "neutral", "skipped", "cancelled", "stale")]
        if failing:
            p.row([("  lỗi: ", RED), (", ".join(failing), RED)])
        p.sep()
        prs = snapshot.get("prs", [])
        p.row([(f"PR đang mở (mới nhất {len(prs)}):", BRIGHT)])
        for pr in prs:
            tag = "[DRAFT]" if pr.get("draft") else "[READY]"
            badge = _checks_badge(pr.get("checks"), ascii_only) if pr.get("checks") is not None else ("· CI chưa tải", DIM)
            right = f"  {badge[0]}"
            title_w = max(10, width - 4 - 6 - 8 - 6 - disp_width(right))
            p.row([(f"#{pr.get('number'):<5}", CYAN), (f"{tag} ", YELLOW if pr.get("draft") else BRIGHT),
                   (fit(pr.get("title", ""), title_w), GREEN), (f"{_age(pr.get('created_at'), now):>5} ", DIM),
                   (right, badge[1])])
        if snapshot.get("rate_remaining") is not None:
            p.row([(f"GitHub API còn {snapshot['rate_remaining']} lượt/giờ", DIM)])
    elif not error:
        p.row([("Chưa có dữ liệu GitHub.", DIM)])
    p.box_bottom()

    # ── Việc đang chờ
    p.box_top("VIỆC ĐANG CHỜ")
    open_tasks = [t for t in tasks if t.get("status") != "done"]
    if not open_tasks:
        p.row([("Không còn việc nào đang chờ.", BRIGHT)])
    for t in open_tasks:
        label, code = TASK_STYLE.get(t.get("status", "waiting"), ("?", DIM))
        who = t.get("owner", "")
        p.row([(f"{label:<9}", code), (f"{who:<8} ", CYAN), (t.get("title", ""), GREEN)])
    p.box_bottom()

    # ── Dịch vụ
    p.box_top("DỊCH VỤ")
    for s in services:
        label, code = STATE_STYLE.get(s.get("state", "unknown"), STATE_STYLE["unknown"])
        tag = "[MẪU] " if s.get("sample", True) else "[THẬT] "
        p.row([(f"{s.get('name', '?'):<10}", BRIGHT), (f"{label:<14}", code), (tag, DIM if s.get("sample", True) else CYAN),
               (s.get("detail", ""), GREEN)])
    p.box_bottom()
    foot = "CHỈ ĐỌC · không in token/khoá · Ctrl+C thoát · việc chờ: data/tasks.json · dịch vụ: data/services.json"
    p.raw(p.c(DIM, fit(foot, width).rstrip()))
    return p.text()


# ───────────────────────────── chạy ─────────────────────────────
def enable_windows_ansi():
    if os.name != "nt":
        return
    try:
        import ctypes
        k = ctypes.windll.kernel32
        h = k.GetStdHandle(-11)
        mode = ctypes.c_uint32()
        if k.GetConsoleMode(h, ctypes.byref(mode)):
            k.SetConsoleMode(h, mode.value | 0x0004)
    except Exception:
        pass
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def boot_animation(color: bool, ascii_only: bool):
    steps = ["kết nối GitHub (chỉ đọc)", "nạp việc đang chờ", "nạp dịch vụ", "dựng bảng điều khiển"]
    ok = "OK" if ascii_only else "✔"
    for s in steps:
        line = f"> {s} "
        sys.stdout.write((GREEN if color else "") + line)
        sys.stdout.flush()
        for _ in range(3):
            time.sleep(0.08)
            sys.stdout.write(".")
            sys.stdout.flush()
        sys.stdout.write(f" {ok}{RESET if color else ''}\n")
    time.sleep(0.2)


def collect(args, now) -> tuple[dict | None, str | None, str]:
    if args.offline:
        return load_json(DATA / "sample_github.json", None), None, "OFFLINE (dữ liệu mẫu)"
    reader = GitHubReader(args.repo, token=_env_token())
    try:
        return reader.snapshot(args.branch, pr_limit=args.prs, pr_checks=args.pr_checks), None, "LIVE"
    except RuntimeError as e:
        snap = load_json(DATA / "sample_github.json", None)
        return snap, f"{e} → đang hiện dữ liệu mẫu", "OFFLINE (lỗi mạng)"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="TIEN404 terminal dashboard (chỉ đọc)")
    ap.add_argument("--repo", default=DEFAULT_REPO)
    ap.add_argument("--branch", default=DEFAULT_BRANCH)
    ap.add_argument("--prs", type=int, default=8, help="số PR mở hiển thị")
    ap.add_argument("--pr-checks", type=int, default=5, help="số PR được tải trạng thái CI")
    ap.add_argument("--watch", type=int, default=0, metavar="GIÂY", help="tự làm mới sau N giây (>=30)")
    ap.add_argument("--offline", action="store_true", help="chỉ dùng dữ liệu mẫu, không gọi mạng")
    ap.add_argument("--no-color", action="store_true")
    ap.add_argument("--ascii", action="store_true", help="chỉ dùng ký tự ASCII (terminal cũ)")
    ap.add_argument("--no-anim", action="store_true")
    ap.add_argument("--width", type=int, default=0)
    args = ap.parse_args(argv)

    enable_windows_ansi()
    color = not args.no_color and os.environ.get("NO_COLOR") is None
    if not args.no_anim and sys.stdout.isatty():
        boot_animation(color, args.ascii)

    tasks = load_json(DATA / "tasks.json", [])
    while True:
        now = _dt.datetime.now(_dt.timezone.utc)
        services = [check_service(s) for s in load_json(DATA / "services.json", [])]
        snap, err, mode = collect(args, now)
        width = args.width or max(72, min(120, shutil.get_terminal_size((100, 40)).columns))
        out = render(snap, tasks, services, now=now, width=width, color=color,
                     ascii_only=args.ascii, mode=mode, error=err)
        if args.watch and sys.stdout.isatty():
            sys.stdout.write(CLEAR)
        print(redact(out, [_env_token()]))
        if not args.watch:
            return 0
        try:
            time.sleep(max(30, args.watch))
            tasks = load_json(DATA / "tasks.json", [])
        except KeyboardInterrupt:
            print(RESET if color else "")
            return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print(RESET)
        sys.exit(0)
