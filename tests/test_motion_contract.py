"""Source contract checks; no network or running server required."""
import unittest
from pathlib import Path
from html.parser import HTMLParser

ROOT=Path(__file__).resolve().parent.parent
SITE=ROOT/'site' if (ROOT/'site').exists() else ROOT

class HtmlAttrs(HTMLParser):
    def __init__(self):
        super().__init__();self.tabs=[];self.ids=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if a.get('role')=='tab':self.tabs.append(a)

class MotionContract(unittest.TestCase):
    def test_four_accessible_studio_steps(self):
        home=(SITE/'index.html').read_text(encoding='utf-8')
        parsed=HtmlAttrs();parsed.feed(home)
        self.assertEqual(len(parsed.tabs),4)
        self.assertEqual(len(parsed.ids),len(set(parsed.ids)))
        self.assertIn('lab-stage',parsed.ids)
        for i,tab in enumerate(parsed.tabs):
            self.assertEqual(tab['aria-controls'],'lab-stage')
            self.assertEqual(tab['id'],f'lab-tab-{i}')
            self.assertEqual(tab['data-lab-step'],str(i))
    def test_reduced_motion_support(self):
        style=(SITE/'assets/style.css').read_text(encoding='utf-8')
        script=(SITE/'assets/app.js').read_text(encoding='utf-8')
        self.assertTrue('prefers-reduced-motion: reduce' in style or 'prefers-reduced-motion:reduce' in style)
        self.assertIn("matchMedia('(prefers-reduced-motion: reduce)')",script)
        self.assertIn('data-reveal',script)
    def test_motion_source_and_bundle(self):
        sass_path=(SITE/'assets/scss/main.scss') if (SITE/'assets/scss/main.scss').exists() else (ROOT/'src/scss/main.scss')
        sass=sass_path.read_text(encoding='utf-8')
        css=(SITE/'assets/style.css').read_text(encoding='utf-8')
        self.assertIn("@use 'motion';",sass)
        self.assertIn('TIEN404 AI 2.0 | cinematic interaction system',css)
    def test_client_side_demo_does_not_call_real_n8n(self):
        js=(SITE/'assets/app.js').read_text(encoding='utf-8')
        self.assertNotIn('ngoctien20.app.n8n.cloud',js)
        self.assertIn('sandbox', (SITE/'index.html').read_text(encoding='utf-8').lower())

if __name__=='__main__':unittest.main()