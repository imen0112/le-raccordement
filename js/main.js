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
    const body = `Name: ${data.get('name')}\nCompany: ${data.get('company') || 'not provided'}\nEmail: ${data.get('email')}\nPhone: ${data.get('phone') || 'not provided'}\nSubject: ${data.get('subject') || 'not provided'}\n\nMessage:\n${data.get('message') || 'not provided'}\n`;
    const subject = encodeURIComponent(data.get('subject') || 'Contact, Le Raccordement');
    window.location.href = `mailto:contact@leraccordement.com?subject=${subject}&body=${encodeURIComponent(body)}`;
  });
})();

/* Lightbox: click (or Enter) on a product or factory photo to see it large */
(function () {
  // Only the factory gallery enlarges; product photos stay as they are
  const SEL = '.mosaic img';
  let dlg;
  function ensure() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.innerHTML = '<button type="button" class="lightbox-close" aria-label="Close">×</button><img alt="" /><p class="lightbox-caption"></p>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('.lightbox-close')) dlg.close(); });
    return dlg;
  }
  function open(img) {
    const d = ensure();
    if (typeof d.showModal !== 'function') { window.open(img.currentSrc || img.src, '_blank'); return; }
    const big = d.querySelector('img');
    big.src = img.currentSrc || img.src;
    big.alt = img.alt || '';
    d.querySelector('.lightbox-caption').textContent = img.alt || '';
    d.showModal();
  }
  function mark() {
    document.querySelectorAll(SEL).forEach(img => {
      if (img.closest('a') || img.dataset.zoomReady) return;
      img.dataset.zoomReady = '1';
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'Enlarge photo' + (img.alt ? ': ' + img.alt : ''));
    });
  }
  document.addEventListener('click', e => {
    const img = e.target.closest(SEL);
    if (img && !img.closest('a') && img.tagName === 'IMG') { e.preventDefault(); open(img); }
  });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches(SEL) && !e.target.closest('a')) { e.preventDefault(); open(e.target); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark); else mark();
  window.addEventListener('load', mark);
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
