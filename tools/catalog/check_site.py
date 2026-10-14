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
KNOWN_MISSING = ()
# English UI wording that must not appear on a French page (French at the root, English under en/)
ENGLISH_ON_FR = ('Request a quote', 'Add to quote list', 'Price on request', 'Your quote list', 'All rights reserved',
                 'Quick quote builder', 'Technical data', 'Compatible fittings', 'Browse the', 'View the list', '>Home<',
                 '>Products<', ' references<', 'Butt-weld', 'Wall thickness', 'Outside diameter', 'Steel grade')


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
        redirect = rel.startswith('go/')   # forwarding pages to the social networks (noindex)
        if rel not in ('404.html',) and not redirect and not p.desc:
            errors.append('%s: no meta description' % rel)
        if p.h1 != 1 and not rel.endswith('products/product.html') and not redirect:
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
        if 'http-equiv="Content-Security-Policy"' not in src:
            errors.append('%s: no Content-Security-Policy' % rel)
        if re.search(r'<script>|\son[a-z]+="', src):
            errors.append('%s: inline script or event handler (blocked by the Content-Security-Policy)' % rel)
        if re.search(r'target="_blank"(?![^>]*noopener)', src):
            errors.append('%s: new-tab link without rel="noopener"' % rel)
        if re.search(r'€\s?\d|priceFrom|Indicative (sub)?total', src):
            errors.append('%s: price shown' % rel)
        lang = 'en' if rel.startswith('en/') else 'fr'
        m = re.search(r'<html lang="([a-z]+)"', src)
        if not m or m.group(1) != lang:
            errors.append('%s: <html lang> should be "%s"' % (rel, lang))
        if lang == 'fr':
            text_only = re.sub(r'<script[\s\S]*?</script>', '', src)
            for w in ENGLISH_ON_FR:
                if w in text_only:
                    errors.append('%s: English text on a French page: %r' % (rel, w))
        if rel != '404.html' and not redirect:
            other = rel[3:] if lang == 'en' else 'en/' + rel
            if not os.path.exists(os.path.join(ROOT, other)):
                errors.append('%s: no %s counterpart %s' % (rel, 'French' if lang == 'en' else 'English', other))
            elif 'hreflang="%s"' % ('fr' if lang == 'en' else 'en') not in src:
                errors.append('%s: no hreflang link to %s' % (rel, other))
        if re.match(r'^(en/)?products/[^/]+/[^/]+\.html$', rel):
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
    refs = glob.glob(os.path.join(ROOT, 'products', '*', '*.html')) + glob.glob(os.path.join(ROOT, 'en', 'products', '*', '*.html'))
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
