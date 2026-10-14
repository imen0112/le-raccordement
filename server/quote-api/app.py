#!/usr/bin/env python3
"""Quote-request API for leraccordement.com, deploy on Railway (or any host running Python 3.9+).

POST /api/quote   JSON from js/quote.js → validated → emailed to QUOTE_TO via the Resend API
GET  /health      {"ok": true, "configured": bool}

Standard library only. Configuration via environment variables (see README.md):
  RESEND_API_KEY   required  Resend API key (never sent to the browser)
  MAIL_FROM        required  verified sender, e.g. "Le Raccordement <devis@leraccordement.com>"
  QUOTE_TO         default   commande@leraccordement.com
  ALLOWED_ORIGINS  required in production, comma-separated, e.g. https://leraccordement.com,https://www.leraccordement.com
  PORT             set by Railway (default 8080)
  DATA_DIR         optional  directory (Railway volume) where every request is appended to quotes.jsonl
  SEND_CUSTOMER_COPY  optional "1" → also send a short acknowledgement to the customer
  TRUST_PROXY      default "1" → client IP taken from X-Forwarded-For (Railway runs behind a proxy)
  RESEND_API_URL   default https://api.resend.com/emails (overridable for tests)
"""
import datetime
import html
import json
import os
import re
import secrets
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CFG = {
    'api_key': os.environ.get('RESEND_API_KEY', ''),
    'mail_from': os.environ.get('MAIL_FROM', ''),
    'quote_to': os.environ.get('QUOTE_TO', 'commande@leraccordement.com'),
    'origins': [o.strip().rstrip('/') for o in os.environ.get('ALLOWED_ORIGINS', '').split(',') if o.strip()],
    'port': int(os.environ.get('PORT', '8080')),
    'data_dir': os.environ.get('DATA_DIR', ''),
    'customer_copy': os.environ.get('SEND_CUSTOMER_COPY', '') == '1',
    'trust_proxy': os.environ.get('TRUST_PROXY', '1') == '1',
    'resend_url': os.environ.get('RESEND_API_URL', 'https://api.resend.com/emails'),
    'min_fill_ms': int(os.environ.get('MIN_FILL_MS', '3000')),
    'rate_max': int(os.environ.get('RATE_MAX', '5')),
    'rate_window': int(os.environ.get('RATE_WINDOW_S', '600')),
}
MAX_BODY = 64 * 1024
MAX_ITEMS = 200
MIN_QTY = 50   # minimum order per reference (pieces)

EMAIL_RE = re.compile(r"^[^\s@<>()\",;:]+@[^\s@<>()\",;:]+\.[A-Za-z]{2,}$")
PHONE_RE = re.compile(r'^\+?[\d\s().\-/]{6,30}$')
CODE_RE = re.compile(r'^[A-Za-z0-9.\-_]{1,40}$')
KEY_RE = re.compile(r'^[A-Za-z0-9\-]{8,64}$')
CTRL_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')
LINE_BREAK_RE = re.compile(r'[\r\n  ]')

_lock = threading.Lock()
_seen = {}          # requestKey → {'id', 'receivedAt', 'ts', 'state'}
_hits = {}          # ip → [timestamps]


class Invalid(Exception):
    pass


def log(event, **kw):
    kw.update(event=event, at=datetime.datetime.utcnow().isoformat() + 'Z')
    print(json.dumps(kw, ensure_ascii=False), flush=True)


# ---------------------------------------------------------------- validation
def text(d, key, maxlen, required=False, single_line=True, label=None):
    v = d.get(key, '')
    if v is None:
        v = ''
    if not isinstance(v, str):
        raise Invalid('%s: invalid value' % (label or key))
    v = CTRL_RE.sub('', v).strip()
    if single_line and LINE_BREAK_RE.search(v):
        raise Invalid('%s: line breaks are not allowed' % (label or key))
    if required and not v:
        raise Invalid('%s is required' % (label or key))
    if len(v) > maxlen:
        raise Invalid('%s is too long' % (label or key))
    return v


