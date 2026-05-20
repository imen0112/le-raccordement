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
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
  }

  // Year
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  // Contact / quote form (mailto fallback — replace with real handler later)
  document.addEventListener('submit', function (e) {
    const form = e.target.closest('[data-quote-form]');
    if (!form) return;
    e.preventDefault();
    const data = new FormData(form);
    const cart = JSON.parse(localStorage.getItem('lr_cart_v1') || '[]');
    const lines = cart.map(i => {
      const p = (window.LR_PRODUCTS || []).find(x => x.slug === i.slug);
      return p ? `• ${p.name} × ${i.qty}` : '';
    }).filter(Boolean).join('\n');
    const body = `Name: ${data.get('name')}\nCompany: ${data.get('company') || '—'}\nEmail: ${data.get('email')}\nPhone: ${data.get('phone') || '—'}\nCountry: ${data.get('country') || '—'}\n\nMessage:\n${data.get('message') || '—'}\n\n--- Requested items ---\n${lines || '—'}\n`;
    const subject = encodeURIComponent('Quote request — Le Raccordement');
    window.location.href = `mailto:contact@leraccordement.com?subject=${subject}&body=${encodeURIComponent(body)}`;
  });

  document.addEventListener('submit', function (e) {
    const form = e.target.closest('[data-contact-form]');
    if (!form) return;
    e.preventDefault();
    const data = new FormData(form);
    const body = `Name: ${data.get('name')}\nCompany: ${data.get('company') || '—'}\nEmail: ${data.get('email')}\nPhone: ${data.get('phone') || '—'}\nSubject: ${data.get('subject') || '—'}\n\nMessage:\n${data.get('message') || '—'}\n`;
    const subject = encodeURIComponent(data.get('subject') || 'Contact — Le Raccordement');
    window.location.href = `mailto:contact@leraccordement.com?subject=${subject}&body=${encodeURIComponent(body)}`;
  });
})();
