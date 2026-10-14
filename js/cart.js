/* Quote list (cart), localStorage backed, runs on every page.
   No prices: the site collects quote requests, it does not sell online.

   Two kinds of lines:
   - kind 'ref'   : a catalog reference (code + snapshot of its specs)
   - kind 'model' : a product-type page configuration (slug + chosen options) */
(function () {
  const KEY = 'lr_cart_v2';
  const OLD_KEY = 'lr_cart_v1';
  const T = window.LR_T || ((en) => en);
  const ROOT = window.LR_PAGE_ROOT || new URL('..', (document.currentScript && document.currentScript.src) || window.location.href).href;
  const FR = window.LR_LANG === 'fr';
  const MIN_QTY = 50;       // minimum order per reference (pieces)
  const MAX_QTY = 999999;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const state = { items: load() };

  function load() {
    try {
      const v2 = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(v2)) return v2.map(i => Object.assign(i, { qty: clampQty(i.qty) }));
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
    document.dispatchEvent(new CustomEvent('lr:cart-change'));
  }
  function clampQty(q) { return Math.min(MAX_QTY, Math.max(MIN_QTY, parseInt(q, 10) || MIN_QTY)); }

  /* ---------- Mutations ---------- */
  function addRef(rec, qty) {
    if (!rec || !rec.code) return;
    qty = clampQty(qty);
    const key = 'ref:' + rec.id;
    const existing = state.items.find(i => i.key === key);
    if (existing) existing.qty = clampQty(existing.qty + qty);
    else state.items.push({
      key, kind: 'ref', id: rec.id, code: rec.code, slug: rec.slug, family: rec.family,
      // both languages are kept, the list is shown in the language of the page
      designation: rec.designationEn, designationFr: rec.designationDisplay, dims: rec.dimsLabel, dimsFr: rec.dimsLabelFr,
      norme: rec.f ? rec.f.norme : rec.norme, nuance: rec.nuance, finition: rec.finitionEn, finitionFr: rec.finitionFr,
      type: rec.typeEn, typeFr: rec.type, qty
    });
    save();
    const onRefPage = window.location.pathname.indexOf('/' + rec.slug + '.html') !== -1;
    const compatLink = `${ROOT}products/${rec.family}/${rec.slug}.html#compatible`;
    toast(T('Added', 'Ajouté') + ` <strong>${esc(rec.code)}</strong> × ${qty} · <a href="${ROOT}cart.html">${T('View list', 'Voir la liste')} (${count()})</a>` +
      (onRefPage ? '' : ` · <a href="${compatLink}">${T('Compatible fittings', 'Raccords compatibles')}</a>`));
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
    toast(T('Added', 'Ajouté') + ` <strong>${esc(window.LR_PNAME ? window.LR_PNAME(product) : product.name)}</strong> × ${qty}`);
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
      const des = FR ? (i.designationFr || i.designation) : i.designation;
      const dims = FR ? (i.dimsFr || i.dims) : i.dims;
      const type = FR ? (i.typeFr || i.type) : i.type;
      const fin = FR ? (i.finitionFr || i.finition) : i.finition;
      return {
        key: i.key, kind: 'ref', code: i.code, designation: des,
        specs: [dims && ('Ø ' + dims), i.norme, i.nuance, type, fin].filter(Boolean),
        url: `${ROOT}products/${i.family}/${i.slug}.html`, qty: i.qty,
        detail: { family: i.family, dims: dims, norme: i.norme, nuance: i.nuance, type: type, finition: fin, designationFr: i.designationFr, designationEn: i.designation }
      };
    }
    const p = (window.LR_PRODUCTS || []).find(x => x.slug === i.slug);
    const pname = p ? (window.LR_PNAME ? window.LR_PNAME(p) : p.name) : i.slug;
    const opts = i.options ? Object.entries(i.options).map(([k, v]) => `${k}: ${v}`) : [];
    return {
      key: i.key, kind: 'model', code: T('No code', 'Sans code'), designation: pname,
      specs: opts.length ? opts : [T('Configuration to be specified', 'Configuration à préciser')],
      url: `${ROOT}products/product.html?slug=${encodeURIComponent(i.slug)}`, qty: i.qty,
      detail: { productType: pname, options: i.options || null }
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
      b.setAttribute('aria-label', T(c + (c === 1 ? ' reference' : ' references') + ' in your quote list',
        c + (c === 1 ? ' référence' : ' références') + ' dans votre liste de devis'));
    });
  }

  function qtyControl(l) {
    return `<div class="qty qty-sm">
      <button type="button" data-qty="dec" data-key="${esc(l.key)}" aria-label="${T('Decrease quantity of', 'Diminuer la quantité de')} ${esc(l.code)}">−</button>
      <input type="text" inputmode="numeric" value="${l.qty}" data-qty-input data-key="${esc(l.key)}" aria-label="${T('Quantity of', 'Quantité de')} ${esc(l.code)}" />
      <button type="button" data-qty="inc" data-key="${esc(l.key)}" aria-label="${T('Increase quantity of', 'Augmenter la quantité de')} ${esc(l.code)}">+</button>
    </div>`;
  }
  const trash = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';

  function paintDrawer() {
    const list = document.getElementById('cart-drawer-list');
    const sub = document.getElementById('cart-drawer-subtotal');
    if (sub) sub.textContent = `${count()} ${T('ref.', 'réf.')} · ${units()} ${T('pcs', 'pièces')}`;
    if (!list) return;
    if (!state.items.length) {
      list.innerHTML = `<div class="cart-empty">
        <p style="font-family:var(--ff-display);color:var(--c-ink);font-weight:600;margin-bottom:.5rem">${T('Your quote list is empty', 'Votre liste de devis est vide')}</p>
        <p style="font-size:var(--fs-14)">${T('Add references from the catalog to request a quote.', 'Ajoutez des références depuis le catalogue pour demander un devis.')}</p>
        <a href="${ROOT}products/" class="btn btn-dark btn-sm" style="margin-top:1.25rem">${T('Browse products', 'Voir les produits')}</a>
      </div>`;
      return;
    }
    list.innerHTML = lines().map(l => `<div class="cart-item cart-item-noimg">
        <div>
          <div class="cart-item-code">${esc(l.code)}</div>
          <div class="cart-item-name">${esc(l.designation)}</div>
          <div class="cart-item-spec">${esc(l.specs.join(' · '))}</div>
          <div class="cart-item-qty-row">${qtyControl(l)}</div>
        </div>
        <button class="cart-item-remove" type="button" aria-label="${T('Remove', 'Retirer')} ${esc(l.code)}" data-remove data-key="${esc(l.key)}">${trash}</button>
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
        <p style="font-family:var(--ff-display);color:var(--c-ink);font-weight:600;font-size:1.25rem;margin-bottom:.5rem">${T('Your quote list is empty.', 'Votre liste de devis est vide.')}</p>
        <p>${T('Browse the catalog and add references to request a quote.', 'Parcourez le catalogue et ajoutez des références pour demander un devis.')}</p>
        <a href="${ROOT}products/" class="btn btn-primary" style="margin-top:1.5rem">${T('Browse products', 'Voir les produits')}</a>
      </div>`;
      if (formWrap) formWrap.hidden = true;
      return;
    }
    if (formWrap) formWrap.hidden = false;
    list.innerHTML = `<table class="ref-table cart-table">
      <thead><tr><th scope="col">${T('Reference', 'Référence')}</th><th scope="col">${T('Designation', 'Désignation')}</th><th scope="col">${T('Specifications', 'Caractéristiques')}</th><th scope="col">${T('Quantity', 'Quantité')}</th><th scope="col"><span class="sr-only">${T('Remove', 'Retirer')}</span></th></tr></thead>
      <tbody>${lines().map(l => `<tr>
        <td data-label="${T('Reference', 'Référence')}" class="ref-code"><a href="${esc(l.url)}">${esc(l.code)}</a></td>
        <td data-label="${T('Designation', 'Désignation')}"><a class="ref-desig-link" href="${esc(l.url)}">${esc(l.designation)}</a></td>
        <td data-label="${T('Specifications', 'Caractéristiques')}" class="ref-specs">${esc(l.specs.join(' · '))}</td>
        <td data-label="${T('Quantity', 'Quantité')}">${qtyControl(l)}</td>
        <td class="ref-remove"><button class="btn-icon" type="button" data-remove data-key="${esc(l.key)}" aria-label="${T('Remove', 'Retirer')} ${esc(l.code)}">${trash}</button></td>
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
        if (inp) inp.value = clampQty((parseInt(inp.value, 10) || MIN_QTY) + (dir === 'inc' ? 1 : -1));
        return;
      }
      const it = state.items.find(i => i.key === key);
      if (it) setQty(key, it.qty + (dir === 'inc' ? 1 : -1));
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) { remove(rm.getAttribute('data-key')); return; }
    if (e.target.closest('[data-clear-cart]')) {
      if (confirm(T('Clear your quote list?', 'Vider votre liste de devis ?'))) clear();
    }
  });

  // Quantity typed in the cart: apply on change (not on every keystroke, so the field can be emptied while typing)
  document.addEventListener('change', function (e) {
    const inp = e.target.closest('[data-qty-input]');
    if (inp) { setQty(inp.getAttribute('data-key'), inp.value); return; }
    const row = e.target.closest('[data-row-qty], [data-pd-qty]');
    if (row) row.value = clampQty(row.value);
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

  window.LR_CART = { MIN_QTY, addRef, add, remove, setQty, clear, count, units, lines, openDrawer, closeDrawer, toast, ROOT };
})();
