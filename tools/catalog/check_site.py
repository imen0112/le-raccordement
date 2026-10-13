#!/usr/bin/env python3
"""Static checks on the generated site: internal links, titles, canonicals,
JSON-LD, sitemap, absence of prices.   python3 tools/catalog/check_site.py"""
import glob
import json
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = 'https://leraccordement.com'
KNOWN_MISSING = ('fr/',)   # French mirror not built yet (pre-existing language toggle)


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.title, self.canonical, self.desc, self.jsonld, self.h1 = [], None, None, None, [], 0
        self._in_title = self._in_ld = False
        self.robots = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('a', 'link') and a.get('href'):
            if not (tag == 'link' and a.get('rel') in ('preconnect',)):
                self.links.append(a['href'])
        if tag in ('img', 'script') and a.get('src'):
            self.links.append(a['src'])
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical = a.get('href')
        if tag == 'meta' and a.get('name') == 'description':
            self.desc = a.get('content')
        if tag == 'meta' and a.get('name') == 'robots':
            self.robots = a.get('content')
        if tag == 'title':
            self._in_title = True
        if tag == 'script' and a.get('type') == 'application/ld+json':
            self._in_ld = True
            self.jsonld.append('')
        if tag == 'h1':
            self.h1 += 1

    def handle_endtag(self, tag):
        if tag == 'title':
            self._in_title = False
        if tag == 'script':
            self._in_ld = False

    def handle_data(self, d):
        if self._in_title:
            self.title = (self.title or '') + d
        if self._in_ld:
            self.jsonld[-1] += d


def main():
    errors, warnings = [], []
    pages = [p for p in glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True)
             if '/tests/' not in p and '/server/' not in p and '/.git/' not in p]
    titles = {}
    for path in pages:
        rel = os.path.relpath(path, ROOT)
        url = SITE + '/' + rel.replace('index.html', '')
        src = open(path, encoding='utf-8').read()
        p = Page()
        p.feed(src)
        for href in p.links:
            u = urlparse(href)
            if u.scheme in ('http', 'https', 'mailto', 'tel', 'data') or href.startswith('#') or '${' in href:
                continue
            target = urljoin('file:///' + rel, u.path)[len('file:///'):]
            if not target or target.endswith('/'):
                target += 'index.html'
            if not os.path.exists(os.path.join(ROOT, target)):
                (warnings if target.startswith(KNOWN_MISSING) else errors).append('%s → broken link %s' % (rel, href))
        if not p.title:
            errors.append('%s: no <title>' % rel)
        titles.setdefault((p.title or '').strip(), []).append(rel)
        if rel not in ('404.html',) and not p.desc:
            errors.append('%s: no meta description' % rel)
        if p.h1 != 1 and rel != 'products/product.html':
            warnings.append('%s: %d <h1>' % (rel, p.h1))
        for block in p.jsonld:
            if not block.strip():
                continue
            try:
                data = json.loads(block)
            except ValueError as err:
                errors.append('%s: invalid JSON-LD (%s)' % (rel, err))
                continue
            text = json.dumps(data)
            if '"offers"' in text or '"price"' in text:
                errors.append('%s: JSON-LD declares a price/offer' % rel)
        if re.search(r'€\s?\d|priceFrom|Indicative (sub)?total', src):
            errors.append('%s: price shown' % rel)
        if rel.startswith('products/') and rel.count('/') == 2:
            if p.canonical != url:
                errors.append('%s: canonical %s ≠ %s' % (rel, p.canonical, url))
    for t, rels in titles.items():
        if len(rels) > 1:
            errors.append('duplicate <title> "%s": %s' % (t, ', '.join(rels[:4])))

    sm = open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8').read()
    locs = re.findall(r'<loc>([^<]+)</loc>', sm)
    for loc in locs:
        path = urlparse(loc).path.lstrip('/') or 'index.html'
        if path.endswith('/'):
            path += 'index.html'
        if not os.path.exists(os.path.join(ROOT, path)):
            errors.append('sitemap → missing %s' % loc)
    refs = glob.glob(os.path.join(ROOT, 'products', '*', '*.html'))
    in_sm = sum(1 for l in locs if re.search(r'/products/[a-z]+/[^/]+\.html$', l))
    if in_sm != len(refs):
        errors.append('sitemap lists %d reference pages, %d exist' % (in_sm, len(refs)))

    print('Pages checked: %d · sitemap URLs: %d · reference pages: %d' % (len(pages), len(locs), len(refs)))
    for w in sorted(set(warnings)):
        print('WARN ', w)
    for e in errors:
        print('ERROR', e)
    print('%d error(s), %d warning(s)' % (len(errors), len(set(warnings))))
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