def validate(body):
    if not isinstance(body, dict):
        raise Invalid('Invalid request')
    c = body.get('customer')
    if not isinstance(c, dict):
        raise Invalid('Contact details are missing')
    cust = {
        'name': text(c, 'name', 120, True, label='Full name'),
        'company': text(c, 'company', 160, True, label='Company'),
        'email': text(c, 'email', 200, True, label='Email'),
        'phone': text(c, 'phone', 40, True, label='Phone'),
        'country': text(c, 'country', 80, label='Country'),
        'incoterm': text(c, 'incoterm', 80, label='Incoterm'),
        'message': text(c, 'message', 4000, single_line=False, label='Message'),
    }
    if len(cust['name']) < 2 or len(cust['company']) < 2:
        raise Invalid('Please enter your full name and company')
    if not EMAIL_RE.match(cust['email']):
        raise Invalid('Please enter a valid email address')
    digits = re.sub(r'\D', '', cust['phone'])
    if not PHONE_RE.match(cust['phone']) or not 6 <= len(digits) <= 20:
        raise Invalid('Please enter a valid phone number')

    raw_items = body.get('items')
    if not isinstance(raw_items, list) or not raw_items:
        raise Invalid('Your quote list is empty')
    if len(raw_items) > MAX_ITEMS:
        raise Invalid('Too many lines (max %d)' % MAX_ITEMS)
    items = []
    for it in raw_items:
        if not isinstance(it, dict):
            raise Invalid('Invalid line in quote list')
        qty = it.get('qty')
        if isinstance(qty, bool) or not isinstance(qty, int) or not 1 <= qty <= 999999:
            raise Invalid('Invalid quantity')
        if qty < MIN_QTY:
            raise Invalid('Minimum quantity is %d pieces per reference' % MIN_QTY)
        kind = 'model' if it.get('kind') == 'model' else 'ref'
        line = {'kind': kind, 'qty': qty,
                'code': text(it, 'code', 40, kind == 'ref', label='Reference'),
                'designation': text(it, 'designation', 300, True, label='Designation')}
        if kind == 'ref' and not CODE_RE.match(line['code']):
            raise Invalid('Invalid reference code')
        line['designationFr'] = text(it, 'designationFr', 300)
        for k in ('family', 'dims', 'norme', 'nuance', 'type', 'finition'):
            line[k] = text(it, k, 120)
        url = text(it, 'url', 300)
        line['url'] = url if url.startswith('https://') or url.startswith('http://') else ''
        if kind == 'model':
            opts = it.get('options') or {}
            if not isinstance(opts, dict) or len(opts) > 12:
                raise Invalid('Invalid options')
            line['options'] = {text({'k': k}, 'k', 40): text(opts, k, 80) for k in list(opts)[:12]}
        items.append(line)

    key = body.get('requestKey')
    if not isinstance(key, str) or not KEY_RE.match(key):
        raise Invalid('Invalid request')
    return cust, items, key


# ---------------------------------------------------------------- email
def specs(line):
    if line['kind'] == 'model':
        return ' · '.join('%s : %s' % kv for kv in line.get('options', {}).items()) or 'Configuration à préciser'
    parts = []
    if line['dims']:
        parts.append('Ø ' + line['dims'])
    parts += [line[k] for k in ('norme', 'nuance', 'type', 'finition') if line[k]]
    return ' · '.join(parts)


def desig_html(i):
    """French ERP designation first (what the sales team uses), English as shown to the customer below."""
    e = html.escape
    if i.get('designationFr') and i['designationFr'] != i['designation']:
        return '%s<br><span style="color:#57606a;font-size:12px">%s</span>' % (e(i['designationFr']), e(i['designation']))
    return e(i['designation'])


