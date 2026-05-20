/* Cart — localStorage backed, runs on every page */
(function () {
  const KEY = 'lr_cart_v1';
  const state = {
    items: load()
  };

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(state.items));
    paintBadge();
    paintDrawer();
    paintCartPage();
  }

  function add(slug, qty, options) {
    qty = parseInt(qty, 10) || 1;
    const product = (window.LR_PRODUCTS || []).find(p => p.slug === slug);
    if (!product) return;
    const variant = options ? JSON.stringify(options) : '';
    const existing = state.items.find(i => i.slug === slug && i.variant === variant);
    if (existing) existing.qty += qty;
    else state.items.push({ slug, qty, variant, options: options || null });
    save();
    toast(`Added <strong>${product.name}</strong> × ${qty}`);
  }
  function setQty(slug, variant, qty) {
    const it = state.items.find(i => i.slug === slug && i.variant === (variant || ''));
    if (!it) return;
    it.qty = Math.max(1, parseInt(qty, 10) || 1);
    save();
  }
  function remove(slug, variant) {
    state.items = state.items.filter(i => !(i.slug === slug && i.variant === (variant || '')));
    save();
  }
  function clear() { state.items = []; save(); }
  function count() { return state.items.reduce((s, i) => s + i.qty, 0); }
  function unitPrice(item) {
    const p = (window.LR_PRODUCTS || []).find(x => x.slug === item.slug);
    if (!p) return 0;
    // If item has options + computePrice helper available → variant price
    if (item.options && window.LR_computePrice) {
      return window.LR_computePrice(p, item.options);
    }
    return p.priceFrom || 0;
  }
  function subtotal() {
    return state.items.reduce((s, i) => s + unitPrice(i) * i.qty, 0);
  }
  function fmt(n) {
    return (window.LR_formatPrice ? window.LR_formatPrice(n)
      : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(n));
  }

  /* ---------- Badge ---------- */
  function paintBadge() {
    document.querySelectorAll('.cart-badge').forEach(b => {
      const c = count();
      b.textContent = c;
      b.classList.toggle('is-visible', c > 0);
    });
  }

  /* ---------- Drawer ---------- */
  function openDrawer() {
    const d = document.getElementById('cart-drawer');
    if (!d) return;
    d.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    paintDrawer();
  }
  function closeDrawer() {
    const d = document.getElementById('cart-drawer');
    if (!d) return;
    d.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  function paintDrawer() {
    const list = document.getElementById('cart-drawer-list');
    const subEl = document.getElementById('cart-drawer-subtotal');
    if (!list) return;
    if (state.items.length === 0) {
      list.innerHTML = `<div class="cart-empty">
        <p style="font-family:var(--ff-display);color:var(--c-ink);font-weight:600;margin-bottom:.5rem">Your quote is empty</p>
        <p style="font-size:var(--fs-14)">Add products to request a tailored quote.</p>
        <a href="products/" class="btn btn-dark btn-sm" style="margin-top:1.25rem">Browse products</a>
      </div>`;
      if (subEl) subEl.textContent = fmt(0);
      return;
    }
    list.innerHTML = state.items.map(i => {
      const p = (window.LR_PRODUCTS || []).find(x => x.slug === i.slug);
      if (!p) return '';
      const optBits = i.options ? Object.entries(i.options).map(([k, v]) => `${k}: ${v}`).join(' · ') : '';
      return `<div class="cart-item">
        <div class="cart-item-img"><img src="${p.image}" alt=""></div>
        <div>
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-spec">${optBits || p.categoryLabel}</div>
          <div class="cart-item-qty">
            <button aria-label="Decrease" data-qty="dec" data-slug="${p.slug}" data-variant='${i.variant || ""}'>−</button>
            <span>${i.qty}</span>
            <button aria-label="Increase" data-qty="inc" data-slug="${p.slug}" data-variant='${i.variant || ""}'>+</button>
          </div>
        </div>
        <button class="cart-item-remove" aria-label="Remove" data-remove data-slug="${p.slug}" data-variant='${i.variant || ""}'>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>`;
    }).join('');
    if (subEl) subEl.textContent = fmt(subtotal());
  }

  /* ---------- Cart Page ---------- */
  function paintCartPage() {
    const list = document.getElementById('cart-page-list');
    if (!list) return;
    if (state.items.length === 0) {
      list.innerHTML = `<div class="cart-empty">
        <p style="font-family:var(--ff-display);color:var(--c-ink);font-weight:600;font-size:1.25rem;margin-bottom:.5rem">Your quote list is empty.</p>
        <p>Browse our catalog and add products to request a quote.</p>
        <a href="products/" class="btn btn-primary" style="margin-top:1.5rem">Browse products</a>
      </div>`;
      paintSummary(0, 0);
      const form = document.getElementById('quote-form-wrap');
      if (form) form.style.display = 'none';
      return;
    }
    const form = document.getElementById('quote-form-wrap');
    if (form) form.style.display = '';
    list.innerHTML = state.items.map(i => {
      const p = (window.LR_PRODUCTS || []).find(x => x.slug === i.slug);
      if (!p) return '';
      const optBits = i.options ? Object.entries(i.options).map(([k, v]) => `${k}: ${v}`).join(' · ') : '';
      return `<div class="cart-line">
        <div class="img-box"><img src="${p.image}" alt=""></div>
        <div>
          <div class="name">${p.name}</div>
          <div class="meta">${optBits || p.categoryLabel} · ${fmt(unitPrice(i))} / pc</div>
          <div class="actions" style="margin-top:.75rem">
            <div class="qty">
              <button data-qty="dec" data-slug="${p.slug}" data-variant='${i.variant || ""}' aria-label="Decrease">−</button>
              <input value="${i.qty}" data-qty-input data-slug="${p.slug}" data-variant='${i.variant || ""}' inputmode="numeric" />
              <button data-qty="inc" data-slug="${p.slug}" data-variant='${i.variant || ""}' aria-label="Increase">+</button>
            </div>
            <button class="remove" data-remove data-slug="${p.slug}" data-variant='${i.variant || ""}' aria-label="Remove">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            </button>
          </div>
        </div>
        <div style="font-family:var(--ff-display);font-weight:600;color:var(--c-ink);font-size:1.125rem;text-align:right">
          ${fmt(unitPrice(i) * i.qty)}
          <div style="font-family:var(--ff-mono);font-size:11px;color:var(--c-muted);font-weight:400;text-transform:uppercase;letter-spacing:.06em;margin-top:4px">indicative</div>
        </div>
      </div>`;
    }).join('');
    paintSummary(count(), subtotal());
  }
  function paintSummary(c, s) {
    const cnt = document.getElementById('summary-count');
    const sub = document.getElementById('summary-subtotal');
    const tot = document.getElementById('summary-total');
    if (cnt) cnt.textContent = c;
    if (sub) sub.textContent = fmt(s);
    if (tot) tot.textContent = fmt(s);
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(html) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.innerHTML = `<span class="dot"></span>${html}`;
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-visible'), 2600);
  }

  /* ---------- Global event delegation ---------- */
  document.addEventListener('click', function (e) {
    const addBtn = e.target.closest('[data-add-to-cart]');
    if (addBtn) {
      const slug = addBtn.getAttribute('data-slug');
      const qtyInput = document.querySelector('[data-pd-qty]');
      const qty = qtyInput ? qtyInput.value : 1;
      const options = collectOptions();
      add(slug, qty, options);
      openDrawer();
      return;
    }
    if (e.target.closest('[data-open-cart]')) { e.preventDefault(); openDrawer(); return; }
    if (e.target.closest('[data-close-cart]')) { closeDrawer(); return; }
    const qtyBtn = e.target.closest('[data-qty]');
    if (qtyBtn) {
      const dir = qtyBtn.getAttribute('data-qty');
      const slug = qtyBtn.getAttribute('data-slug');
      const variant = qtyBtn.getAttribute('data-variant') || '';
      // page-detail qty buttons (no slug attr)
      if (!slug) {
        const inp = document.querySelector('[data-pd-qty]');
        if (inp) {
          let v = parseInt(inp.value, 10) || 1;
          v = dir === 'inc' ? v + 1 : Math.max(1, v - 1);
          inp.value = v;
        }
        return;
      }
      const it = state.items.find(i => i.slug === slug && i.variant === variant);
      if (it) setQty(slug, variant, it.qty + (dir === 'inc' ? 1 : -1));
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      remove(rm.getAttribute('data-slug'), rm.getAttribute('data-variant') || '');
      return;
    }
    if (e.target.closest('[data-clear-cart]')) {
      if (confirm('Clear your quote list?')) clear();
    }
  });

  document.addEventListener('input', function (e) {
    const inp = e.target.closest('[data-qty-input]');
    if (!inp) return;
    setQty(inp.getAttribute('data-slug'), inp.getAttribute('data-variant') || '', inp.value);
  });

  function collectOptions() {
    const wrap = document.querySelector('[data-pd-options]');
    if (!wrap) return null;
    const out = {};
    wrap.querySelectorAll('select').forEach(s => {
      if (s.value) out[s.dataset.opt] = s.value;
    });
    return Object.keys(out).length ? out : null;
  }

  /* ---------- Init on page load ---------- */
  function init() {
    paintBadge();
    paintDrawer();
    paintCartPage();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose
  window.LR_CART = { add, remove, setQty, clear, count, subtotal, openDrawer, closeDrawer };
})();
