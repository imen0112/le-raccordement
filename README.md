# Le Raccordement — Website

Modern, SEO-ready static website for **Le Raccordement** — manufacturer of seamless and welded butt-weld pipe fittings, based in Sfax, Tunisia.

## Tech stack

- **Pure HTML5 + handwritten CSS + vanilla JS** — no build step, hosts anywhere (GitHub Pages, Netlify, Vercel, any static host)
- **Tailwind-free / framework-free** for maximum portability and editing ease
- Fonts: Inter + Space Grotesk + JetBrains Mono (Google Fonts)
- Catalog: 558 references imported from the official Excel article files, one static page per reference, interdependent filters on each family page
- Quote list: localStorage-backed, no prices; requests are emailed to commande@leraccordement.com by the quote API in [`server/quote-api`](server/quote-api/README.md) (Railway + Resend)
- Contact form: still opens the visitor's mail client
- First visit: French or English chosen from the browser language ([`js/lang.js`](js/lang.js), French for fr/ar browsers); the FR/EN switch is remembered
- Reference search in the header of every page ([`js/search.js`](js/search.js), magnifier button or `/` key)
- Two languages: **French at the site root** (main language, product wording taken from the Excel files) and **English under `/en/`**, same tree, linked by the FR/EN switch and `hreflang`

## Pages

French pages are at the root; each English page is the same path under `/en/` (e.g. `/about.html` ↔ `/en/about.html`).

| URL | What it is |
| --- | --- |
| `/` | Home — aerial hero video, product categories, factory mosaic, capabilities, industries, certifications strip, CTA |
| `/about.html` | Inside the plant — mission, numbers, 8-step process, factory gallery |
| `/products/` | The four families, range table, search entry point |
| `/products/elbows.html` (tees, reducers, caps) | Family page — every reference, filters, search, add to quote list |
| `/products/<family>/<code>.html` | One technical page per reference (generated) |
| `/products/product.html?slug=…` | Product-type page (geometry, materials, applications + its catalog references) |
| `/cart.html` | Quote list + quote request form |
| `/quote-sent.html` | Confirmation (shown only after the API confirmed the email) |
| `/certifications.html` | ISO 9001, standards, inspection capabilities |
| `/clients.html` | Logo wall, geographies, sectors |
| `/contact.html` | Contact info, OSM map, message form |
| `/en/...` | English version of every page above |

## Catalog data

The orderable references come from two Excel files (kept **outside** this public repo, they contain customer-specific codes):
`ARTICLES EN10253-1.xlsx` and `CODE ARTICLES ASME SANS SOUDURE PEINTE.xlsx`.

When the files change:

```bash
python3 -m pip install openpyxl            # once
python3 tools/catalog/import_excel.py --en "…/ARTICLES EN10253-1.xlsx" \
    --asme "…/CODE ARTICLES ASME SANS SOUDURE PEINTE.xlsx" --report-dir "…/outside-the-repo"
python3 tools/catalog/build_pages.py       # reference pages, family tables, sitemap
python3 tools/catalog/check_site.py        # links, titles, canonicals, JSON-LD, no prices
```

- `import_excel.py` writes `data/catalog/<family>.json` and, in `--report-dir`, a data-quality report plus a full private export.
  Only "Local" rows are published (customer codes `.01`/`.02` are not); strictly identical duplicate rows are published once.
- `build_pages.py` builds both languages: it only rewrites content between `<!-- CATALOG / JSONLD / FAMILYHEAD / FAMILIES / RANGE / REFERENCES :START/END -->`
  markers, the generated folders `products/<family>/` and `en/products/<family>/`, `js/product-specs.js`, and the FR/EN switch + `hreflang` of every page.
  French reference texts are the Excel designations (`designationDisplay`), English ones are built from the glossary.
- Hand-written pages exist twice (`page.html` and `en/page.html`): edit both. Shared scripts pick their texts with `LR_T(english, french)`
  from [`js/i18n.js`](js/i18n.js), loaded first on every page.
- Filters: [`js/facets.js`](js/facets.js) (pure logic) + [`js/catalog.js`](js/catalog.js) (family page UI). Each filter's options are
  computed from the references matching all *other* active filters, so impossible combinations are never offered.

Product-type pages (geometry, applications…) still live in [`js/products.js`](js/products.js); their `articles` field links them to catalog references.

## Standard documents

Put the PDFs in `assets/docs/` as `EN-10253-1.pdf` and `ASME-B16.9.pdf`, then run `python3 tools/catalog/build_pages.py`:
the slots on the quality page and the four family pages switch from "coming soon" to a "View the PDF" button.

## Quote requests

[`js/quote.js`](js/quote.js) posts the quote list to the API set in [`js/config.js`](js/config.js) (`quoteEndpoint`).
Deployment of the API: see [`server/quote-api/README.md`](server/quote-api/README.md). Until `quoteEndpoint` is set the form says
plainly that online sending is not configured and offers a pre-filled email instead — it never shows a fake success.

## Tests

- Catalog & quote list (browser): serve the repo root and open `/tests/` — data checks against the Excel values, brute-force verification of the filters, quote-list behaviour.
- Quote API: `cd server/quote-api && python3 -m unittest -v test_app`
- Static site: `python3 tools/catalog/check_site.py` (also run by the deploy workflow, which blocks the deploy on failure)

## TODOs before launch

- [ ] Deploy `server/quote-api` (Railway + Resend) and set `quoteEndpoint` in `js/config.js`
- [ ] Confirm that "EN/1" in the article files means EN 10253-1 (shown as "EN 10253-1 (EN/1)")
- [ ] Upload tech-sheet PDFs to `assets/datasheets/{slug}.pdf` and enable the "Download datasheet" button in `products/product.html`

## SEO

- Per-page `<title>`, `<meta description>`, canonical, OpenGraph + Twitter cards
- Organization JSON-LD (home), CollectionPage + ItemList + BreadcrumbList (families), Product + BreadcrumbList (each reference) — no price, availability or review is declared
- `sitemap.xml` (558 reference pages × 2 languages + core pages) + `robots.txt`; filtered family URLs are `noindex, follow` and canonical to the family page
- `hreflang` fr / en / x-default (French) on every page, French and English URLs in `sitemap.xml`
- Semantic HTML with proper heading hierarchy

## Local preview

```bash
# Any static server works. With Python:
cd le-raccordement
python3 -m http.server 8000
# → http://localhost:8000
```

## Deploy

This repo auto-deploys to GitHub Pages on every push to `main` via the workflow at `.github/workflows/deploy.yml`.

**One-time setup (already required for the action to work):**
1. Open the repo on GitHub → **Settings** → **Pages**
2. Under **Build and deployment** → **Source**, select **GitHub Actions**
3. Done. From the next push onward, every commit to `main` is built and deployed automatically.

The site is live at `https://imen0112.github.io/le-raccordement/` (or your custom domain once you add a `CNAME` file).

For a custom domain (`leraccordement.com`):
1. Add a `CNAME` file at the repo root containing just `leraccordement.com`
2. Point the DNS A records to GitHub Pages IPs
3. Enable HTTPS in Pages settings
