from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote
import sys

ROOT=Path(__file__).resolve().parent
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.title=False; self.description=False; self.viewport=False; self.lang=False; self.headings=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='html' and a.get('lang')=='vi': self.lang=True
        if tag=='title':self.title=True
        if tag=='h1':self.headings.append(tag)
        if tag=='meta' and a.get('name')=='description':self.description=True
        if tag=='meta' and a.get('name')=='viewport':self.viewport=True
        if tag in ('a','link','script','img'):
            x=a.get('href') or a.get('src')
            if x:self.links.append(x)

import re
issues=[];pages=list(ROOT.glob('*.html'));total_links=0;stubs=0
for f in pages:
    html=f.read_text(encoding='utf-8')
    # V23: retired demo pages are tiny noindex redirect stubs; only their target must exist.
    m=re.search(r'http-equiv="refresh" content="0; url=([^"]+)"',html)
    if m:
        stubs+=1
        if 'noindex' not in html: issues.append(f'{f.name}: redirect stub must be noindex')
        if not (ROOT/unquote(urlparse(m.group(1)).path)).exists(): issues.append(f'{f.name}: redirect target missing {m.group(1)}')
        continue
    parser=Page();parser.feed(html)
    for check,name in ((parser.title,'title'),(parser.lang,'lang=vi'),(parser.description,'meta description'),(parser.viewport,'viewport'),(len(parser.headings)==1,'exactly one h1')):
        if not check: issues.append(f'{f.name}: missing {name}')
    for href in parser.links:
        p=urlparse(href)
        if p.scheme or href.startswith(('#','//','mailto:','tel:')):continue
        path=unquote(p.path)
        target=(f.parent/path).resolve()
        try:target.relative_to(ROOT.resolve())
        except ValueError:issues.append(f'{f.name}: escaped site root: {href}');continue
        if not target.exists():issues.append(f'{f.name}: missing link {href}')
        total_links+=1
print(f'Checked {len(pages)-stubs} pages, {stubs} redirect stubs and {total_links} local links/resources: {len(issues)} errors')
for error in issues:print('ERROR',error)
sys.exit(bool(issues))