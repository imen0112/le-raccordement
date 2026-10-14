/* Product-type page (products/product.html?slug=…), both languages. */
(function () {
    const T = window.LR_T || ((en) => en);
    const FR = window.LR_LANG === 'fr';
    const slug = new URLSearchParams(window.location.search).get('slug');
    // Product types withdrawn from the range: send old links to their family page
    const REMOVED = { 'elbow-180': 'elbows.html', 'reducing-tee': 'tees.html' };
    if (REMOVED[slug]) { window.location.replace(REMOVED[slug]); return; }
    const p = (window.LR_PRODUCTS || []).find(x => x.slug === slug);
    const notFound = document.getElementById('pd-not-found');
    const content = document.getElementById('pd-content');

    if (!p) { notFound.style.display = ''; document.getElementById('pd-title').textContent = T('Product not found', 'Produit introuvable') + ' · Le Raccordement'; return; }
    content.style.display = '';

    // Meta
    document.title = `${p.name}${T(':', ' :')} ${p.categoryLabel} · Le Raccordement`;
    document.getElementById('pd-desc').setAttribute('content', p.short);
    document.getElementById('pd-canonical').href = `https://leraccordement.com/${FR ? '' : 'en/'}products/product.html?slug=${p.slug}`;
    document.getElementById('pd-og-title').setAttribute('content', `${p.name} | Le Raccordement`);
    document.getElementById('pd-og-desc').setAttribute('content', p.short);
    // p.image is resolved from the site root (js/products.js): publish it on the main domain
    const imageUrl = 'https://leraccordement.com/' + String(p.image).replace(window.LR_SITE_ROOT || '', '').replace(/^(\.\.\/)+/, '');
    document.getElementById('pd-og-image').setAttribute('content', imageUrl);

    // JSON-LD Product
    const jsonld = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": p.name,
      "image": [imageUrl],
      "description": p.description,
      "sku": p.slug,
      "category": p.categoryLabel,
      "brand": { "@type": "Brand", "name": "Le Raccordement" },
      "manufacturer": { "@type": "Organization", "name": "Le Raccordement", "address": T("Sfax, Tunisia", "Sfax, Tunisie") }
    };
    document.getElementById('pd-jsonld').textContent = JSON.stringify(jsonld);

    // Hero
    document.getElementById('pd-categoryLabel').textContent = p.categoryLabel;
    document.getElementById('pd-name').textContent = p.name;
    document.getElementById('pd-short').textContent = p.short;
    const pdImg = document.getElementById('pd-image');
    pdImg.src = p.image;
    pdImg.alt = p.name;

    // Gallery thumbnails, main photo + extra angles + technical drawing
    const photoThumbs = [
      { src: p.image, label: 'Photo 1', cls: 'photo' },
      ...(p.gallery || []).map((src, i) => ({ src, label: `Photo ${i + 2}`, cls: 'photo' }))
    ];
    const thumbs = [
      ...photoThumbs,
      p.technical ? { src: p.technical, label: T('Technical', 'Technique'), cls: 'tech' } : null
    ].filter(Boolean);
    if (thumbs.length > 1) {
      const thumbWrap = document.getElementById('pd-thumbs');
      thumbWrap.innerHTML = thumbs.map((t, i) => `
        <button class="pd-thumb ${i === 0 ? 'is-active' : ''} pd-thumb-${t.cls}" data-thumb="${t.src}" aria-label="${T('View', 'Voir')} ${t.label}">
          <img src="${t.src}" alt="${t.label}" />
          <span class="pd-thumb-label">${t.label}</span>
        </button>`).join('');
      thumbWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-thumb]');
        if (!btn) return;
        pdImg.src = btn.dataset.thumb;
        thumbWrap.querySelectorAll('.pd-thumb').forEach(b => b.classList.toggle('is-active', b === btn));
        // change pd-media background tone if showing technical drawing
        document.querySelector('.pd-media').classList.toggle('is-technical', btn.classList.contains('pd-thumb-tech'));
      });
    }
    document.getElementById('pd-description').textContent = p.description;


    // Breadcrumb
    document.getElementById('pd-crumb').innerHTML = `<a href="../">${T('Home', 'Accueil')}</a><span class="sep">/</span><a href="./">${T('Products', 'Produits')}</a><span class="sep">/</span><a href="${p.category}.html">${p.categoryLabel}</a><span class="sep">/</span><span>${p.name}</span>`;

    // Key spec grid (size, standards, grades, wall, finish from js/product-specs.js)
    const list = a => (a || []).join(', ');
    const keys = [
      [T('Category', 'Catégorie'), p.categoryLabel],
      p.angle ? ['Angle', p.angle] : null,
      p.radius ? [T('Bend radius', 'Rayon de cintrage'), p.radius] : null,
      p.sizeRange ? [T('Size range', 'Plage de dimensions'), p.sizeRange] : null,
      p.thickness ? [T('Wall thickness', 'Épaisseur'), list(p.thickness)] : null,
      p.materials ? [T('Steel grade', 'Nuance d’acier'), list(p.materials)] : null,
      p.standards ? [T('Standard', 'Norme'), list(p.standards)] : null,
      p.manufacturing ? [T('Manufacturing', 'Fabrication'), list(p.manufacturing)] : null,
      p.coating ? [T('Finish', 'Finition'), list(p.coating)] : null,
      p.refCount ? [T('Catalog references', 'Références catalogue'), p.refCount] : null,
      [T('Marking', 'Marquage'), p.marking],
      [T('Packaging', 'Emballage'), p.packaging],
      [T('Certificate', 'Certificat'), p.certificate],
      [T('Lead time', 'Délai'), p.leadTime],
      [T('Min. order', 'Commande min.'), p.minOrder]
    ].filter(Boolean);
    document.getElementById('pd-facts').innerHTML = keys.slice(1, 10).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    document.getElementById('pd-keyspec').innerHTML = keys.map(([k, v]) => `<div class="k">${k}</div><div class="v">${v}</div>`).join('');

    // Tag rows
    const tagRow = (id, arr) => document.getElementById(id).innerHTML = (arr || []).map(t => `<span class="tag">${t}</span>`).join('');
    tagRow('pd-materials', p.materials);
    tagRow('pd-thickness', p.thickness);
    tagRow('pd-coating', p.coating);

    // Standards quick-pills (top of right column)
    document.getElementById('pd-standards-quick').innerHTML = (p.standards || []).map(s => `<span class="tag">${s}</span>`).join('');

    // Applications, render as 4-card grid
    document.getElementById('pd-app-cards').innerHTML = (p.applications || []).map(app => `
      <div class="card"><h3 class="h-4">${app}</h3></div>`).join('');

    // Standards, render as detailed cards with descriptions
    const STD_DESC = {
      'ASME B16.9': T('Factory-made wrought butt-welding fittings. North-American reference for dimensions and tolerances.', 'Raccords à souder bout à bout forgés en usine. Référence nord-américaine pour les dimensions et les tolérances.'),
      'EN 10253-1': T('European standard for butt-welding pipe fittings, Part 1, carbon steel without specific inspection requirements.', 'Norme européenne des raccords à souder bout à bout, partie 1 : acier au carbone sans exigences de contrôle spécifiques.')
    };
    document.getElementById('pd-standard-cards').innerHTML = (p.standards || []).map(s => `
      <div class="cert-card">
        <span class="num">${T('Standard', 'Norme')}</span>
        <h3>${s}</h3>
        <p class="text-muted" style="font-size:var(--fs-14);">${STD_DESC[s] || T('International manufacturing standard.', 'Norme internationale de fabrication.')}</p>
      </div>`).join('');

    // Catalog references matching this product type
    (function renderRefs() {
      const box = document.getElementById('pd-refs');
      const prefixes = p.articles || [];
      const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      if (!prefixes.length) {
        box.innerHTML = FR
          ? `<p class="text-muted">Ce type de produit est fabriqué à la commande et n’a pas encore de référence catalogue standard. <a href="../contact.html" style="text-decoration:underline">Envoyez-nous votre spécification</a> ou parcourez toutes les <a href="${p.category}.html#references" style="text-decoration:underline">références de ${esc(p.categoryLabel.toLowerCase())}</a>.</p>`
          : `<p class="text-muted">This product type is made to order and has no standard catalog reference yet. <a href="../contact.html" style="text-decoration:underline">Send us your specification</a> or browse all <a href="${p.category}.html#references" style="text-decoration:underline">${esc(p.categoryLabel.toLowerCase())} references</a>.</p>`;
        return;
      }
      fetch(`${window.LR_SITE_ROOT || '../../'}data/catalog/${p.category}.json?v=${window.LR_DATA_V || ''}`).then(r => r.json()).then(data => {
        const refs = data.items.filter(it => prefixes.some(pre => it.article.startsWith(pre)));
        window.LR_REF_INDEX = window.LR_REF_INDEX || {};
        refs.forEach(it => { window.LR_REF_INDEX[it.id] = it; });
        const articles = Array.from(new Set(refs.map(it => (FR ? it.article : it.articleEn))));
        const qs = articles.map(a => 'article=' + encodeURIComponent(a)).join('&');
        document.getElementById('pd-refs-title').textContent = `${refs.length} ${T('available references.', 'références disponibles.')}`;
        box.innerHTML = `<div class="ref-table-wrap"><table class="ref-table">
          <thead><tr><th scope="col">${T('Reference', 'Référence')}</th><th scope="col">${T('Designation', 'Désignation')}</th><th scope="col">Dimensions (mm)</th><th scope="col">${T('Standard · grade', 'Norme · nuance')}</th><th scope="col">${T('Type · finish', 'Type · finition')}</th><th scope="col">${T('Quantity (min. 50)', 'Quantité (min. 50)')}</th></tr></thead>
          <tbody>${refs.map(it => { const x = window.LR_REFTXT(it); return `<tr data-ref-row>
            <td data-label="${T('Reference', 'Référence')}" class="ref-code"><a href="${it.family}/${it.slug}.html">${esc(it.code)}</a></td>
            <td data-label="${T('Designation', 'Désignation')}" class="ref-desig"><a class="ref-desig-link" href="${it.family}/${it.slug}.html">${esc(x.designation)}</a></td>
            <td data-label="Dimensions" class="ref-dims">${esc(x.dims)}</td>
            <td data-label="${T('Standard · grade', 'Norme · nuance')}">${esc(x.norme)}<span class="ref-sub">${esc(it.nuance)}</span></td>
            <td data-label="${T('Type · finish', 'Type · finition')}">${x.type ? `${esc(x.type)}<span class="ref-sub">${esc(x.finish)}</span>` : esc(x.finish)}</td>
            <td data-label="${T('Quantity', 'Quantité')}" class="ref-actions"><div class="qty qty-sm"><button type="button" data-qty="dec" aria-label="${T('Decrease', 'Diminuer')}">−</button><input type="text" inputmode="numeric" value="50" data-row-qty aria-label="${T('Quantity for', 'Quantité pour')} ${esc(it.code)}"/><button type="button" data-qty="inc" aria-label="${T('Increase', 'Augmenter')}">+</button></div>
              <button type="button" class="btn btn-dark btn-sm" data-add-ref="${esc(it.id)}">${T('Add', 'Ajouter')}<span class="sr-only"> ${esc(it.code)} ${T('to quote list', 'à la liste de devis')}</span></button>
            <a class="btn btn-ghost btn-sm ref-details" href="${it.family}/${it.slug}.html">${T('Details', 'Détails')}<span class="sr-only"> ${T('and compatible fittings', 'et raccords compatibles')}</span></a></td>
          </tr>`; }).join('')}</tbody></table></div>
          <p class="mt-6"><a class="btn btn-ghost btn-sm" href="${p.category}.html?${qs}#references">${T('Filter these references by size, standard and finish →', 'Filtrer ces références par dimension, norme et finition →')}</a></p>`;
      }).catch(() => {
        box.innerHTML = FR
          ? `<p class="text-muted">Les références n’ont pas pu être chargées. <a href="${p.category}.html#references" style="text-decoration:underline">Ouvrir le catalogue des ${esc(p.categoryLabel.toLowerCase())}</a>.</p>`
          : `<p class="text-muted">References could not be loaded. <a href="${p.category}.html#references" style="text-decoration:underline">Open the ${esc(p.categoryLabel.toLowerCase())} catalog</a>.</p>`;
      });
    })();

    // Related (same category, exclude self)
    const related = (window.LR_PRODUCTS || []).filter(x => x.category === p.category && x.slug !== p.slug).slice(0, 4);
    document.getElementById('pd-related').innerHTML = related.map(r => `
      <a href="product.html?slug=${r.slug}" class="product-card">
        <div class="product-card-media"><img src="${r.image}" alt="${r.name}" loading="lazy" /></div>
        <div class="product-card-body">
          <span class="product-card-cat">${r.categoryLabel}</span>
          <h3>${r.name}</h3>
        </div>
        <div class="product-card-foot">
          <span class="product-card-quote">${T('Price on request', 'Prix sur demande')}</span>
        </div>
      </a>`).join('') || `<p class="text-muted">${T('No related products in this category.', 'Aucun autre produit dans cette catégorie.')}</p>`;
  })();
