/* Quote list (cart), localStorage backed, runs on every page.
   No prices: the site collects quote requests, it does not sell online.

   Two kinds of lines:
   - kind 'ref'   : a catalog reference (code + snapshot of its specs)
   - kind 'model' : a product-type page configuration (slug + chosen options) */
(function () {
  const KEY = 'lr_cart_v2';
  const OLD_KEY = 'lr_cart_v1';
  const ROOT = new URL('..', (document.currentScript && document.currentScript.src) || window.location.href).href;
  const MAX_QTY = 999999;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const state = { items: load() };

  function load() {
    try {
      const v2 = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(v2)) return v2;
      // Migrate the previous format (slug/variant/options)
      const v1 = JSON.parse(localStorage.getItem(OLD_KEY));
      if (Array.isArray(v1)) {
        const items = v1.map(i => ({ key: 'model:' + i.slug + '|' + (i.variant || ''), kind: 'model', slug: i.slug, options: i.options || null, qty: clampQty(i.qty) }));
        localStorage.setItem(KEY, JSON.stringify(items));
        localStorage.removeItem(OLD_KEY);
        return items;
      }
    } catch (e) { /* storage unavailable or corrupt → empty list */ }
    return [];
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state.items)); } catch (e) { /* private mode: list lives for this page only */ }
    paint();
  }
  function clampQty(q) { return Math.min(MAX_QTY, Math.max(1, parseInt(q, 10) || 1)); }

  /* ---------- Mutations ---------- */
  function addRef(rec, qty) {
    if (!rec || !rec.code) return;
    qty = clampQty(qty);
    const key = 'ref:' + rec.id;
    const existing = state.items.find(i => i.key === key);
    if (existing) existing.qty = clampQty(existing.qty + qty);
    else state.items.push({
      key, kind: 'ref', id: rec.id, code: rec.code, slug: rec.slug, family: rec.family,
      designation: rec.designationDisplay, dims: rec.dimsLabel, norme: rec.norme, nuance: rec.nuance,
      finition: rec.finitionRaw || rec.finition, type: rec.type, qty
    });
    save();
    toast(`Added <strong>${esc(rec.code)}</strong> × ${qty} to your quote list · <a href="${ROOT}cart.html">View list (${count()})</a>`);
  }
  function add(slug, qty, options) {   // product-type pages (configurator)
    const product = (window.LR_PRODUCTS || []).find(p => p.slug === slug);
    if (!product) return;
    qty = clampQty(qty);
    const variant = options ? JSON.stringify(options) : '';
    const key = 'model:' + slug + '|' + variant;
    const existing = state.items.find(i => i.key === key);
    if (existing) existing.qty = clampQty(existing.qty + qty);
    else state.items.push({ key, kind: 'model', slug, options: options || null, qty });
    save();
    toast(`Added <strong>${esc(product.name)}</strong> × ${qty}`);
  }
  function setQty(key, qty) {
    const it = state.items.find(i => i.key === key);
    if (!it) return;
    it.qty = clampQty(qty);
    save();
  }
  function remove(key) { state.items = state.items.filter(i => i.key !== key); save(); }
  function clear() { state.items = []; save(); }
  function count() { return state.items.length; }
  function units() { return state.items.reduce((s, i) => s + i.qty, 0); }

  /* Uniform description of a line, used by the drawer, the cart page and the quote request. */
  function describe(i) {
    if (i.kind === 'ref') {
      return {
        key: i.key, kind: 'ref', code: i.code, designation: i.designation,
        specs: [i.dims && ('Ø ' + i.dims), i.norme, i.nuance, i.type, i.finition].filter(Boolean),
        url: `${ROOT}products/${i.family}/${i.slug}.html`, qty: i.qty,
        detail: { family: i.family, dims: i.dims, norme: i.norme, nuance: i.nuance, type: i.type, finition: i.finition }
      };
    }
    const p = (window.LR_PRODUCTS || []).find(x => x.slug === i.slug);
    const opts = i.options ? Object.entries(i.options).map(([k, v]) => `${k}: ${v}`) : [];
    return {
      key: i.key, kind: 'model', code: 'No code', designation: p ? p.name : i.slug,
      specs: opts.length ? opts : ['Configuration to be specified'],
      url: `${ROOT}products/product.html?slug=${encodeURIComponent(i.slug)}`, qty: i.qty,
      detail: { productType: p ? p.name : i.slug, options: i.options || null }
    };
  }
  function lines() { return state.items.map(describe); }

  /* ---------- Painting ---------- */
  function paint() { paintBadge(); paintDrawer(); paintCartPage(); }

  function paintBadge() {
    document.querySelectorAll('.cart-badge').forEach(b => {
      const c = count();
      b.textContent = c;
      b.classList.toggle('is-visible', c > 0);
      b.setAttribute('aria-label', c + (c === 1 ? ' reference' : ' references') + ' in your quote list');
    });
  }

  function qtyControl(l) {
    return `<div class="qty qty-sm">
      <button type="button" data-qty="dec" data-key="${esc(l.key)}" aria-label="Decrease quantity of ${esc(l.code)}">−</button>
      <input type="text" inputmode="numeric" value="${l.qty}" data-qty-input data-key="${esc(l.key)}" aria-label="Quantity of ${esc(l.code)}" />
      <button type="button" data-qty="inc" data-key="${esc(l.key)}" aria-label="Increase quantity of ${esc(l.code)}">+</button>
    </div>`;
  }
  const trash = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';

  function paintDrawer() {
    const list = document.getElementById('cart-drawer-list');
    const sub = document.getElementById('cart-drawer-subtotal');
    if (sub) sub.textContent = `${count()} ref. · ${units()} pcs`;
    if (!list) return;
    if (!state.items.length) {
      list.innerHTML = `<div class="cart-empty">
        <p style="font-family:var(--ff-display);color:var(--c-ink);font-weight:600;margin-bottom:.5rem">Your quote list is empty</p>
        <p style="font-size:var(--fs-14)">Add references from the catalog to request a quote.</p>
        <a href="${ROOT}products/" class="btn btn-dark btn-sm" style="margin-top:1.25rem">Browse products</a>
      </div>`;
      return;
    }
    list.innerHTML = lines().map(l => `<div class="cart-item cart-item-noimg">
        <div>
          <div class="cart-item-code">${esc(l.code)}</div>
          <div class="cart-item-name" lang="fr">${esc(l.designation)}</div>
          <div class="cart-item-spec">${esc(l.specs.join(' · '))}</div>
          <div class="cart-item-qty-row">${qtyControl(l)}</div>
        </div>
        <button class="cart-item-remove" type="button" aria-label="Remove ${esc(l.code)}" data-remove data-key="${esc(l.key)}">${trash}</button>
      </div>`).join('');
  }

  function paintCartPage() {
    const list = document.getElementById('cart-page-list');
    if (!list) return;
    const formWrap = document.getElementById('quote-form-wrap');
    const cnt = document.getElementById('summary-count');
    const un = document.getElementById('summary-units');
    if (cnt) cnt.textContent = count();
    if (un) un.textContent = units();
    if (!state.items.length) {
      list.innerHTML = `<div class="cart-empty">
        <p style="font-family:var(--ff-display);color:var(--c-ink);font-weight:600;font-size:1.25rem;margin-bottom:.5rem">Your quote list is empty.</p>
        <p>Browse the catalog and add references to request a quote.</p>
        <a href="${ROOT}products/" class="btn btn-primary" style="margin-top:1.5rem">Browse products</a>
      </div>`;
      if (formWrap) formWrap.hidden = true;
      return;
    }
    if (formWrap) formWrap.hidden = false;
    list.innerHTML = `<table class="ref-table cart-table">
      <thead><tr><th scope="col">Reference</th><th scope="col">Designation</th><th scope="col">Specifications</th><th scope="col">Quantity</th><th scope="col"><span class="sr-only">Remove</span></th></tr></thead>
      <tbody>${lines().map(l => `<tr>
        <td data-label="Reference" class="ref-code"><a href="${esc(l.url)}">${esc(l.code)}</a></td>
        <td data-label="Designation" lang="fr">${esc(l.designation)}</td>
        <td data-label="Specifications" class="ref-specs">${esc(l.specs.join(' · '))}</td>
        <td data-label="Quantity">${qtyControl(l)}</td>
        <td class="ref-remove"><button class="btn-icon" type="button" data-remove data-key="${esc(l.key)}" aria-label="Remove ${esc(l.code)}">${trash}</button></td>
      </tr>`).join('')}</tbody></table>`;
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

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(html) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      document.body.appendChild(t);
    }
    t.innerHTML = `<span class="dot"></span><span>${html}</span>`;
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-visible'), 4000);
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', function (e) {
    const refBtn = e.target.closest('[data-add-ref]');
    if (refBtn) {
      const rec = (window.LR_REF_INDEX || {})[refBtn.getAttribute('data-add-ref')];
      const scope = refBtn.closest('[data-ref-row]') || document;
      const inp = scope.querySelector('[data-row-qty]');
      addRef(rec, inp ? inp.value : 1);
      if (refBtn.hasAttribute('data-then-cart')) window.location.href = ROOT + 'cart.html';
      return;
    }
    const addBtn = e.target.closest('[data-add-to-cart]');
    if (addBtn) {
      const qtyInput = document.querySelector('[data-pd-qty]');
      add(addBtn.getAttribute('data-slug'), qtyInput ? qtyInput.value : 1, collectOptions());
      openDrawer();
      return;
    }
    if (e.target.closest('[data-open-cart]')) { e.preventDefault(); openDrawer(); return; }
    if (e.target.closest('[data-close-cart]')) { closeDrawer(); return; }
    const qtyBtn = e.target.closest('[data-qty]');
    if (qtyBtn) {
      const dir = qtyBtn.getAttribute('data-qty');
      const key = qtyBtn.getAttribute('data-key');
      if (!key) {   // standalone quantity steppers (product pages, catalog rows)
        const wrap = qtyBtn.closest('.qty');
        const inp = (wrap && wrap.querySelector('input')) || document.querySelector('[data-pd-qty]');
        if (inp) inp.value = clampQty((parseInt(inp.value, 10) || 1) + (dir === 'inc' ? 1 : -1));
        return;
      }
      const it = state.items.find(i => i.key === key);
      if (it) setQty(key, it.qty + (dir === 'inc' ? 1 : -1));
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) { remove(rm.getAttribute('data-key')); return; }
    if (e.target.closest('[data-clear-cart]')) {
      if (confirm('Clear your quote list?')) clear();
    }
  });

  // Quantity typed in the cart: apply on change (not on every keystroke, so the field can be emptied while typing)
  document.addEventListener('change', function (e) {
    const inp = e.target.closest('[data-qty-input]');
    if (inp) setQty(inp.getAttribute('data-key'), inp.value);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });
  // Keep tabs in sync
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { state.items = load(); paint(); }
  });

  function collectOptions() {
    const wrap = document.querySelector('[data-pd-options]');
    if (!wrap) return null;
    const out = {};
    wrap.querySelectorAll('select').forEach(s => { if (s.value) out[s.dataset.opt] = s.value; });
    return Object.keys(out).length ? out : null;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint);
  else paint();

  window.LR_CART = { addRef, add, remove, setQty, clear, count, units, lines, openDrawer, closeDrawer, toast, ROOT };
})();
