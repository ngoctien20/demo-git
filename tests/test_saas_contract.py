from pathlib import Path
import re
import unittest
from bs4 import BeautifulSoup
BASE=Path(__file__).resolve().parents[1]
ROOT=BASE/'site' if (BASE/'site').is_dir() else BASE
class SaaSContract(unittest.TestCase):
 def test_six_pages_and_semantics(self):
  for page in ['register','login','checkout','dashboard','billing','invoice']:
   s=BeautifulSoup((ROOT/(page+'.html')).read_text(encoding='utf-8'),'html.parser')
   self.assertEqual(s.body.get('data-saas-page'),page)
   self.assertIsNotNone(s.select_one('main'))
   self.assertIsNotNone(s.select_one('script[src="assets/saas.js"]'))
   self.assertTrue(any(t in s.main.get_text(' ',strip=True).lower() for t in ['mô phỏng','minh họa','demo']))
 def test_no_real_payment_or_password_fields(self):
  for p in ['login','register','checkout']:
   s=BeautifulSoup((ROOT/(p+'.html')).read_text(encoding='utf-8'),'html.parser')
   self.assertFalse(s.select('input[type="password"],input[autocomplete="cc-number"],input[name="card"]'))
 def test_checkout_expects_demo_confirmation(self):
  s=BeautifulSoup((ROOT/'checkout.html').read_text(encoding='utf-8'),'html.parser')
  self.assertEqual(len(s.select('input[name="plan"]')),3)
  self.assertIsNotNone(s.select_one('#checkout-form'))
  self.assertIsNotNone(s.select_one('input[name="terms"]'))
 def test_assets_and_copy(self):
  j=(ROOT/'assets/saas.js').read_text(encoding='utf-8')
  self.assertIn('sessionStorage',j)
  self.assertNotIn('fetch(',j)
  self.assertNotIn('localStorage',j)
  self.assertNotIn('n8n.cloud',j)
  self.assertIn('data-saas-output', (ROOT/'checkout.html').read_text())
  self.assertIn("@use 'saas'",((ROOT/'assets/scss/main.scss') if (ROOT/'assets/scss/main.scss').exists() else (ROOT/'src/scss/main.scss')).read_text())
 def test_nav_on_all_pages(self):
  for page in ROOT.glob('*.html'):
   s=BeautifulSoup(page.read_text(encoding='utf-8'),'html.parser')
   self.assertIsNotNone(s.select_one('#main-menu a[href="login.html"]'),page.name)
if __name__=='__main__':unittest.main()