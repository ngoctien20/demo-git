"""V23 public site contract: generated pages are in sync, no demo surfaces, real lead form + chat wiring."""
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = sorted(p.name for p in (ROOT / 'site-src' / 'pages').glob('*.html'))


class V23SiteContract(unittest.TestCase):
    def test_generated_pages_match_sources(self):
        subprocess.run(['node', 'scripts/build-site.mjs'], cwd=ROOT, check=True, capture_output=True)
        diff = subprocess.run(['git', 'status', '--porcelain', '--', '*.html', 'sitemap.xml'], cwd=ROOT, capture_output=True, text=True).stdout
        self.assertEqual(diff.strip(), '', 'run node scripts/build-site.mjs and commit the output')

    def test_every_page_is_complete_and_has_no_demo_wording(self):
        for name in PAGES:
            html = (ROOT / name).read_text(encoding='utf-8')
            self.assertEqual(len(re.findall(r'<h1\b', html)), 1, name)
            self.assertIn('assets/site.css', html, name)
            self.assertIn('lang="vi"', html, name)
            for banned in ('DEMO / SANDBOX', 'Email demo', 'Thoát phiên demo', 'Phiếu xác nhận demo', 'assets/saas.js', 'assets/v4.js'):
                self.assertNotIn(banned, html, f'{name}: {banned}')

    def test_no_secret_material_in_public_config(self):
        conf = (ROOT / 'assets' / 'site-config.js').read_text(encoding='utf-8')
        self.assertIn('sb_publishable_', conf)
        self.assertNotRegex(conf, r'sb_secret_|eyJhbGci')
        app_conf = (ROOT / 'apps' / 'owner' / 'src' / 'config.ts').read_text(encoding='utf-8')
        self.assertNotRegex(app_conf, r'sb_secret_|eyJhbGci')

    def test_contact_form_posts_to_submit_lead_with_consent_and_honeypot(self):
        html = (ROOT / 'contact.html').read_text(encoding='utf-8')
        js = (ROOT / 'assets' / 'site.js').read_text(encoding='utf-8')
        self.assertIn('id="lead-form"', html)
        self.assertIn('name="consent" required', html)
        self.assertIn('name="website" tabindex="-1"', html)
        self.assertIn('/rest/v1/rpc/submit_lead', js)
        self.assertIn("credentials: 'omit'", js)
        self.assertRegex(js, r"0\[35789\]\\d\{8\}")

    def test_signup_and_login_go_to_owner_app(self):
        for name in PAGES:
            html = (ROOT / name).read_text(encoding='utf-8')
            self.assertIn('href="app/#/dang-ky"', html, name)
            self.assertIn('href="app/#/dang-nhap"', html, name)
        self.assertTrue((ROOT / 'app' / 'index.html').exists(), 'build the owner App: npm --prefix apps/owner run build')

    def test_pricing_does_not_invent_prices(self):
        html = (ROOT / 'pricing.html').read_text(encoding='utf-8')
        self.assertNotRegex(html, r'\d{2,3}[.,]000\s*(đ|VND)')


if __name__ == '__main__':
    unittest.main()
