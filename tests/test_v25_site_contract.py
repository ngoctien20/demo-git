"""V25 public site contract: multi-industry positioning, honest status labels, motion is optional."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = sorted(p.name for p in (ROOT / 'site-src' / 'pages').glob('*.html'))


def read(name):
    return (ROOT / name).read_text(encoding='utf-8')


class V25SiteContract(unittest.TestCase):
    def test_home_positions_a_multi_industry_platform(self):
        html = read('index.html')
        self.assertIn('Một trợ lý AI.', html)
        self.assertIn('Mọi kênh kết nối.', html)
        for industry in ('Cửa hàng / Thương mại', 'Nghệ sĩ / Nhà sáng tạo', 'Dịch vụ', 'Giáo dục'):
            self.assertIn(industry, html)
        self.assertNotIn('cho shop nhỏ', html.split('<main')[1].split('</main>')[0].lower())

    def test_navigation_has_industries_and_channels(self):
        for name in PAGES:
            html = read(name)
            self.assertIn('href="industries.html"', html, name)
            self.assertIn('href="channels.html"', html, name)

    def test_no_fake_live_status(self):
        for name in PAGES:
            html = read(name)
            for banned in ('Đã tích hợp', 'Sẵn sàng', 'Đang chạy với shop thử nghiệm', 'Kết nối có hỗ trợ'):
                self.assertFalse(banned in html, f'{name}: {banned}')

    def test_channels_page_lists_each_channel_with_limits(self):
        html = read('channels.html')
        for ch in ('Facebook Messenger', 'Zalo', 'Website Chat', 'Telegram', 'Instagram'):
            self.assertIn(f'<h2>{ch}</h2>', html)
        self.assertGreaterEqual(html.count('<dt>Cấp quyền</dt>'), 4)
        self.assertGreaterEqual(html.count('<dt>Chưa có</dt>'), 3)

    def test_booking_is_not_claimed_automatic(self):
        html = read('industries.html')
        self.assertIn('Đặt lịch tự động chưa hoạt động', html)

    def test_pricing_does_not_invent_prices(self):
        self.assertNotRegex(read('pricing.html'), r'\d{2,3}[.,]000\s*(đ|VND)')

    def test_motion_respects_reduced_motion_and_never_hides_without_js(self):
        css = read('assets/site.css')
        js = read('assets/site.js')
        self.assertRegex(css, r'prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{[^}]*animation:none!important')
        self.assertIn("matchMedia('(prefers-reduced-motion: reduce)')", js)
        # motion-pending is only ever added by JS, so pages without JS show everything.
        self.assertNotIn('motion-pending', ''.join(read(p) for p in PAGES))

    def test_old_solution_pages_redirect_to_industries(self):
        self.assertIn('url=industries.html', read('solutions.html'))
        self.assertIn('url=industries.html#cua-hang', read('industry-fashion.html'))


if __name__ == '__main__':
    unittest.main()
