/* Product types (marketing pages: products/product.html?slug=…).
   The orderable references come from the Excel files, see data/catalog/.
   No prices: every request goes through a quote. */

window.LR_PRODUCTS = [
  /* ----- ELBOWS ----- */
  {
    slug: 'elbow-90-1-5d',
    articles: ['Coude à souder 90° 1.5D'],   // Excel 'Article' prefixes → catalog references
    name: 'Elbow 90° LR 1.5D',
    category: 'elbows',
    categoryLabel: 'Elbows',
    image: 'assets/img/products/elbow-90.webp',
    technical: 'assets/img/products/technical/elbow-90.png',
    gallery: ["assets/img/products/gallery/elbow-90-alt.webp"],
    short: 'Long-radius 90° elbow, 1.5D bend radius, seamless, to ASME B16.9 in A234 WPB.',
    description: 'Long-radius (LR) 1.5D 90° elbow for butt-welded piping systems. Cold-formed from seamless pipe in A234 WPB to ASME B16.9, wall thickness STD or XS, painted finish.',
    angle: '90°',
    rawMaterial: 'Seamless & welded pipes',
    marking: 'Stamped (micro-percussion)',
    packaging: 'Pallets, cartons',
    certificate: 'EN 10204: Mill Test Certificate 3.1 / Report 2.2',
    applications: ['Petroleum & Oil', 'Natural Gas', 'Chemical Engineering', 'Power Generation', 'Shipbuilding', 'Water Distribution', 'Nuclear Energy', 'Waste Disposal'],
    leadTime: '3 to 6 weeks',
    minOrder: '50 pcs'
  },
  {
    slug: 'elbow-90-3d',
    articles: ['Coude à souder 90° 3D'],   // Excel 'Article' prefixes → catalog references
    name: 'Elbow 90° LR 3D',
    category: 'elbows',
    categoryLabel: 'Elbows',
    image: 'assets/img/products/elbow-90.webp',
    technical: 'assets/img/products/technical/elbow-90.png',
    gallery: ["assets/img/products/gallery/elbow-90-alt.webp"],
    short: '90° elbow with a 3D bend radius, seamless or welded, to EN 10253-1 in S235.',
    description: 'Extra-long-radius 3D 90° elbow for lines that need lower turbulence and pressure loss. Cold-formed from seamless or welded pipe in S235 to EN 10253-1, black or galvanized.',
    angle: '90°',
    rawMaterial: 'Seamless & welded pipes',
    marking: 'Stamped (micro-percussion)',
    packaging: 'Pallets, cartons',
    certificate: 'EN 10204: Mill Test Certificate 3.1 / Report 2.2',
    applications: ['Petroleum & Oil', 'Natural Gas', 'Chemical Engineering', 'Power Generation', 'Shipbuilding', 'Water Distribution', 'Nuclear Energy', 'Waste Disposal'],
    leadTime: '3 to 6 weeks',
    minOrder: '50 pcs'
  },
  {
    slug: 'elbow-45',
    articles: ['Coude à souder 45°'],   // Excel 'Article' prefixes → catalog references
    name: 'Elbow 45° LR',
    category: 'elbows',
    categoryLabel: 'Elbows',
    image: 'assets/img/products/elbow-45.webp',
    technical: 'assets/img/products/technical/elbow-45.png',
    gallery: ["assets/img/products/gallery/elbow-45-alt-a.webp", "assets/img/products/gallery/elbow-45-alt-b.webp"],
    short: '45° elbow, 1.5D (ASME B16.9) or 3D (EN 10253-1) radius.',
    description: 'Butt-welding 45° elbow to gently redirect flow. Available in 1.5D radius to ASME B16.9 (A234 WPB, STD or XS, painted) and in 3D radius to EN 10253-1 (S235, seamless or welded, black or galvanized).',
    angle: '45°',
    rawMaterial: 'Seamless & welded pipes',
    marking: 'Stamped (micro-percussion)',
    packaging: 'Pallets, cartons',
    certificate: 'EN 10204: Mill Test Certificate 3.1 / Report 2.2',
    applications: ['Petroleum & Oil', 'Natural Gas', 'Chemical Engineering', 'Power Generation', 'Shipbuilding', 'Water Distribution', 'Nuclear Energy', 'Waste Disposal'],
    leadTime: '3 to 6 weeks',
    minOrder: '50 pcs'
  },

  /* ----- TEES ----- */
  {
    slug: 'equal-tee',
    articles: ['Té égal à souder'],   // Excel 'Article' prefixes → catalog references
    name: 'Equal Tee',
    category: 'tees',
    categoryLabel: 'Tees',
    image: 'assets/img/products/equal-tee.webp',
    technical: 'assets/img/products/technical/equal-tee.png',
    gallery: ["assets/img/products/gallery/tee-alt-a.webp", "assets/img/products/gallery/tee-alt-b.webp"],
    short: 'Equal butt-weld tee, Ø 60.3 to 219.1 mm, to ASME B16.9 and EN 10253-1.',
    description: 'Equal butt-welding tee with three identical bores, to split or merge flow. Made from seamless or welded pipe, to ASME B16.9 (A234 WPB) and EN 10253-1 (S235).',
    rawMaterial: 'Seamless & welded pipes',
    marking: 'Stamped (micro-percussion)',
    packaging: 'Pallets, cartons',
    certificate: 'EN 10204: Mill Test Certificate 3.1 / Report 2.2',
    applications: ['Petroleum & Oil', 'Natural Gas', 'Chemical Engineering', 'Power Generation', 'Shipbuilding', 'Water Distribution', 'Nuclear Energy', 'Waste Disposal'],
    leadTime: '3 to 6 weeks',
    minOrder: '50 pcs'
  },

  /* ----- REDUCERS ----- */
  {
    slug: 'concentric-reducer',
    articles: ['RC à souder'],   // Excel 'Article' prefixes → catalog references
    name: 'Concentric Reducer',
    category: 'reducers',
    categoryLabel: 'Reducers',
    image: 'assets/img/products/concentric-reducer.webp',
    technical: 'assets/img/products/technical/concentric-reducer.png',
    gallery: ["assets/img/products/gallery/reducer-alt.webp"],
    short: 'Concentric reducer (Form 1, Form 2 and ASME B16.9) for coaxial transitions.',
    description: 'Concentric butt-welding reducer connecting two pipes of different diameters on a common axis. EN 10253-1 Form 1 and Form 2 in S235 (seamless or welded, black or galvanized), and ASME B16.9 in A234 WPB (STD or XS, painted).',
    rawMaterial: 'Seamless & welded pipes',
    marking: 'Stamped (micro-percussion)',
    packaging: 'Pallets, cartons',
    certificate: 'EN 10204: Mill Test Certificate 3.1 / Report 2.2',
    applications: ['Petroleum & Oil', 'Natural Gas', 'Chemical Engineering', 'Power Generation', 'Shipbuilding', 'Water Distribution', 'Nuclear Energy', 'Waste Disposal'],
    leadTime: '3 to 6 weeks',
    minOrder: '50 pcs'
  },
  {
    slug: 'eccentric-reducer',
    articles: ['RE à souder'],   // Excel 'Article' prefixes → catalog references
    name: 'Eccentric Reducer',
    category: 'reducers',
    categoryLabel: 'Reducers',
    image: 'assets/img/products/eccentric-reducer.webp',
    technical: 'assets/img/products/technical/eccentric-reducer.png',
    short: 'Eccentric reducer that keeps one side flat, to ASME B16.9 in A234 WPB.',
    description: 'Eccentric butt-welding reducer with offset centerlines, keeping one outer surface flush. Used on horizontal pump suction lines to avoid air pockets. Seamless, A234 WPB to ASME B16.9, STD or XS, painted.',
    rawMaterial: 'Seamless & welded pipes',
    marking: 'Stamped (micro-percussion)',
    packaging: 'Pallets, cartons',
    certificate: 'EN 10204: Mill Test Certificate 3.1 / Report 2.2',
    applications: ['Petroleum & Oil', 'Natural Gas', 'Chemical Engineering', 'Power Generation', 'Shipbuilding', 'Water Distribution', 'Nuclear Energy', 'Waste Disposal'],
    leadTime: '3 to 6 weeks',
    minOrder: '50 pcs'
  },

  /* ----- CAPS ----- */
  {
    slug: 'cap',
    articles: ['Caps à souder', 'Fond à souder'],   // Excel 'Article' prefixes → catalog references
    name: 'Cap and Dished End',
    category: 'caps',
    categoryLabel: 'Caps',
    image: 'assets/img/products/cap.webp',
    technical: 'assets/img/products/technical/cap.png',
    gallery: ["assets/img/products/gallery/cap-alt-a.webp", "assets/img/products/gallery/cap-alt-b.webp"],
    short: 'Butt-weld caps and dished ends, Ø 21.3 to 219.1 mm.',
    description: 'Butt-welding caps and dished ends to close a pipe run. EN 10253-1 in S235 (black or galvanized) and ASME B16.9 in A234 WPB (STD or XS, painted).',
    rawMaterial: 'Seamless & welded pipes',
    marking: 'Stamped (micro-percussion)',
    packaging: 'Pallets, cartons',
    certificate: 'EN 10204: Mill Test Certificate 3.1 / Report 2.2',
    applications: ['Petroleum & Oil', 'Natural Gas', 'Chemical Engineering', 'Power Generation', 'Shipbuilding', 'Water Distribution', 'Nuclear Energy', 'Waste Disposal'],
    leadTime: '3 to 6 weeks',
    minOrder: '50 pcs'
  }
];

