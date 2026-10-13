"""Tests for the quote API, with a fake Resend endpoint.   Run: python3 -m unittest -v test_app"""
import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SENT = []          # emails received by the fake provider
FAIL = {'on': False}


class FakeResend(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if FAIL['on']:
            self.send_response(500); self.end_headers(); self.wfile.write(b'{"message":"boom"}'); return
        SENT.append({'body': body, 'auth': self.headers.get('Authorization'), 'idem': self.headers.get('Idempotency-Key')})
        out = json.dumps({'id': 'email_%d' % len(SENT)}).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(out))); self.end_headers()
        self.wfile.write(out)


fake = ThreadingHTTPServer(('127.0.0.1', 0), FakeResend)
threading.Thread(target=fake.serve_forever, daemon=True).start()
DATA_DIR = tempfile.mkdtemp()
os.environ.update({
    'RESEND_API_KEY': 're_test_key', 'MAIL_FROM': 'Le Raccordement <devis@leraccordement.com>',
    'ALLOWED_ORIGINS': 'https://leraccordement.com', 'RESEND_API_URL': 'http://127.0.0.1:%d/emails' % fake.server_address[1],
    'DATA_DIR': DATA_DIR, 'RATE_MAX': '50', 'TRUST_PROXY': '1'})
import app  # noqa: E402  (reads the environment at import)

api = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
threading.Thread(target=api.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d' % api.server_address[1]
_n = [0]


def payload(**over):
    _n[0] += 1
    p = {'requestKey': 'test-key-%05d' % _n[0], 'elapsedMs': 12000, 'website': '',
         'customer': {'name': 'Amira Ben Salah', 'company': 'Hydro Sud SARL', 'email': 'amira@hydrosud.tn',
                      'phone': '+216 74 123 456', 'country': 'Tunisia', 'incoterm': 'EXW · Ex Works', 'message': 'Delivery in March.\nCert 3.1 please.'},
         'items': [
             {'kind': 'ref', 'code': 'C3S21N', 'designation': 'Coude à souder 90° 3D – 21,3x2 – S235 – EN/1 – Noir', 'qty': 120,
              'family': 'elbows', 'dims': '21,3×2', 'norme': 'EN/1', 'nuance': 'S235', 'type': 'Sans soudure', 'finition': 'Noir',
              'url': 'https://leraccordement.com/products/elbows/c3s21n.html'},
             {'kind': 'ref', 'code': 'R2W219114G', 'designation': 'RC à souder Forme 2 – 219,1/6,3x168,3/4,5', 'qty': 8,
              'family': 'reducers', 'dims': '219,1×6,3 / 114,3×3,6', 'norme': 'EN/1', 'nuance': 'S235', 'type': 'Soudé', 'finition': 'Galv.', 'url': ''}],
         'page': 'https://leraccordement.com/cart.html'}
    for k, v in over.items():
        if k in p['customer']:
            p['customer'][k] = v
        else:
            p[k] = v
    return p


def post(data, origin='https://leraccordement.com', ip='10.0.0.1', raw=None):
    body = raw if raw is not None else json.dumps(data).encode()
    req = urllib.request.Request(URL + '/api/quote', data=body, method='POST',
                                 headers={'Content-Type': 'application/json', 'Origin': origin, 'X-Forwarded-For': ip})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read()), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}'), dict(e.headers)


