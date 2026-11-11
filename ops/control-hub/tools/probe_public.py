#!/usr/bin/env python3
"""Read-only TIEN404 health evidence for a staged Control Hub integration.

The probe cannot authenticate into the hosted Control Hub or inspect private n8n;
those sources remain UNKNOWN until a separately reviewed server-side adapter exists.
No tokens, workflow payloads, credentials, personal data or cookies enter artifacts.
"""
from __future__ import annotations

import datetime as dt
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / 'artifacts'
HUB_URL = 'https://tien404-control-hub.fairflounder1.chatgpt.site/'
WEBSITE_URL = 'https://ngoctien20.github.io/demo-git/'
GITHUB_ACTIONS = 'https://api.github.com/repos/ngoctien20/demo-git/actions/runs?branch=gh-pages&per_page=50'
GITHUB_HEAD = 'https://api.github.com/repos/ngoctien20/demo-git/git/ref/heads/gh-pages'
ALLOWED_HOSTS = {'tien404-control-hub.fairflounder1.chatgpt.site', 'ngoctien20.github.io', 'api.github.com'}
GITHUB_AUTH_PATH_PREFIX = '/repos/ngoctien20/demo-git/'
RUN_TYPES = {
    'TIEN404 independent full-browser QA': 'browser_qa',
    'TIEN404 AI · Static QA and Sass build': 'static_qa',
    'pages build and deployment': 'pages_deploy',
}
FRESHNESS_MAX_HOURS = 48


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')


def classify_http(code, final_url, location='', headers=None):
    path = urllib.parse.urlsplit(final_url or '').path.lower()
    redirect_path = urllib.parse.urlsplit(location or '').path.lower()
    if code is None:
        return 'CONNECTION_ERROR'
    headers = headers or {}
    github_quota = (
        urllib.parse.urlsplit(final_url or '').hostname == 'api.github.com'
        and (headers.get('X-RateLimit-Remaining') == '0' or headers.get('Retry-After') is not None)
    )
    if code == 429 or (code == 403 and github_quota):
        return 'RATE_LIMITED'
    if code >= 500:
        return 'SERVICE_ERROR'
    if code in (401, 403):
        return 'AUTH_REQUIRED'
    if 200 <= code < 400 and any(
        word in path + ' ' + redirect_path for word in ('login', 'sign-in', 'signin', 'oauth', 'authorize')
    ):
        return 'AUTH_REQUIRED'
    if 200 <= code <= 299:
        return 'REACHABLE'
    if 300 <= code <= 399:
        return 'REDIRECT_UNVERIFIED'
    return 'HTTP_ERROR'


def request(url, authorization=None, timeout=12):
    """GET an exact allowlisted HTTPS origin. Never forward a token to Sites/Pages.

    Redirects are deliberately disabled so credentials cannot cross origins. The
    Location header is interpreted for authentication, not followed or exported.
    """
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname not in ALLOWED_HOSTS or parsed.port not in (None, 443) or parsed.username or parsed.password:
        raise ValueError('Only predefined HTTPS origins without userinfo or custom ports may be probed')
    if authorization and (parsed.hostname != 'api.github.com' or not parsed.path.startswith(GITHUB_AUTH_PATH_PREFIX)):
        raise ValueError('GitHub token may only be sent to the allowlisted repository API')
    headers = {'User-Agent': 'TIEN404-readonly-health-check/2.0', 'Accept': 'application/json'}
    if authorization:
        headers['Authorization'] = f'Bearer {authorization}'
    req = urllib.request.Request(url, method='GET', headers=headers)

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    start = time.monotonic()
    location = ''
    try:
        with opener.open(req, timeout=timeout) as response:
            status = response.status
            final_url = response.geturl()
            response_headers = response.headers
            location = response_headers.get('Location', '')
            body = response.read(1_500_000) if parsed.hostname == 'api.github.com' else b''
    except urllib.error.HTTPError as e:
        status = e.code
        final_url = e.geturl()
        response_headers = e.headers or {}
        location = response_headers.get('Location', '')
        body = b''
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return {
            'status': 'CONNECTION_ERROR', 'http_status': None, 'url': url,
            'final_url': None, 'latency_ms': int((time.monotonic() - start)*1000),
            'error_type': type(e).__name__, 'checked_at': utc_now(),
        }, b''
    return {
        'status': classify_http(status, final_url, location, response_headers), 'http_status': status,
        'url': url, 'final_url': final_url,
        'latency_ms': int((time.monotonic() - start)*1000),
        'checked_at': utc_now(),
    }, body