window.LR_CATEGORIES = [
  {
    slug: 'elbows',
    name: 'Elbows',
    tagline: 'Long-radius bends, 45° · 90°',
    description: '45° and 90° elbows, 1.5D and 3D radius, Ø 21.3 to 323.8 mm, to ASME B16.9 and EN 10253-1.',
    image: 'assets/img/products/elbow-90.webp'
  },
  {
    slug: 'tees',
    name: 'Tees',
    tagline: 'Equal tees',
    description: 'Equal butt-weld tees, Ø 60.3 to 219.1 mm, seamless or welded.',
    image: 'assets/img/products/equal-tee.webp'
  },
  {
    slug: 'reducers',
    name: 'Reducers',
    tagline: 'Concentric & eccentric',
    description: 'Concentric (Form 1, Form 2, ASME) and eccentric reducers.',
    image: 'assets/img/products/concentric-reducer.webp'
  },
  {
    slug: 'caps',
    name: 'Caps',
    tagline: 'Pipe terminations',
    description: 'Butt-weld caps and dished ends, Ø 21.3 to 219.1 mm.',
    image: 'assets/img/products/cap.webp'
  }
];

window.LR_findProduct = function(slug) {
  return (window.LR_PRODUCTS || []).find(p => p.slug === slug);
};
window.LR_byCategory = function(catSlug) {
  return (window.LR_PRODUCTS || []).filter(p => p.category === catSlug);
};

