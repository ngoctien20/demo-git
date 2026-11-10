#!/usr/bin/env python3
"""TIEN404 Control Hub v2 read-only public endpoint and GitHub Actions probe.

Deliberately emits ONLY public URL status, Github Actions metadata, and UNKNOWN for
integrations needing authenticated server-side access. Never reads or exposes
n8n/GitHub access tokens in output or logs.
"""
import datetime as dt
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / 'artifacts'
HUB_URL = 'https://tien404-control-hub.fairflounder1.chatgpt.site/'
WEBSITE_URL = 'https://ngoctien20.github.io/demo-git/'
GITHUB_ACTIONS = 'https://api.github.com/repos/ngoctien20/demo-git/actions/runs?branch=gh-pages&per_page=30'
ALLOWED_HOSTS = {'tien404-control-hub.fairflounder1.chatgpt.site', 'ngoctien20.github.io', 'api.github.com'}


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')


def classify_http(code, final_url, location=''):
    path = urllib.parse.urlsplit(final_url).path.lower()
    redirect_path = urllib.parse.urlsplit(location).path.lower()
    if code in (401, 403) or any(word in path+' '+redirect_path for word in ('login','sign-in','signin','oauth','authorize')):
        return 'AUTH_REQUIRED'
    if code is not None and 200 <= code <= 299:
        return 'REACHABLE'
    if code is not None and 300 <= code <= 399:
        return 'REDIRECT_UNVERIFIED'
    if code is None:
        return 'CONNECTION_ERROR'
    return 'HTTP_ERROR'


def request(url, authorization=None, timeout=12):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname not in ALLOWED_HOSTS:
        raise ValueError('Only predefined HTTPS hosts may be probed')
    headers = {'User-Agent': 'TIEN404-readonly-health-check/1.0', 'Accept': 'application/json'}
    if authorization:
        headers['Authorization'] = f'Bearer {authorization}'
    req = urllib.request.Request(url, method='GET', headers=headers)
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    opener = urllib.request.build_opener(NoRedirect)
    start = time.monotonic()
    redirect_to = ''
    try:
        with opener.open(req, timeout=timeout) as response:
            status = response.status
            final_url = response.geturl()
            body = response.read(1_500_000) if parsed.hostname == 'api.github.com' else b''
    except urllib.error.HTTPError as e:
        status = e.code
        final_url = e.geturl()
        body = b''
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return {'status': 'CONNECTION_ERROR', 'http_status': None, 'url': url, 'final_url': None, 'latency_ms': int((time.monotonic() - start) * 1000), 'error_type': type(e).__name__, 'checked_at': utc_now()}, b''
    return {'status': classify_http(status, final_url, redirect_to), 'http_status': status, 'url': url, 'final_url': final_url, 'latency_ms': int((time.monotonic() - start) * 1000), 'checked_at': utc_now()}, body


def latest_action_runs(payload):
    grouped = {}
    allow = {'TIEN404 independent full-browser QA': 'browser_qa', 'TIEN404 AI · Static QA and Sass build': 'static_qa', 'pages build and deployment': 'pages_deploy'}
    for run in payload.get('workflow_runs', []):
        key = allow.get(run.get('name'))
        if key and key not in grouped and run.get('head_branch') == 'gh-pages':
            grouped[key] = {k: run.get(k) for k in ('name', 'status', 'conclusion', 'head_sha', 'created_at', 'updated_at', 'html_url')}
    for label in allow.values():
        if label not in grouped:
            grouped[label] = {'status': 'UNKNOWN', 'reason': 'No matching gh-pages workflow run returned'}
    return grouped


def collect():
    hub, _ = request(HUB_URL)
    website, _ = request(WEBSITE_URL)
    gh_probe, gh_data = request(GITHUB_ACTIONS, authorization=os.environ.get('GITHUB_TOKEN'))
    actions = {'connection': gh_probe['status'], 'checked_at': gh_probe['checked_at'], 'source_url': GITHUB_ACTIONS, 'runs': {}}
    if gh_probe['status'] == 'REACHABLE':
        try:
            actions['runs'] = latest_action_runs(json.loads(gh_data))
        except (ValueError, TypeError) as e:
            actions['connection'] = 'PARSE_ERROR'
            actions['error_type'] = type(e).__name__
    return {
        'schema_version': 1,
        'generated_at': utc_now(),
        'mode': 'READ_ONLY_NO_CREDENTIAL_EXPORT',
        'release_readiness': 'NOT_VERIFIED',
        'sources': {
            'control_hub': {'provider': 'Public HTTPS endpoint', **hub},
            'website': {'provider': 'GitHub Pages public HTTPS endpoint', **website},
            'github_actions': actions,
            'n8n': {'provider': 'n8n authenticated API', 'status': 'UNKNOWN', 'checked_at': None, 'reason': 'No authenticated backend/proxy connected to this GitHub runner. No synthetic counts.'},
            'backup_registry': {'provider': 'Private backup index', 'status': 'UNKNOWN', 'checked_at': None, 'reason': 'No private backup registry connected. Do not publish backups.'},
            'control_hub_auth': {'provider': 'Authenticated functional review', 'status': 'NOT_TESTED', 'checked_at': None, 'reason': 'Requires authorized Sites access, user session, source code, and browser QA.'}
        },
        'security': {'secrets_in_report': False, 'mutations_performed': False, 'n8n_data_requested': False},
    }


def markdown(data):
    s = data['sources']
    out = ['# TIEN404 Control Hub — read-only health snapshot', '', f"Checked at (UTC): **{data['generated_at']}**", '', '| System | Status | HTTP | Source |', '|---|---|---|---|']
    for k, title in [('control_hub', 'Control Hub public URL'), ('website', 'TIEN404 AI website')]:
        a = s[k]
        out.append(f"| {title} | {a['status']} | {a.get('http_status') or 'Unknown'} | {a['url']} |")
    for k, title in [('n8n','n8n authenticated metrics'), ('backup_registry','Backup registry'), ('control_hub_auth','Authenticated hub review')]:
        a=s[k]
        out.append(f"| {title} | {a['status']} | — | Not connected |")
    out += ['', '## GitHub Actions from gh-pages', '', '| Suite | Status | Result | Commit | Run URL |', '|---|---|---|---|---|']
    for key, run in s['github_actions']['runs'].items():
        out.append(f"| {key} | {run.get('status','UNKNOWN')} | {run.get('conclusion') or 'Unknown'} | {run.get('head_sha') or 'Unknown'} | {run.get('html_url') or '—'} |")
    out += ['', '**Interpretation:** REACHABLE means only an HTTP response was observed. AUTH_REQUIRED means login/authorization is required, not that UI operations were tested. UNKNOWN/NOT_TESTED must not be converted to green status. No AI, n8n, order or payment credentials are queried.', '', '**Release readiness: NOT VERIFIED.**']
    return '\n'.join(out)+'\n'


def main():
    data = collect()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR/'health.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (OUTPUT_DIR/'health.md').write_text(markdown(data), encoding='utf-8')
    print('TIEN404 Control Hub probe:')
    print('  Control Hub:', data['sources']['control_hub']['status'], data['sources']['control_hub']['http_status'])
    print('  TIEN404 AI:', data['sources']['website']['status'], data['sources']['website']['http_status'])
    print('  GitHub Actions:', data['sources']['github_actions']['connection'])
    print('  n8n: UNKNOWN (requires authenticated backend)')
    print('  Release readiness: NOT VERIFIED')

if __name__ == '__main__':
    main()