def parse_datetime(value):
    try:
        parsed = dt.datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return parsed.astimezone(dt.timezone.utc) if parsed.tzinfo else None
    except (ValueError, TypeError, OverflowError):
        return None


def freshness(updated_at, now=None):
    """Never pass stale or missing run metadata off as a live measurement."""
    when = parse_datetime(updated_at)
    if when is None:
        return 'UNKNOWN'
    now = now or dt.datetime.now(dt.timezone.utc)
    age = (now - when).total_seconds()
    if age < -300:
        return 'INVALID_FUTURE_TIMESTAMP'
    return 'STALE' if age > FRESHNESS_MAX_HOURS*3600 else 'FRESH'


def latest_action_runs(payload, now=None):
    """Sort by creation time; GitHub API order is not a health guarantee."""
    runs = payload.get('workflow_runs')
    if not isinstance(runs, list):
        raise ValueError('Missing workflow_runs list')
    valid = [r for r in runs if isinstance(r, dict) and r.get('head_branch') == 'gh-pages']
    valid.sort(key=lambda r: parse_datetime(r.get('created_at')) or dt.datetime.min.replace(tzinfo=dt.timezone.utc), reverse=True)
    grouped = {}
    for run in valid:
        key = RUN_TYPES.get(run.get('name'))
        if key and key not in grouped:
            grouped[key] = {k: run.get(k) for k in ('name','status','conclusion','head_sha','created_at','updated_at','html_url')}
            grouped[key]['freshness'] = freshness(run.get('updated_at'), now=now)
    for label in RUN_TYPES.values():
        if label not in grouped:
            grouped[label] = {'status': 'UNKNOWN', 'freshness': 'UNKNOWN', 'reason': 'No matching gh-pages workflow run in API response'}
    return grouped


def last_successful_deploy(payload):
    runs = payload.get('workflow_runs')
    if not isinstance(runs, list):
        raise ValueError('Missing workflow_runs list')
    successful = [r for r in runs if isinstance(r, dict) and r.get('name') == 'pages build and deployment'
                  and r.get('head_branch') == 'gh-pages' and r.get('status') == 'completed' and r.get('conclusion') == 'success']
    successful.sort(key=lambda r: parse_datetime(r.get('updated_at')) or dt.datetime.min.replace(tzinfo=dt.timezone.utc), reverse=True)
    if not successful:
        return {'status': 'UNKNOWN', 'reason': 'No successful deployment returned'}
    r=successful[0]
    return {'status': 'VERIFIED_BY_GITHUB_ACTIONS', 'commit_sha': r.get('head_sha'), 'finished_at': r.get('updated_at'),
            'run_url': r.get('html_url'), 'freshness': freshness(r.get('updated_at'))}


def release_alignment(latest_success, branch_sha):
    """Compare commit identity, not color/status. This is not a UI readiness gate."""
    deploy_sha = latest_success.get('commit_sha') if isinstance(latest_success, dict) else None
    if not deploy_sha or not branch_sha:
        return 'UNKNOWN'
    return 'SAME_COMMIT' if deploy_sha == branch_sha else 'DEPLOY_BEHIND_BRANCH'