def build_email(req_id, received, cust, items, page):
    e = html.escape
    when = received.strftime('%d/%m/%Y %H:%M UTC')
    subject = 'Nouvelle demande de devis %s · Site Le Raccordement' % req_id
    total = sum(i['qty'] for i in items)
    th = 'style="text-align:left;padding:8px 10px;border:1px solid #d0d7de;background:#f3f5f8;font-size:12px"'
    td = 'style="padding:8px 10px;border:1px solid #d0d7de;font-size:13px;vertical-align:top"'
    rows = ''.join(
        '<tr><td %s>%d</td><td %s><strong style="font-family:monospace">%s</strong></td><td %s>%s</td><td %s>%s</td>'
        '<td %s align="right"><strong>%d</strong></td></tr>' % (
            td, n, td, (('<a href="%s">%s</a>' % (e(i['url']), e(i['code']))) if i['url'] else e(i['code'] or 'non renseigné')),
            td, desig_html(i), td, e(specs(i)), td, i['qty'])
        for n, i in enumerate(items, 1))
    contact = ''.join('<tr><td style="padding:4px 12px 4px 0;color:#57606a">%s</td><td style="padding:4px 0"><strong>%s</strong></td></tr>' % (e(k), v) for k, v in [
        ('Nom', e(cust['name'])), ('Société', e(cust['company'])),
        ('E-mail', '<a href="mailto:%s">%s</a>' % (e(cust['email']), e(cust['email']))),
        ('Téléphone', e(cust['phone'])), ('Pays', e(cust['country'] or 'non renseigné')), ('Incoterm souhaité', e(cust['incoterm'] or 'non renseigné'))])
    body_html = '''<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2328;max-width:900px">
<p style="font-size:13px;color:#57606a;margin:0 0 12px">Demande de devis reçue via le site Internet de Le Raccordement (leraccordement.com).</p>
<h2 style="margin:0 0 4px;font-size:20px">Demande de devis %(id)s</h2>
<p style="margin:0 0 16px;color:#57606a">Reçue le %(when)s · %(n)d référence(s) · %(total)d pièce(s)</p>
<h3 style="font-size:15px;margin:16px 0 6px">Client</h3>
<table style="border-collapse:collapse;font-size:14px">%(contact)s</table>
<h3 style="font-size:15px;margin:20px 0 6px">Message</h3>
<div style="white-space:pre-wrap;font-size:14px;padding:10px;background:#f6f8fa;border-radius:6px">%(message)s</div>
<h3 style="font-size:15px;margin:20px 0 6px">Produits demandés</h3>
<table style="border-collapse:collapse;width:100%%">
<thead><tr><th %(th)s>#</th><th %(th)s>Référence</th><th %(th)s>Désignation</th><th %(th)s>Caractéristiques</th><th %(th)s>Quantité</th></tr></thead>
<tbody>%(rows)s</tbody>
<tfoot><tr><td colspan="4" %(td)s align="right">Total pièces</td><td %(td)s align="right"><strong>%(total)d</strong></td></tr></tfoot>
</table>
<p style="font-size:12px;color:#57606a;margin-top:20px">Origine : site web de Le Raccordement, %(page)s<br>Répondre à cet e-mail répond directement au client.</p>
</body></html>''' % {'id': e(req_id), 'when': e(when), 'n': len(items), 'total': total, 'contact': contact,
                     'message': e(cust['message']) or 'non renseigné', 'th': th, 'td': td, 'rows': rows, 'page': e(page or 'leraccordement.com')}
    lines = ['%d. %s | %s | %s | Qté : %d' % (n, i['code'] or 'non renseigné', i['designationFr'] or i['designation'], specs(i), i['qty']) for n, i in enumerate(items, 1)]
    body_text = '\n'.join([
        'Demande de devis reçue via le site Internet de Le Raccordement.', '',
        'Demande : %s' % req_id, 'Date : %s' % when, '',
        'Nom : %s' % cust['name'], 'Société : %s' % cust['company'], 'E-mail : %s' % cust['email'],
        'Téléphone : %s' % cust['phone'], 'Pays : %s' % (cust['country'] or 'non renseigné'), 'Incoterm : %s' % (cust['incoterm'] or 'non renseigné'), '',
        'Message :', cust['message'] or 'non renseigné', '',
        'Produits demandés (%d références, %d pièces) :' % (len(items), total)] + lines + ['', 'Origine : %s' % (page or 'leraccordement.com')])
    return subject, body_html, body_text


def send_email(payload, idempotency_key=None):
    req = urllib.request.Request(CFG['resend_url'], data=json.dumps(payload).encode('utf-8'), method='POST', headers={
        'Authorization': 'Bearer ' + CFG['api_key'], 'Content-Type': 'application/json', 'User-Agent': 'leraccordement-quote-api/1.0'})
    if idempotency_key:
        req.add_header('Idempotency-Key', idempotency_key)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read() or b'{}')
            return 200 <= res.status < 300, data.get('id'), None
    except urllib.error.HTTPError as err:
        return False, None, 'HTTP %s %s' % (err.code, err.read()[:300].decode('utf-8', 'replace'))
    except Exception as err:  # network, timeout
        return False, None, repr(err)


def record(entry):
    if not CFG['data_dir']:
        return
    try:
        os.makedirs(CFG['data_dir'], exist_ok=True)
        with _lock, open(os.path.join(CFG['data_dir'], 'quotes.jsonl'), 'a', encoding='utf-8') as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + '\n')
    except OSError as err:
        log('record_failed', error=repr(err))


def new_id(now):
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return 'DV-%s-%s' % (now.strftime('%Y%m%d'), ''.join(secrets.choice(alphabet) for _ in range(5)))



# ---------------------------------------------------------------- French error messages (French site)
FR_FIELDS = {'Full name': 'Nom et prénom', 'Company': 'Société', 'Email': 'E-mail', 'Phone': 'Téléphone', 'Country': 'Pays',
             'Incoterm': 'Incoterm', 'Message': 'Message', 'Reference': 'Référence', 'Designation': 'Désignation'}