class QuoteApiTest(unittest.TestCase):
    def setUp(self):
        SENT.clear(); FAIL['on'] = False

    def test_valid_request_emails_commande(self):
        status, data, headers = post(payload())
        self.assertEqual(status, 200, data)
        self.assertTrue(data['ok']); self.assertRegex(data['id'], r'^DV-\d{8}-[A-Z2-9]{5}$')
        self.assertEqual(headers.get('Access-Control-Allow-Origin'), 'https://leraccordement.com')
        self.assertEqual(len(SENT), 1)
        mail = SENT[0]['body']
        self.assertEqual(mail['to'], ['commande@leraccordement.com'])
        self.assertEqual(mail['reply_to'], 'amira@hydrosud.tn')
        self.assertEqual(mail['subject'], 'Nouvelle demande de devis %s · Site Le Raccordement' % data['id'])
        self.assertEqual(SENT[0]['auth'], 'Bearer re_test_key')
        for s in ('C3S21N', 'R2W219114G', '>120<', '>8<', 'Hydro Sud SARL', '+216 74 123 456', 'Coude à souder 90° 3D',
                  'EN/1', 'Galv.', 'via le site Internet', 'Total pièces', '>128<'):
            self.assertIn(s, mail['html'], s)
        self.assertIn('Qté : 120', mail['text'])
        self.assertIn('Origine : https://leraccordement.com/cart.html', mail['text'])
        with open(os.path.join(DATA_DIR, 'quotes.jsonl'), encoding='utf-8') as fh:
            log = fh.read()
        self.assertIn(data['id'], log)

    def test_double_submit_sends_once(self):
        p = payload()
        s1, d1, _ = post(p)
        s2, d2, _ = post(p)
        self.assertEqual((s1, s2), (200, 200))
        self.assertEqual(d1['id'], d2['id'])
        self.assertTrue(d2.get('duplicate'))
        self.assertEqual(len(SENT), 1)
        self.assertEqual(SENT[0]['idem'], 'quote-' + p['requestKey'])

    def test_provider_failure_is_not_reported_as_success(self):
        FAIL['on'] = True
        p = payload()
        status, data, _ = post(p)
        self.assertEqual(status, 502); self.assertFalse(data['ok']); self.assertNotIn('id', data)
        FAIL['on'] = False   # retry with the same key goes through
        status, data, _ = post(p)
        self.assertEqual(status, 200); self.assertEqual(len(SENT), 1)

    def test_validation(self):
        cases = [
            (payload(email='not-an-email'), 'email'),
            (payload(phone='abc'), 'phone'),
            (payload(name=''), 'Full name'),
            (payload(company=''), 'Company'),
            (payload(items=[]), 'empty'),
            (payload(items=[{'kind': 'ref', 'code': 'C3S21N', 'designation': 'x', 'qty': 0}]), 'quantity'),
            (payload(items=[{'kind': 'ref', 'code': 'C3S21N', 'designation': 'x', 'qty': '5'}]), 'quantity'),
            (payload(items=[{'kind': 'ref', 'code': '<script>', 'designation': 'x', 'qty': 1}]), 'reference'),
            (payload(requestKey='x'), 'Invalid request'),
        ]
        for p, hint in cases:
            status, data, _ = post(p)
            self.assertEqual(status, 400, (hint, data))
            self.assertIn(hint.lower(), data['error'].lower())
        self.assertEqual(len(SENT), 0)

    def test_header_injection_rejected(self):
        for field in ('email', 'name', 'company'):
            status, data, _ = post(payload(**{field: 'amira@hydrosud.tn\r\nBcc: victim@example.com'}))
            self.assertEqual(status, 400, field)
        self.assertEqual(len(SENT), 0)

    def test_html_is_escaped(self):
        status, data, _ = post(payload(message='<script>alert(1)</script>', company='ACME <b>'))
        self.assertEqual(status, 200)
        html = SENT[0]['body']['html']
        self.assertNotIn('<script>alert', html); self.assertIn('&lt;script&gt;', html); self.assertIn('ACME &lt;b&gt;', html)

    def test_spam_traps(self):
        self.assertEqual(post(payload(website='http://spam'))[0], 400)
        self.assertEqual(post(payload(elapsedMs=500))[0], 400)
        self.assertEqual(len(SENT), 0)

    def test_origin_and_format(self):
        self.assertEqual(post(payload(), origin='https://evil.example')[0], 403)
        self.assertEqual(post(None, raw=b'{not json')[0], 400)
        self.assertEqual(post(None, raw=b'x' * (70 * 1024))[0], 413)
        self.assertEqual(len(SENT), 0)

    def test_rate_limit(self):
        old = app.CFG['rate_max']; app.CFG['rate_max'] = 2
        try:
            codes = [post(payload(), ip='10.9.9.9')[0] for _ in range(3)]
            self.assertEqual(codes, [200, 200, 429])
        finally:
            app.CFG['rate_max'] = old

    def test_health_and_cors_preflight(self):
        with urllib.request.urlopen(URL + '/health') as r:
            self.assertEqual(json.loads(r.read()), {'ok': True, 'configured': True})
        req = urllib.request.Request(URL + '/api/quote', method='OPTIONS', headers={'Origin': 'https://leraccordement.com'})
        with urllib.request.urlopen(req) as r:
            self.assertEqual(r.status, 204)
            self.assertEqual(r.headers['Access-Control-Allow-Origin'], 'https://leraccordement.com')

    def test_not_configured_returns_503(self):
        old = app.CFG['api_key']; app.CFG['api_key'] = ''
        try:
            status, data, _ = post(payload())
            self.assertEqual(status, 503); self.assertFalse(data['ok'])
        finally:
            app.CFG['api_key'] = old


if __name__ == '__main__':
    unittest.main()
