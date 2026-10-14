/* Texts in the page language (js/i18n.js); English if i18n.js is missing */
window.LR_T = window.LR_T || ((en) => en);

/* Header scroll, mobile nav, reveal on scroll, simple year */
(function () {
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Mobile nav
  const mn = document.getElementById('mobile-nav');
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-open-nav]')) { mn && mn.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
    if (e.target.closest('[data-close-nav]') || e.target.classList.contains('mobile-nav')) {
      if (mn) { mn.classList.remove('is-open'); document.body.style.overflow = ''; }
    }
  });

  // Reveal-on-scroll
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Only elements below the fold get the entrance; anything already on screen stays visible
    document.querySelectorAll('.reveal').forEach(el => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-visible');
    });
    document.documentElement.classList.add('js-reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.01, rootMargin: '0px 0px 80px 0px' });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
  }

  // Product-type page (product.html?slug=…): the FR/EN switch and hreflang links keep the product
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (slug) {
    document.querySelectorAll('[data-lang-toggle] a[hreflang], link[rel="alternate"][hreflang]').forEach(a => {
      const u = new URL(a.getAttribute('href'), window.location.href);
      u.searchParams.set('slug', slug);
      a.setAttribute('href', a.tagName === 'LINK' ? u.href : a.getAttribute('href').split('?')[0] + u.search);
    });
  }

  // FR/EN switch: remember the visitor's choice (js/lang.js no longer redirects them)
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-lang-toggle] a[hreflang]');
    if (a) { try { localStorage.setItem('lr_lang', a.getAttribute('hreflang')); } catch (err) { /* storage blocked */ } }
  });

  // Range table tabs (products overview: EN 10253-1 / ASME B16.9)
  document.addEventListener('click', function (e) {
    const t = e.target.closest('[data-range-tab]');
    if (!t) return;
    document.querySelectorAll('[data-range-tab]').forEach(b => b.setAttribute('aria-selected', b === t ? 'true' : 'false'));
    document.querySelectorAll('.range-panel').forEach(p => { p.hidden = p.id !== 'range-panel-' + t.dataset.rangeTab; });
  });

  // Print buttons (reference sheets)
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-print]')) window.print();
  });

  // Contact map: click to enable interaction so the scroll wheel is not hijacked
  const mapWrap = document.getElementById('contact-map');
  if (mapWrap) {
    const unlock = mapWrap.querySelector('.map-unlock');
    if (unlock) unlock.addEventListener('click', () => mapWrap.classList.add('is-active'));
    document.addEventListener('click', e => { if (!mapWrap.contains(e.target)) mapWrap.classList.remove('is-active'); });
  }

  // Year
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  // In-page nav scroll spy (used on product detail page)
  const pdNav = document.getElementById('pd-nav');
  if (pdNav) {
    const links = pdNav.querySelectorAll('a[href^="#"]');
    const sections = Array.from(links).map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    if (sections.length && 'IntersectionObserver' in window) {
      const spyIo = new IntersectionObserver((entries) => {
        entries.forEach(en => {
          if (en.isIntersecting) {
            const id = '#' + en.target.id;
            links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === id));
          }
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      sections.forEach(s => spyIo.observe(s));
    }
    // Smooth scroll on click
    links.forEach(a => {
      a.addEventListener('click', (e) => {
        const target = document.querySelector(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        const offset = 160;
        const y = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: y, behavior: 'smooth' });
        history.replaceState(null, '', a.getAttribute('href'));
      });
    });
  }

  // Quote form: see js/quote.js (cart page). Contact form below still uses the mail client.
  document.addEventListener('submit', function (e) {
    const form = e.target.closest('[data-contact-form]');
    if (!form) return;
    e.preventDefault();
    const data = new FormData(form);
    const T = window.LR_T, none = T('not provided', 'non renseigné'), sep = T(':', ' :');
    const body = `${T('Name', 'Nom')}${sep} ${data.get('name')}\n${T('Company', 'Société')}${sep} ${data.get('company') || none}\n${T('Email', 'E-mail')}${sep} ${data.get('email')}\n${T('Phone', 'Téléphone')}${sep} ${data.get('phone') || none}\n${T('Subject', 'Objet')}${sep} ${data.get('subject') || none}\n\nMessage${sep}\n${data.get('message') || none}\n`;
    const subject = encodeURIComponent(data.get('subject') || 'Contact, Le Raccordement');
    window.location.href = `mailto:info@leraccordement.com?subject=${subject}&body=${encodeURIComponent(body)}`;
  });
})();