def collect():
    hub, _ = request(HUB_URL)
    website, _ = request(WEBSITE_URL)
    token = os.environ.get('GITHUB_TOKEN')
    gh_probe, gh_data = request(GITHUB_ACTIONS, authorization=token)
    head_probe, head_data = request(GITHUB_HEAD, authorization=token)
    actions = {
        'connection': gh_probe['status'], 'checked_at': gh_probe['checked_at'],
        'source_url': GITHUB_ACTIONS, 'runs': {}, 'last_successful_deploy': {'status': 'UNKNOWN'},
        'gh_pages_head': None, 'release_alignment': 'UNKNOWN',
    }
    if gh_probe['status'] == 'REACHABLE':
        try:
            payload = json.loads(gh_data)
            actions['runs'] = latest_action_runs(payload)
            actions['last_successful_deploy'] = last_successful_deploy(payload)
        except (ValueError, TypeError, AttributeError) as e:
            actions['connection'] = 'PARSE_ERROR'
            actions['error_type'] = type(e).__name__
    if head_probe['status'] == 'REACHABLE':
        try:
            ref = json.loads(head_data)
            raw_sha = ref.get('object', {}).get('sha')
            if isinstance(raw_sha, str) and len(raw_sha) == 40 and all(c in '0123456789abcdefABCDEF' for c in raw_sha):
                actions['gh_pages_head'] = raw_sha
        except (ValueError, TypeError, AttributeError):
            pass
    actions['release_alignment'] = release_alignment(actions['last_successful_deploy'], actions['gh_pages_head'])
    return {
        'schema_version': 2, 'generated_at': utc_now(),
        'mode': 'READ_ONLY_NO_CREDENTIAL_EXPORT', 'release_readiness': 'NOT_VERIFIED',
        'sources': {
            'control_hub': {'provider': 'Anonymous public HTTPS endpoint', **hub},
            'website': {'provider': 'GitHub Pages public HTTPS endpoint', **website},
            'github_actions': actions,
            'n8n': {'provider': 'n8n authenticated API', 'status': 'UNKNOWN', 'checked_at': None,
                    'reason': 'Authenticated API not connected to this runner. Never invent counts.'},
            'backup_registry': {'provider': 'Private backup index', 'status': 'UNKNOWN', 'checked_at': None,
                                'reason': 'Private backup registry not connected. Do not publish backups.'},
            'control_hub_auth': {'provider': 'Authenticated browser review', 'status': 'NOT_TESTED', 'checked_at': None,
                                 'reason': 'Needs authorized Sites access, role sessions, code and browser QA.'},
        },
        'security': {'secrets_in_report': False, 'mutations_performed': False, 'n8n_data_requested': False},
    }


def markdown(data):
    sources=data['sources']
    lines=['# TIEN404 Control Hub — read-only health snapshot','',f"Checked at (UTC): **{data['generated_at']}**",'',
           '| System | Status | HTTP | Checked at | Source |','|---|---|---|---|---|']
    for key,title in [('control_hub','Control Hub anonymous URL'),('website','TIEN404 AI Website')]:
        v=sources[key]
        lines.append(f"| {title} | {v['status']} | {v.get('http_status') or 'Unknown'} | {v.get('checked_at') or 'Unknown'} | {v['url']} |")
    for key,title in [('n8n','n8n private metrics'),('backup_registry','Backup registry'),('control_hub_auth','Authorized UI inspection')]:
        lines.append(f"| {title} | {sources[key]['status']} | — | Unknown | Not connected |")
    a=sources['github_actions']
    lines += ['', '## Public GitHub release evidence', '', f"Actions connection: **{a['connection']}**",'',
              '| Suite | Run status | Conclusion | Freshness | Commit | Link |', '|---|---|---|---|---|---|']
    for key,run in a['runs'].items():
        lines.append(f"| {key} | {run.get('status','UNKNOWN')} | {run.get('conclusion') or 'Unknown'} | {run.get('freshness','UNKNOWN')} | {run.get('head_sha') or 'Unknown'} | {run.get('html_url') or '—'} |")
    d=a['last_successful_deploy']
    lines += ['',f"- Last successful Pages deploy: **{d.get('commit_sha') or 'Unknown'}** at {d.get('finished_at') or 'Unknown'}",
              f"- Latest gh-pages Git ref: **{a.get('gh_pages_head') or 'Unknown'}**",
              f"- Deploy/ref alignment: **{a['release_alignment']}**",
              '', '**These are public-URL and CI observations, NOT authenticated Control Hub feature tests.** A 401 can be intentional protection. UNKNOWN/STALE must never render as green. GitHub Actions success cannot verify orders, payments, login, D1 or n8n.',
              '', '**Release readiness: NOT VERIFIED.**']
    return '\n'.join(lines)+'\n'


def main():
    data=collect()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR/'health.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
    (OUTPUT_DIR/'health.md').write_text(markdown(data),encoding='utf-8')
    print('TIEN404 Control Hub v2 probe:')
    print('  Control Hub:', data['sources']['control_hub']['status'], data['sources']['control_hub']['http_status'])
    print('  TIEN404 AI:', data['sources']['website']['status'], data['sources']['website']['http_status'])
    print('  GitHub Actions:', data['sources']['github_actions']['connection'])
    print('  Deploy alignment:', data['sources']['github_actions']['release_alignment'])
    print('  n8n: UNKNOWN (requires authenticated backend)')
    print('  Release readiness: NOT VERIFIED')

if __name__=='__main__':
    main()