FR_EXACT = {
    'Invalid request': 'Demande invalide',
    'Contact details are missing': 'Les coordonnées sont manquantes',
    'Please enter your full name and company': 'Veuillez indiquer vos nom, prénom et société',
    'Please enter a valid email address': 'Veuillez indiquer une adresse e-mail valide',
    'Please enter a valid phone number': 'Veuillez indiquer un numéro de téléphone valide',
    'Your quote list is empty': 'Votre liste de devis est vide',
    'Invalid line in quote list': 'Ligne invalide dans la liste de devis',
    'Invalid quantity': 'Quantité invalide',
    'Invalid reference code': 'Code de référence invalide',
    'Invalid options': 'Options invalides',
    'Quote service is not configured.': 'Le service de devis n’est pas configuré.',
    'Request rejected.': 'Demande refusée.',
    'The form was submitted too quickly. Please wait a few seconds and try again.':
        'Le formulaire a été envoyé trop rapidement. Patientez quelques secondes puis réessayez.',
    'This request is already being sent. Please wait.': 'Cette demande est déjà en cours d’envoi. Veuillez patienter.',
    'Too many requests. Please try again later or email us directly.':
        'Trop de demandes. Réessayez plus tard ou écrivez-nous directement par e-mail.',
    'Your request could not be emailed to our sales team.': 'Votre demande n’a pas pu être transmise par e-mail à notre équipe commerciale.',
}


def to_french(msg):
    if msg in FR_EXACT:
        return FR_EXACT[msg]
    m = re.match(r'^(.*?)( is required| is too long|: line breaks are not allowed|: invalid value)$', msg)
    if m:
        field = FR_FIELDS.get(m.group(1), m.group(1))
        return field + {' is required': ' : champ obligatoire', ' is too long': ' : texte trop long',
                        ': line breaks are not allowed': ' : les retours à la ligne ne sont pas autorisés',
                        ': invalid value': ' : valeur invalide'}[m.group(2)]
    m = re.match(r'^Minimum quantity is (\d+) pieces per reference$', msg)
    if m:
        return 'La quantité minimale est de %s pièces par référence' % m.group(1)
    m = re.match(r'^Too many lines \(max (\d+)\)$', msg)
    if m:
        return 'Trop de lignes (%s au maximum)' % m.group(1)
    return msg

