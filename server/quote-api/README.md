# Quote API — Le Raccordement

Receives quote requests from the website's quote list (`cart.html`) and emails them, as a table, to
**commande@leraccordement.com**. Python standard library only, deployable on Railway.

GitHub Pages only hosts static files and cannot send email, so this small service does it. The API key
stays on the server and never reaches the browser.

## What it does

`POST /api/quote` → checks the origin, honeypot, fill time and rate limit (5 requests / 10 min / IP) →
validates every field (lengths, email, phone, no line breaks in header fields, quantities 1–999 999, reference
codes) → creates a request number `DV-YYYYMMDD-XXXXX` → sends an HTML + text email via Resend
(Reply-To = customer) → answers `{"ok": true, "id": …}` **only if Resend accepted the email**. On failure it
answers 502 and the website shows an error, never a success.
A double click or a retry with the same `requestKey` returns the same number without sending a second email.

`GET /health` → `{"ok": true, "configured": true|false}`

## Deploy on Railway (≈ 10 minutes)

1. **Resend** (https://resend.com, free tier: 3,000 emails/month)
   - Add the domain `leraccordement.com` → add the DNS records Resend shows (SPF/DKIM) at your DNS host → wait for "Verified".
   - Create an API key with **Sending access**.
2. **Railway** (https://railway.com) → New project → Deploy from GitHub repo → `imen0112/le-raccordement`.
   - Service settings → **Root directory**: `server/quote-api`.
   - **Variables**:

     | Variable | Value |
     |---|---|
     | `RESEND_API_KEY` | the key from step 1 |
     | `MAIL_FROM` | `Le Raccordement <devis@leraccordement.com>` (any address on the verified domain) |
     | `QUOTE_TO` | `commande@leraccordement.com` |
     | `ALLOWED_ORIGINS` | `https://leraccordement.com,https://www.leraccordement.com` (required: without it every request is refused) |
     | `SEND_CUSTOMER_COPY` | `1` to email the customer an acknowledgement (optional) |
     | `DATA_DIR` | `/data` if you attach a Railway **Volume** at `/data` (optional — keeps `quotes.jsonl`, a log of every request) |

   - Settings → Networking → **Generate domain** → e.g. `https://le-raccordement-quotes.up.railway.app`.
   - Open `https://…up.railway.app/health` → must show `"configured": true`.
3. **Website**: in `js/config.js` set
   `quoteEndpoint: 'https://le-raccordement-quotes.up.railway.app/api/quote'`, commit and push.
4. Send a real test request from the live site and check the commande@ inbox.

Railway blocks outgoing SMTP on its lower plans, which is why the service uses Resend's HTTPS API instead of SMTP.

## Run the tests

```bash
cd server/quote-api && python3 -m unittest -v test_app
```

The tests start the API and a fake Resend endpoint locally. They cover sending, duplicate submissions, provider
failure, validation, header injection, HTML escaping, spam traps, origin checks, the rate limit and CORS.

## Security

- Only the sites in `ALLOWED_ORIGINS` can send requests (CORS); without it the API refuses everything
  (`ALLOW_ANY_ORIGIN=1` exists for local tests only).
- JSON only (`Content-Type: application/json`): plain form posts from other websites are refused.
- 64 KB body limit, strict validation of every field, no line breaks in headers, HTML-escaped email content.
- Spam traps (hidden field, minimum fill time), rate limit per IP (last `X-Forwarded-For` entry, set by Railway's proxy),
  duplicate detection; idle connections time out after 20 s.
- Every response carries `X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Strict-Transport-Security` and `Cache-Control: no-store`. The Resend key never leaves the server.
