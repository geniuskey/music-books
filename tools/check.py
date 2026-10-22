#!/usr/bin/env python3
"""Check deployment metadata, local links, fragments and import completeness."""
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
ROOT = Path(__file__).resolve().parent.parent
meta = json.loads((ROOT / 'book.json').read_text())
assert (ROOT / 'CNAME').read_text().strip() == meta['domain']
origin = 'https://' + meta['domain']
class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(); self.ids=set(); self.links=[]; self.canonical=[]; self.feed(text)
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.add(a['id'])
        if tag in ('a','link','script','img'):
            url=a.get('href') if tag in ('a','link') else a.get('src')
            if url: self.links.append(url)
        if tag=='link' and a.get('rel')=='canonical': self.canonical.append(a.get('href'))
paths = [ROOT/'index.html']
# Books with `meta` in book.json get canonical, Open Graph and KaTeX from tools/build.mjs instead of the source.
generated = {Path(e).parent.as_posix() for e in meta['books'] if 'meta' in json.loads((ROOT/e).read_text())}
for entry in meta['books']:
    book=json.loads((ROOT/entry).read_text()); slug=Path(entry).parent.as_posix()
    assert book['url']==f'{origin}/{slug}/'
    paths.extend((ROOT/slug).rglob('*.html'))
pages = {p.resolve():Page(p.read_text()) for p in paths}
errors=[]
for path,page in pages.items():
    rel=path.relative_to(ROOT).as_posix(); expected=origin+'/'+re.sub(r'(^|/)index\.html$',r'\1',rel)
    if rel.split('/')[0] in generated:
        text = path.read_text()
        stale = re.search(r'<link\b[^>]*rel=["\']canonical["\']|<meta\b[^>]*property=["\']og:|cdn\.jsdelivr\.net/npm/katex@', text)
        if stale: errors.append(f'{rel}: "{stale[0]}" is added by the build — remove it from the source')
        # The build renders math in static HTML only; math a script inserts would show as raw TeX.
        for script in re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', text, re.S):
            if re.search(r'\\\\[(\[]|\$\$', script): errors.append(f'{rel}: a script writes math (\\( \\[ $$) — the build only renders math in static HTML')
    elif page.canonical != [expected]: errors.append(f'{rel}: canonical {page.canonical}')
    for link in page.links:
        url=urlsplit(link)
        if url.scheme or url.netloc: continue
        target=(ROOT/unquote(url.path.lstrip('/')) if url.path.startswith('/') else path.parent/unquote(url.path)).resolve() if url.path else path
        if target.is_dir(): target=target/'index.html'
        if not target.exists(): errors.append(f'{rel}: missing {link}'); continue
        # Book engines create some chapter anchors dynamically. Check home deep links strictly.
        if path==ROOT/'index.html' and url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
            errors.append(f'{rel}: missing fragment {link}')
state=json.loads((ROOT/'migration/import-state.json').read_text())
for slug,book in state['books'].items():
    for file in book['files']:
        if not (ROOT/slug/file).exists(): errors.append(f'missing imported file {slug}/{file}')
assert not errors, '\n'.join(errors)
print(f'Checked {len(pages)} pages, local assets, home deep links, metadata and imported files')