# ---------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    server_version = 'QuoteAPI/1.0'
    sys_version = ''

    def log_message(self, fmt, *args):  # keep stdout for structured logs
        pass

    def origin_allowed(self):
        origin = (self.headers.get('Origin') or '').rstrip('/')
        if not CFG['origins']:
            return True, origin or '*'
        return origin in CFG['origins'], origin

    def send_json(self, status, data, origin=None):
        if status >= 400 and getattr(self, 'lang', 'en') == 'fr' and isinstance(data.get('error'), str):
            data = dict(data, error=to_french(data['error']))
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if origin:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        self.end_headers()
        self.wfile.write(body)

    def client_ip(self):
        if CFG['trust_proxy'] and self.headers.get('X-Forwarded-For'):
            return self.headers['X-Forwarded-For'].split(',')[0].strip()
        return self.client_address[0]

    def do_OPTIONS(self):
        allowed, origin = self.origin_allowed()
        self.send_response(204 if allowed else 403)
        if allowed:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Max-Age', '86400')
            self.send_header('Vary', 'Origin')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        if self.path.split('?')[0] == '/health':
            return self.send_json(200, {'ok': True, 'configured': bool(CFG['api_key'] and CFG['mail_from'] and CFG['quote_to'])})
        self.send_json(404, {'ok': False, 'error': 'Not found'})

    def do_POST(self):
        if self.path.split('?')[0] != '/api/quote':
            return self.send_json(404, {'ok': False, 'error': 'Not found'})
        allowed, origin = self.origin_allowed()
        if not allowed:
            log('rejected_origin', origin=origin)
            return self.send_json(403, {'ok': False, 'error': 'Origin not allowed'})
        if not (CFG['api_key'] and CFG['mail_from']):
            log('not_configured')
            return self.send_json(503, {'ok': False, 'error': 'Quote service is not configured.'}, origin)
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            length = -1
        if length <= 0 or length > MAX_BODY:
            return self.send_json(413 if length > MAX_BODY else 400, {'ok': False, 'error': 'Invalid request size'}, origin)
        if 'application/json' not in (self.headers.get('Content-Type') or ''):
            return self.send_json(415, {'ok': False, 'error': 'JSON expected'}, origin)
        try:
            body = json.loads(self.rfile.read(length).decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            return self.send_json(400, {'ok': False, 'error': 'Invalid JSON'}, origin)
        self.lang = 'fr' if isinstance(body, dict) and body.get('lang') == 'fr' else 'en'

        ip = self.client_ip()
        # Spam traps: hidden field filled, or form submitted faster than a human can
        if isinstance(body, dict) and body.get('website'):
            log('spam_honeypot', ip=ip)
            return self.send_json(400, {'ok': False, 'error': 'Request rejected.'}, origin)
        elapsed = body.get('elapsedMs') if isinstance(body, dict) else None
        if not isinstance(elapsed, (int, float)) or elapsed < CFG['min_fill_ms']:
            log('spam_too_fast', ip=ip, elapsed=elapsed)
            return self.send_json(400, {'ok': False, 'error': 'The form was submitted too quickly. Please wait a few seconds and try again.'}, origin)

        try:
            cust, items, key = validate(body)
        except Invalid as err:
            return self.send_json(400, {'ok': False, 'error': str(err)}, origin)

        now = time.time()
        with _lock:
            for k in [k for k, v in _seen.items() if now - v['ts'] > 86400]:
                del _seen[k]
            prev = _seen.get(key)
            if prev and prev['state'] == 'sent':
                log('duplicate', id=prev['id'])
                return self.send_json(200, {'ok': True, 'id': prev['id'], 'receivedAt': prev['receivedAt'], 'duplicate': True}, origin)
            if prev and prev['state'] == 'pending':
                return self.send_json(409, {'ok': False, 'error': 'This request is already being sent. Please wait.'}, origin)
            hits = [t for t in _hits.get(ip, []) if now - t < CFG['rate_window']]
            if len(hits) >= CFG['rate_max']:
                log('rate_limited', ip=ip)
                return self.send_json(429, {'ok': False, 'error': 'Too many requests. Please try again later or email us directly.'}, origin)
            hits.append(now)
            _hits[ip] = hits
            received = datetime.datetime.utcnow().replace(microsecond=0)
            req_id = new_id(received)
            _seen[key] = {'id': req_id, 'receivedAt': received.isoformat() + 'Z', 'ts': now, 'state': 'pending'}

        page = body.get('page') if isinstance(body.get('page'), str) else ''
        page = page[:300] if page.startswith('http') else ''
        subject, body_html, body_text = build_email(req_id, received, cust, items, page)
        ok, provider_id, err = send_email({
            'from': CFG['mail_from'], 'to': [CFG['quote_to']], 'reply_to': cust['email'],
            'subject': subject, 'html': body_html, 'text': body_text,
            'headers': {'X-Quote-Request-Id': req_id}}, idempotency_key='quote-' + key)

        entry = {'id': req_id, 'receivedAt': received.isoformat() + 'Z', 'ip': ip, 'customer': cust, 'items': items,
                 'page': page, 'emailSent': ok, 'providerId': provider_id, 'error': err}
        record(entry)
        with _lock:
            if ok:
                _seen[key]['state'] = 'sent'
            else:
                del _seen[key]
        if not ok:
            log('email_failed', id=req_id, error=err)
            return self.send_json(502, {'ok': False, 'error': 'Your request could not be emailed to our sales team.'}, origin)
        log('quote_sent', id=req_id, items=len(items), provider_id=provider_id)

        if CFG['customer_copy']:
            ack = ('Bonjour %s,\n\nNous avons bien reçu votre demande de devis %s (%d référence(s)). '
                   'Notre équipe commerciale vous répondra sous un jour ouvré.\n\nLe Raccordement\n%s') % (
                cust['name'], req_id, len(items), CFG['quote_to'])
            ok2, _, err2 = send_email({'from': CFG['mail_from'], 'to': [cust['email']], 'reply_to': CFG['quote_to'],
                                       'subject': 'Votre demande de devis %s · Le Raccordement' % req_id, 'text': ack},
                                      idempotency_key='ack-' + key)
            if not ok2:
                log('customer_copy_failed', id=req_id, error=err2)

        return self.send_json(200, {'ok': True, 'id': req_id, 'receivedAt': received.isoformat() + 'Z'}, origin)


def main():
    if not CFG['origins']:
        log('warning', message='ALLOWED_ORIGINS is empty: any website can post to this API. Set it in production.')
    if not (CFG['api_key'] and CFG['mail_from']):
        log('warning', message='RESEND_API_KEY / MAIL_FROM missing: /api/quote will answer 503.')
    srv = ThreadingHTTPServer(('0.0.0.0', CFG['port']), Handler)
    log('listening', port=CFG['port'], quote_to=CFG['quote_to'])
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.server_close()
        sys.exit(0)


if __name__ == '__main__':
    main()
