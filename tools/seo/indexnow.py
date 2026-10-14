#!/usr/bin/env python3
"""Tell search engines which pages changed (IndexNow: Bing, Yandex, Seznam, Naver, Yep; free).

    python3 tools/seo/indexnow.py <old-commit> <new-commit>    # pages changed between two commits
    python3 tools/seo/indexnow.py --all                         # every URL of sitemap.xml

Run by the deploy workflow after each publication. Does nothing until the key file is reachable
on the live domain (https://leraccordement.com/<key>.txt), so it is safe before the domain switch.
Google does not use IndexNow; it reads sitemap.xml.
"""
import glob
import json
import os
import re
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = 'https://leraccordement.com'
HOST = 'leraccordement.com'


def key():
    files = [os.path.basename(f) for f in glob.glob(os.path.join(ROOT, '*.txt')) if re.fullmatch(r'[0-9a-f]{32}\.txt', os.path.basename(f))]
    if len(files) != 1:
        sys.exit('IndexNow: expected exactly one <32 hex>.txt key file at the site root')
    return files[0][:-4]


def page_url(rel):
    rel = rel.replace('\\', '/')
    if not rel.endswith('.html') or rel.startswith(('tests/', 'tools/', 'server/', 'go/')) or rel == '404.html':
        return None
    return SITE + '/' + (rel[:-len('index.html')] if rel.endswith('index.html') else rel)


def changed(old, new):
    out = subprocess.run(['git', 'diff', '--name-only', '--diff-filter=AM', old, new], cwd=ROOT,
                         capture_output=True, text=True, check=True).stdout.split()
    return sorted({u for u in map(page_url, out) if u})


def from_sitemap():
    sm = open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8').read()
    return sorted({u for u in re.findall(r'<loc>([^<]+)</loc>', sm) if '?' not in u})


def main():
    k = key()
    if len(sys.argv) == 2 and sys.argv[1] == '--all':
        urls = from_sitemap()
    elif len(sys.argv) == 3 and not re.fullmatch(r'0+', sys.argv[1]):
        urls = changed(sys.argv[1], sys.argv[2])
    else:
        urls = from_sitemap()          # first push or unknown previous commit
    if not urls:
        print('IndexNow: no page changed')
        return
    try:
        with urllib.request.urlopen('%s/%s.txt' % (SITE, k), timeout=15) as r:
            live = r.status == 200 and r.read().decode().strip() == k
    except Exception:
        live = False
    if not live:
        print('IndexNow: key not reachable on %s yet (domain not live?), skipped %d URL(s)' % (SITE, len(urls)))
        return
    for i in range(0, len(urls), 10000):          # protocol limit per request
        batch = urls[i:i + 10000]
        body = json.dumps({'host': HOST, 'key': k, 'keyLocation': '%s/%s.txt' % (SITE, k), 'urlList': batch}).encode()
        req = urllib.request.Request('https://api.indexnow.org/indexnow', data=body, method='POST',
                                     headers={'Content-Type': 'application/json; charset=utf-8'})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                print('IndexNow: %d URL(s) submitted, HTTP %d' % (len(batch), r.status))
        except urllib.error.HTTPError as err:
            print('IndexNow: HTTP %d %s' % (err.code, err.read()[:200]))


if __name__ == '__main__':
    main()
