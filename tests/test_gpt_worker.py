"""Offline safety tests for tools/gpt_worker.py (no Codex call, no network)."""
from __future__ import annotations

import importlib.util
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('gpt_worker', ROOT / 'tools' / 'gpt_worker.py')
gw = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gw)

LEAK = 'sentinel-value-that-must-not-leak'
LEAKY_ENV = ('OPENAI_API_KEY', 'CODEX_API_KEY', 'TEST_SERVICE_TOKEN', 'GITHUB_TOKEN',
             'CLAUDE_CODE_MESSAGING_TOKEN', 'DB_PASSWORD')


class _Project(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name) / 'proj'
        self.root.mkdir()
        self.home = Path(self._tmp.name) / 'home'
        self.home.mkdir()

    def tearDown(self):
        self._tmp.cleanup()

    def write(self, rel: str, text: str = 'x = 1\n') -> Path:
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding='utf-8')
        return p

    def assertBlocked(self, rel: str, fragment: str):
        with self.assertRaises(gw.SafetyError) as ctx:
            gw.select_files(self.root, [rel])
        self.assertIn(fragment, str(ctx.exception))


class SelectFilesTest(_Project):
    def test_allows_plain_source_file(self):
        self.write('src/app.js')
        chosen = gw.select_files(self.root, ['src/app.js'])
        self.assertEqual([p.as_posix() for p, _ in chosen], ['src/app.js'])

    def test_blocks_absolute_and_traversal(self):
        self.write('a.py')
        self.assertBlocked(str((self.root / 'a.py').resolve()), 'Absolute/traversal')
        self.assertBlocked('../proj/a.py', 'Absolute/traversal')

    @unittest.skipUnless(os.name == 'nt', 'Windows drive semantics')
    def test_blocks_drive_relative_and_rooted_paths(self):
        self.write('a.py')
        self.assertBlocked('C:a.py', 'Absolute/traversal')
        self.assertBlocked('\\a.py', 'Absolute/traversal')

    @unittest.skipUnless(os.name == 'nt', 'NTFS junctions')
    def test_blocks_junction_escape(self):
        import _winapi
        outside = Path(self._tmp.name) / 'outside'
        outside.mkdir()
        (outside / 'leak.py').write_text('S = 1\n', encoding='utf-8')
        _winapi.CreateJunction(str(outside), str(self.root / 'jn'))
        self.assertBlocked('jn/leak.py', 'escapes project')

    def test_blocks_secret_content_in_innocent_filename(self):
        fake = 'FAKE' + '_SENTINEL_VALUE'
        samples = {
            'credential assignment': f'PASSWORD = "{fake}"\n',
            'private key block': '-----BEGIN ' + 'RSA PRIVATE KEY-----\n',
            'JWT': 'jwt = ' + 'eyJ' + 'a' * 12 + '.eyJ' + 'b' * 12 + '.sig\n',
            'sk- API key': 'k = ' + 'sk' + '-' + 'A' * 24 + '\n',
            'GitHub token': 't = ' + 'gh' + 'p_' + 'A' * 36 + '\n',
            'AWS access key': 'a = ' + 'AK' + 'IA' + 'A' * 16 + '\n',
        }
        for label, body in samples.items():
            with self.subTest(label=label):
                self.write('src/settings.py', 'ok = 1\n' + body)
                with self.assertRaises(gw.SafetyError) as ctx:
                    gw.select_files(self.root, ['src/settings.py'])
                msg = str(ctx.exception)
                self.assertIn(f'({label}) at src/settings.py:2', msg)
                self.assertNotIn(fake, msg)

    def test_ordinary_code_is_not_flagged(self):
        self.write('src/auth.js', 'const password = input.value;\nif (!token) return;\n'
                                  'const key = "short";\n')
        self.assertEqual(len(gw.select_files(self.root, ['src/auth.js'])), 1)

    def test_blocks_sensitive_dirs_and_names(self):
        for rel in ('.git/config.txt', 'secrets/a.json', 'node_modules/x.js',
                    'src/api_token.js', 'db_password.txt', 'SERVICE_ROLE.md'):
            with self.subTest(rel=rel):
                self.write(rel)
                self.assertBlocked(rel, 'Sensitive-looking')

    def test_blocks_dotenv_variants_with_allowed_suffix(self):
        for rel in ('.env.local.json', 'config/.env.production.yml', '.ENV.txt'):
            with self.subTest(rel=rel):
                self.write(rel)
                self.assertBlocked(rel, 'Sensitive-looking')

    def test_blocks_non_allowlisted_extensions(self):
        for rel in ('key.pem', 'run.sh', 'Makefile', 'app.exe'):
            with self.subTest(rel=rel):
                self.write(rel)
                self.assertBlocked(rel, 'extension not allowlisted')

    def test_blocks_missing_file_and_directory(self):
        with self.assertRaises(OSError):
            gw.select_files(self.root, ['nope.py'])
        (self.root / 'dir.md').mkdir()
        self.assertBlocked('dir.md', 'Not a regular file')

    def test_enforces_count_and_size_limits(self):
        self.assertBlocked_list([f'f{i}.py' for i in range(gw.MAX_FILES + 1)], 'Only up to')
        self.write('big.txt', 'a' * (gw.MAX_FILE_BYTES + 1))
        self.assertBlocked('big.txt', 'Too large')
        names = []
        for i in range(4):  # 4 x 23 KiB > 80 KiB total
            names.append(f'm{i}.txt')
            self.write(names[-1], 'b' * (23 * 1024))
        self.assertBlocked_list(names, 'Combined input exceeds')

    def assertBlocked_list(self, rels, fragment):
        with self.assertRaises(gw.SafetyError) as ctx:
            gw.select_files(self.root, rels)
        self.assertIn(fragment, str(ctx.exception))

    def test_blocks_symlink_escape(self):
        outside = Path(self._tmp.name) / 'outside.py'
        outside.write_text('SECRET = 1\n', encoding='utf-8')
        link = self.root / 'link.py'
        try:
            link.symlink_to(outside)
        except (OSError, NotImplementedError):
            self.skipTest('symlinks not permitted on this host')
        self.assertBlocked('link.py', 'Symlink blocked')


