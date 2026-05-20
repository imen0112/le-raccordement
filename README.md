# Le Raccordement — Website

Modern, SEO-ready static website for **Le Raccordement** — manufacturer of seamless and welded butt-weld pipe fittings, based in Sfax, Tunisia.

## Tech stack

- **Pure HTML5 + handwritten CSS + vanilla JS** — no build step, hosts anywhere (GitHub Pages, Netlify, Vercel, any static host)
- **Tailwind-free / framework-free** for maximum portability and editing ease
- Fonts: Inter + Space Grotesk + JetBrains Mono (Google Fonts)
- Cart: localStorage-backed quote-list (no backend yet)
- Forms: open the user's mail client with the quote/contact body pre-filled (replace with Formspree/Netlify Forms/etc. for real inbox delivery)

## Pages

| URL | What it is |
| --- | --- |
| `/` | Home — aerial hero video, product categories, factory mosaic, capabilities, industries, certifications strip, CTA |
| `/about.html` | Inside the plant — mission, numbers, 8-step process, factory gallery |
| `/products/` | Full catalog — all SKUs, filter by category |
| `/products/elbows.html` | Elbow category landing |
| `/products/tees.html` | Tee category landing |
| `/products/reducers.html` | Reducer category landing |
| `/products/caps.html` | Cap category landing |
| `/products/product.html?slug=…` | Product detail (renders any SKU by query string) |
| `/cart.html` | Quote list + request form |
| `/certifications.html` | ISO 9001, standards, inspection capabilities |
| `/clients.html` | Logo wall, geographies, sectors |
| `/contact.html` | Contact info, OSM map, message form |
| `/fr/...` | French mirror (to be built) |

## Editing

### Add or edit a product
All product data lives in [`js/products.js`](js/products.js). Edit a SKU there — name, description, materials, prices, image path — and it propagates to:
- the catalog listing
- the category page
- the product detail page
- the dimension table (auto-filtered by `sizeRange`)
- the cart

### Add a real backend for forms
Replace the `mailto:` fallback in [`js/main.js`](js/main.js) with a real endpoint (Formspree, Netlify Forms, EmailJS, etc.). The handler already collects the cart contents into the message body.

### TODOs before launch
- [ ] Replace placeholder phone number `+216 74 000 000` with the real plant number (footer + `contact.html` + `index.html` JSON-LD)
- [ ] Replace indicative prices in `js/products.js` (`priceFrom` field) with real starting prices
- [ ] Upload tech-sheet PDFs to `assets/datasheets/{slug}.pdf` and enable the "Download datasheet" button in `products/product.html`
- [ ] Build the French (`/fr/`) mirror
- [ ] Replace `https://leraccordement.com` placeholder canonical URLs if a different domain is used
- [ ] Hook a real form endpoint (Formspree/Netlify/etc.) in `js/main.js`

## SEO

- Per-page `<title>`, `<meta description>`, canonical, OpenGraph + Twitter cards
- `hreflang` EN/FR alternates on every page
- Organization + Product JSON-LD structured data
- `sitemap.xml` + `robots.txt`
- Semantic HTML with proper heading hierarchy

## Local preview

```bash
# Any static server works. With Python:
cd le-raccordement
python3 -m http.server 8000
# → http://localhost:8000
```

## Deploy

GitHub Pages (simplest):
1. Push to `main` on `github.com/imen0112/le-raccordement`
2. Settings → Pages → Source: `Deploy from a branch`, `main` / `(root)`
3. Site live at `https://imen0112.github.io/le-raccordement/`

For a custom domain (`leraccordement.com`):
1. Add a `CNAME` file at the repo root containing just `leraccordement.com`
2. Point the DNS A records to GitHub Pages IPs
3. Enable HTTPS in Pages settings
