"""Static v4 contracts; uses only Python stdlib so it can run in GitHub Actions."""
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
if (ROOT/'site').is_dir():ROOT=ROOT/'site'

class ConversionFrontendTests(unittest.TestCase):
    def test_v4_pages(self):
        for p in ('onboarding.html','lab.html','impact.html','dashboard.html'):
            data=(ROOT/p).read_text('utf-8')
            self.assertIn('assets/v4.js',data)
            self.assertIn('assets/site-config.js',data)

    def test_links_in_home(self):
        home=(ROOT/'index.html').read_text('utf-8')
        for target in ('onboarding.html','lab.html','impact.html'):
            self.assertIn(target,home)

    def test_sandbox_client_contract(self):
        data=(ROOT/'assets/v4.js').read_text('utf-8')
        self.assertIn('/api/ai/capabilities',data)
        self.assertIn('/api/ai/chat',data)
        self.assertIn('Mô phỏng cục bộ', (ROOT/'lab.html').read_text('utf-8'))
        self.assertNotIn('ngoctien20.app.n8n.cloud',data)
        self.assertNotIn('OPENAI_API_KEY',data)

    def test_real_form_fails_closed(self):
        data=(ROOT/'assets/app.js').read_text('utf-8')
        self.assertIn('leadBackendAvailable',data)
        self.assertIn('apiBase',data)
        self.assertIn('KHÔNG được gửi',data)

if __name__=='__main__':unittest.main()