/* ---------------------------------------------------------------
   French texts (French site, see js/i18n.js). Product-type names use the
   wording of the Excel article files. Applied over the English texts above.
   --------------------------------------------------------------- */
(function () {
  if (window.LR_LANG === 'en' || !window.LR_LANG) return;
  const common = {
    rawMaterial: 'Tubes sans soudure et soudés',
    marking: 'Marquage par micro-percussion',
    packaging: 'Palettes, cartons',
    certificate: 'EN 10204 : certificat de réception 3.1 / relevé de contrôle 2.2',
    applications: ['Pétrole', 'Gaz naturel', 'Génie chimique', 'Production d’énergie', 'Construction navale', 'Distribution d’eau', 'Énergie nucléaire', 'Traitement des déchets'],
    leadTime: '3 à 6 semaines',
    minOrder: '50 pièces'
  };
  const FR = {
    'elbow-90-1-5d': {
      name: 'Coude à souder 90° 1.5D', categoryLabel: 'Coudes',
      short: 'Coude 90° grand rayon, rayon de cintrage 1.5D, sans soudure, selon ASME B16.9 en A234 WPB.',
      description: 'Coude 90° grand rayon (LR) 1.5D pour réseaux de tuyauterie soudés bout à bout. Formé à froid à partir de tube sans soudure en A234 WPB selon ASME B16.9, épaisseur STD ou XS, finition peinte.'
    },
    'elbow-90-3d': {
      name: 'Coude à souder 90° 3D', categoryLabel: 'Coudes',
      short: 'Coude 90° de rayon 3D, sans soudure ou soudé, selon EN 10253-1 en S235.',
      description: 'Coude 90° très grand rayon 3D pour les lignes qui demandent moins de turbulences et de pertes de charge. Formé à froid à partir de tube sans soudure ou soudé en S235 selon EN 10253-1, noir ou galvanisé.'
    },
    'elbow-45': {
      name: 'Coude à souder 45°', categoryLabel: 'Coudes',
      short: 'Coude 45°, rayon 1.5D (ASME B16.9) ou 3D (EN 10253-1).',
      description: 'Coude 45° à souder bout à bout pour dévier le flux en douceur. Disponible en rayon 1.5D selon ASME B16.9 (A234 WPB, STD ou XS, peint) et en rayon 3D selon EN 10253-1 (S235, sans soudure ou soudé, noir ou galvanisé).'
    },
    'equal-tee': {
      name: 'Té égal à souder', categoryLabel: 'Tés',
      short: 'Té égal à souder bout à bout, Ø 60,3 à 219,1 mm, selon ASME B16.9 et EN 10253-1.',
      description: 'Té égal à souder bout à bout, avec trois sorties identiques, pour diviser ou réunir un flux. Fabriqué à partir de tube sans soudure ou soudé, selon ASME B16.9 (A234 WPB) et EN 10253-1 (S235).'
    },
    'concentric-reducer': {
      name: 'Réduction concentrique à souder', categoryLabel: 'Réductions',
      short: 'Réduction concentrique (forme 1, forme 2 et ASME B16.9) pour les transitions coaxiales.',
      description: 'Réduction concentrique à souder bout à bout reliant deux tubes de diamètres différents sur un même axe. EN 10253-1 forme 1 et forme 2 en S235 (sans soudure ou soudée, noire ou galvanisée), et ASME B16.9 en A234 WPB (STD ou XS, peinte).'
    },
    'eccentric-reducer': {
      name: 'Réduction excentrique à souder', categoryLabel: 'Réductions',
      short: 'Réduction excentrique qui garde un côté plat, selon ASME B16.9 en A234 WPB.',
      description: 'Réduction excentrique à souder bout à bout, aux axes décalés, qui garde une génératrice alignée. Utilisée à l’aspiration des pompes sur les lignes horizontales pour éviter les poches d’air. Sans soudure, A234 WPB selon ASME B16.9, STD ou XS, peinte.'
    },
    'cap': {
      name: 'Caps et fonds à souder', categoryLabel: 'Caps et fonds',
      short: 'Caps et fonds à souder bout à bout, Ø 21,3 à 219,1 mm.',
      description: 'Caps et fonds à souder bout à bout pour fermer une ligne de tuyauterie. EN 10253-1 en S235 (noir ou galvanisé) et ASME B16.9 en A234 WPB (STD ou XS, peint).'
    }
  };
  const CAT = {
    elbows: { name: 'Coudes', tagline: 'Coudes grand rayon, 45° · 90°', description: 'Coudes 45° et 90°, rayon 1.5D et 3D, Ø 21,3 à 323,8 mm, selon ASME B16.9 et EN 10253-1.' },
    tees: { name: 'Tés', tagline: 'Tés égaux', description: 'Tés égaux à souder, Ø 60,3 à 219,1 mm, sans soudure ou soudés.' },
    reducers: { name: 'Réductions', tagline: 'Concentriques et excentriques', description: 'Réductions concentriques (forme 1, forme 2, ASME) et excentriques.' },
    caps: { name: 'Caps et fonds', tagline: 'Fermeture de ligne', description: 'Caps et fonds à souder, Ø 21,3 à 219,1 mm.' }
  };
  (window.LR_PRODUCTS || []).forEach(p => { if (FR[p.slug]) Object.assign(p, common, FR[p.slug]); });
  (window.LR_CATEGORIES || []).forEach(c => { if (CAT[c.slug]) Object.assign(c, CAT[c.slug]); });
})();

/* Name of a product type in the page language (quote list) */
window.LR_PNAME = p => p.name;

/* ---------------------------------------------------------------
   Path resolver: image paths are stored relative to the site root
   (e.g. "assets/img/products/elbow-90.webp"). Pages live at different
   depths (French at the root, English under /en/), so every path is
   made absolute from the site root found by js/i18n.js.
   --------------------------------------------------------------- */
(function () {
  let prefix = window.LR_SITE_ROOT || '';
  if (!prefix) {
    // i18n.js missing: work out the depth from the URL
    const p = window.location.pathname;
    prefix = (/\/en\//.test(p) ? '../' : '') + (/\/products\//.test(p) ? '../' : '');
  }
  if (!prefix) return;

  function fix(s) {
    if (typeof s !== 'string') return s;
    if (/^(https?:|\/|\.\.\/)/.test(s)) return s;
    return prefix + s;
  }
  (window.LR_PRODUCTS || []).forEach(pr => {
    pr.image = fix(pr.image);
    pr.technical = fix(pr.technical);
    if (Array.isArray(pr.gallery)) pr.gallery = pr.gallery.map(fix);
  });
  (window.LR_CATEGORIES || []).forEach(c => {
    c.image = fix(c.image);
  });
})();