class RunWorkerTest(_Project):
    def _run(self, completed=None, side_effect=None, files=('src/app.js',)):
        calls = {}

        def fake_run(args, **kwargs):
            calls['args'], calls['kwargs'] = args, kwargs
            if side_effect:
                raise side_effect
            return completed

        with mock.patch.object(gw.shutil, 'which', return_value='/usr/bin/codex'), \
             mock.patch.object(gw.subprocess, 'run', side_effect=fake_run) as run, \
             mock.patch.object(gw.Path, 'home', return_value=self.home), \
             mock.patch.dict(os.environ, {name: LEAK for name in LEAKY_ENV} | {'TIEN404_KEEP_ME': 'ok'}):
            code, msg = gw.run_worker(self.root, 'Review this', list(files))
        run.assert_called_once()  # exactly one worker call, never an automatic retry
        return code, msg, calls

    def test_dry_run_never_calls_codex(self):
        self.write('src/app.js')
        with mock.patch.object(gw.subprocess, 'run') as run:
            code, msg = gw.run_worker(self.root, 'Review', ['src/app.js'], dry_run=True)
        run.assert_not_called()
        self.assertEqual(code, 0)
        self.assertIn('DRY RUN', msg)

    def test_read_only_sandbox_no_api_keys_and_embedded_content(self):
        self.write('src/app.js', 'const answer = 42;\n')
        ok = subprocess.CompletedProcess([], 0, stdout='## STATUS\nok', stderr='')
        code, msg, calls = self._run(completed=ok)
        self.assertEqual(code, 0)
        args = calls['args']
        self.assertEqual(args[args.index('--sandbox') + 1], 'read-only')
        for forbidden in ('danger-full-access', 'workspace-write',
                          '--dangerously-bypass-approvals-and-sandbox', '--full-auto'):
            self.assertNotIn(forbidden, args)
        env = calls['kwargs']['env']
        for name in LEAKY_ENV:
            self.assertNotIn(name, env)
        self.assertEqual(env.get('TIEN404_KEEP_ME'), 'ok')
        self.assertNotIn(LEAK, calls['kwargs']['input'])
        prompt = calls['kwargs']['input']
        self.assertIn('BEGIN FILE: src/app.js', prompt)
        self.assertIn('   1| const answer = 42;', prompt)
        self.assertNotEqual(Path(calls['kwargs']['cwd']).resolve(), self.root.resolve())
        reports = list((self.home / '.tien404-ai' / 'gpt-worker-reports').glob('*.md'))
        self.assertEqual(len(reports), 1)
        self.assertIn('not independently verified', msg)

    def test_failures_are_blocked_without_retry(self):
        self.write('src/app.js')
        cases = [
            (dict(completed=subprocess.CompletedProcess([], 1, stdout='', stderr='x')), 1),
            (dict(completed=subprocess.CompletedProcess([], 0, stdout='  ', stderr='')), 2),
            (dict(side_effect=subprocess.TimeoutExpired('codex', 240)), 124),
        ]
        for kwargs, expected in cases:
            with self.subTest(expected=expected):
                code, msg, _calls = self._run(**kwargs)
                self.assertEqual(code, expected)
                self.assertIn('BLOCKED', msg)

    def test_rejects_empty_or_oversized_task(self):
        self.write('src/app.js')
        for task in ('   ', 'x' * (gw.MAX_TASK_CHARS + 1)):
            with self.subTest(n=len(task)):
                with self.assertRaises(gw.SafetyError):
                    gw.run_worker(self.root, task, ['src/app.js'], dry_run=True)

    def test_missing_codex_is_blocked(self):
        self.write('src/app.js')
        with mock.patch.object(gw.shutil, 'which', return_value=None):
            with self.assertRaises(gw.SafetyError):
                gw.run_worker(self.root, 'Review', ['src/app.js'])


if __name__ == '__main__':
    unittest.main()