/* Lightbox for the factory gallery: click a photo to see it large, arrows to browse them all */
(function () {
  const SEL = '.mosaic img';
  let dlg, list = [], idx = 0;
  function ensure() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    const T = window.LR_T;
    dlg.setAttribute('aria-label', T('Photo gallery', 'Galerie photos'));
    dlg.innerHTML = '<button type="button" class="lightbox-close" aria-label="' + T('Close', 'Fermer') + '">×</button>' +
      '<button type="button" class="lightbox-nav lightbox-prev" data-dir="-1" aria-label="' + T('Previous photo', 'Photo précédente') + '">‹</button>' +
      '<img alt="" draggable="false" />' +
      '<button type="button" class="lightbox-nav lightbox-next" data-dir="1" aria-label="' + T('Next photo', 'Photo suivante') + '">›</button>' +
      '<p class="lightbox-count" aria-live="polite"></p>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', e => {
      if (e.target === dlg || e.target.closest('.lightbox-close')) { dlg.close(); return; }
      const nav = e.target.closest('.lightbox-nav');
      if (nav) go(+nav.dataset.dir);
    });
    dlg.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    });
    return dlg;
  }
  function show() {
    const img = list[idx], big = dlg.querySelector('img');
    big.src = img.currentSrc || img.src;
    big.alt = img.alt || '';
    dlg.querySelector('.lightbox-count').textContent = list.length > 1 ? (idx + 1) + ' / ' + list.length : '';
    dlg.querySelectorAll('.lightbox-nav').forEach(b => { b.hidden = list.length < 2; });
    const next = list[(idx + 1) % list.length]; if (next) { const p = new Image(); p.src = next.currentSrc || next.src; }
  }
  function go(d) { idx = (idx + d + list.length) % list.length; show(); }
  function open(img) {
    ensure();
    list = Array.from(document.querySelectorAll(SEL));
    idx = Math.max(0, list.indexOf(img));
    show();
    if (typeof dlg.showModal === 'function') dlg.showModal();
  }
  function mark() {
    document.querySelectorAll(SEL).forEach(img => {
      if (img.dataset.zoomReady) return;
      img.dataset.zoomReady = '1';
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', window.LR_T('Open the photo gallery', 'Ouvrir la galerie photos'));
    });
  }
  document.addEventListener('click', e => {
    const img = e.target.closest(SEL);
    if (img && img.tagName === 'IMG') { e.preventDefault(); open(img); }
  });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches(SEL)) { e.preventDefault(); open(e.target); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark); else mark();
})();

/* Background videos: loaded only on large screens, without data saver or reduced motion,
   and only when they come into view. Otherwise the poster photo stays. */
(function () {
  const vids = document.querySelectorAll('video[data-lazy-video]');
  if (!vids.length) return;
  const conn = navigator.connection || {};
  const ok = window.matchMedia('(min-width: 900px)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !conn.saveData;
  if (!ok) return;
  function start(v) {
    v.querySelectorAll('source[data-src]').forEach(s => { s.src = s.dataset.src; s.removeAttribute('data-src'); });
    v.load();
    const p = v.play(); if (p && p.catch) p.catch(() => {});
  }
  const near = v => v.getBoundingClientRect().top < window.innerHeight + 200;
  if (!('IntersectionObserver' in window)) { vids.forEach(start); return; }
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { start(en.target); io.unobserve(en.target); }
  }), { rootMargin: '200px' });
  // Already on screen at load: start right away; the others when scrolled into view
  vids.forEach(v => { if (near(v)) start(v); else io.observe(v); });
})();

/* Photos and videos: no right-click menu, no drag-and-drop, no long-press save on phones.
   (A deterrent: nothing on the web can stop a screenshot.) */
(function () {
  const media = t => t && t.closest && t.closest('img, video, picture, .hero-media, .mosaic, .lightbox');
  document.addEventListener('contextmenu', e => { if (media(e.target)) e.preventDefault(); });
  document.addEventListener('dragstart', e => { if (media(e.target)) e.preventDefault(); });
  document.querySelectorAll('video').forEach(v => { v.setAttribute('controlslist', 'nodownload'); v.disablePictureInPicture = true; });
})();

/* Certificate viewer: whole pages fit on screen, multi-page reports shown all at once
   (click a page to see it alone). No download link; saving is blocked site-wide. */
(function () {
  // Certificate list: JSON data in the page (no inline script)
  let certs = null;
  try { const el = document.getElementById('lr-certs'); if (el) certs = JSON.parse(el.textContent); } catch (e) { certs = null; }
  if (!certs) return;
  let dlg, doc = null, idx = -1;
  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'lightbox cert-viewer';
    dlg.setAttribute('aria-label', window.LR_T('Certificate viewer', 'Visionneuse de certificat'));
    dlg.innerHTML = '<button type="button" class="lightbox-close" aria-label="' + window.LR_T('Close', 'Fermer') + '">×</button>' +
      '<div class="cert-viewer-stage"></div>' +
      '<div class="cert-viewer-bar"></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', e => {
      if (e.target === dlg || e.target.closest('.lightbox-close')) { dlg.close(); return; }
      const page = e.target.closest('[data-page]');
      if (page) { idx = +page.dataset.page; render(); return; }
      const nav = e.target.closest('[data-dir]');
      if (nav) { idx = Math.min(doc.pages.length - 1, Math.max(0, idx + +nav.dataset.dir)); render(); return; }
      if (e.target.closest('[data-all]')) { idx = -1; render(); }
    });
    dlg.addEventListener('keydown', e => {
      if (idx < 0 || doc.pages.length < 2) return;
      if (e.key === 'ArrowRight') { idx = Math.min(doc.pages.length - 1, idx + 1); render(); }
      if (e.key === 'ArrowLeft') { idx = Math.max(0, idx - 1); render(); }
    });
  }
  function render() {
    const T = window.LR_T;
    const stage = dlg.querySelector('.cert-viewer-stage');
    const bar = dlg.querySelector('.cert-viewer-bar');
    const multi = doc.pages.length > 1;
    if (multi && idx < 0) {
      stage.className = 'cert-viewer-stage is-grid';
      stage.innerHTML = doc.pages.map((src, i) =>
        `<button type="button" class="cert-page" data-page="${i}" aria-label="Page ${i + 1}, ${T('view alone', 'afficher seule')}"><img src="${src}" alt="${doc.title}, page ${i + 1}" draggable="false" /><span>${i + 1}</span></button>`).join('');
      bar.innerHTML = '';
    } else {
      const i = Math.max(0, idx);
      stage.className = 'cert-viewer-stage is-single';
      stage.innerHTML = `<img src="${doc.pages[i]}" alt="${doc.title}${multi ? ', page ' + (i + 1) : ''}" draggable="false" />`;
      bar.innerHTML = multi
        ? `<button type="button" class="cert-nav" data-dir="-1" aria-label="${T('Previous page', 'Page précédente')}"${i === 0 ? ' disabled' : ''}>‹</button>` +
          `<span>Page ${i + 1} / ${doc.pages.length}</span>` +
          `<button type="button" class="cert-nav" data-dir="1" aria-label="${T('Next page', 'Page suivante')}"${i === doc.pages.length - 1 ? ' disabled' : ''}>›</button>` +
          `<button type="button" class="cert-all" data-all>${T('All pages', 'Toutes les pages')}</button>`
        : '';
    }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-cert-viewer]');
    if (!b || !certs[b.dataset.certViewer]) return;
    if (!dlg) build();
    doc = certs[b.dataset.certViewer]; idx = -1; render();
    dlg.showModal();
  });
})();
