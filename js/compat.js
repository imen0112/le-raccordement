/* Quote list: suggest the fittings that go on the same pipes as the references already in the list.
   Same rule as the reference pages (tools/catalog/build_pages.py, compatible()): same standard, grade
   and finish, an end with the same outside diameter, same wall (EN) or schedule (ASME). */
(function () {
  const box = document.getElementById('cart-compat');
  if (!box || !window.LR_CART) return;
  const ROOT = window.LR_CART.ROOT;
  const FAMILIES = ['elbows', 'tees', 'reducers', 'caps'];
  const PER_GROUP = 8;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let all = null, loading = null;

  function load() {
    if (!loading) loading = Promise.all(FAMILIES.map(f => fetch(ROOT + 'data/catalog/' + f + '.json').then(r => r.json())))
      .then(list => {
        all = [].concat(...list.map(d => d.items));
        window.LR_REF_INDEX = window.LR_REF_INDEX || {};
        all.forEach(it => { window.LR_REF_INDEX[it.id] = it; });
      });
    return loading;
  }

  function compatible(it) {
    const d = it.dims, ods = 'd' in d ? [d.d] : [d.d1, d.d2], wall = 'd' in d ? d.t : undefined;
    return all.filter(x => {
      if (x.id === it.id || x.norme !== it.norme || x.nuance !== it.nuance || x.finition !== it.finition) return false;
      const xd = x.dims;
      if ('d' in xd) {
        if (ods.indexOf(xd.d) === -1) return false;
        if (wall !== undefined && xd.t !== undefined && xd.t !== wall) return false;
        if (d.sch && xd.sch && xd.sch !== d.sch) return false;
      } else {
        if (ods.indexOf(xd.d1) === -1 && ods.indexOf(xd.d2) === -1) return false;
        if (d.sch && xd.sch && xd.sch !== d.sch) return false;
      }
      return !(x.family === it.family && x.article === it.article);
    }).sort((a, b) => FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family) || a.articleEn.localeCompare(b.articleEn));
  }

  function row(x) {
    return `<tr data-ref-row>
      <td data-label="Reference" class="ref-code"><a href="${ROOT}products/${x.family}/${x.slug}.html">${esc(x.code)}</a></td>
      <td data-label="Designation" class="ref-desig">${esc(x.designationEn)}</td>
      <td data-label="Quantity" class="ref-actions"><div class="qty qty-sm"><button type="button" data-qty="dec" aria-label="Decrease">−</button><input type="text" inputmode="numeric" value="50" data-row-qty aria-label="Quantity for ${esc(x.code)}"/><button type="button" data-qty="inc" aria-label="Increase">+</button></div>
        <button type="button" class="btn btn-dark btn-sm" data-add-ref="${esc(x.id)}">Add<span class="sr-only"> ${esc(x.code)} to quote list</span></button></td>
    </tr>`;
  }

  function render() {
    const lines = window.LR_CART.lines().filter(l => l.kind === 'ref');
    if (!lines.length) { box.innerHTML = ''; return; }
    load().then(() => {
      const inCart = new Set(window.LR_CART.lines().map(l => l.code));
      const groups = lines.map(l => {
        const it = all.find(x => x.code === l.code);
        if (!it) return '';
        const list = compatible(it).filter(x => !inCart.has(x.code));
        if (!list.length) return '';
        const more = list.length > PER_GROUP
          ? `<a class="ref-compat-link" href="${ROOT}products/${it.family}/${it.slug}.html#compatible">See all ${list.length} →</a>` : '';
        return `<div class="cart-compat-group">
          <h3 class="cart-compat-title">For <span class="mono">${esc(it.code)}</span> <span class="text-muted">${esc(it.designationEn)}</span></h3>
          <div class="ref-table-wrap"><table class="ref-table"><thead><tr><th scope="col">Reference</th><th scope="col">Designation</th><th scope="col">Quantity (min. 50)</th></tr></thead>
          <tbody>${list.slice(0, PER_GROUP).map(row).join('')}</tbody></table></div>${more}
        </div>`;
      }).filter(Boolean);
      box.innerHTML = groups.length ? `<section class="cart-compat" aria-labelledby="cart-compat-h">
        <h2 class="h-3" id="cart-compat-h">Compatible fittings for your references</h2>
        <p class="catalog-note mt-2">Same pipe, same standard, grade and finish as the references in your list. Add what you need to complete the line.</p>
        ${groups.join('')}</section>` : '';
    }).catch(() => { box.innerHTML = ''; });
  }

  document.addEventListener('lr:cart-change', render);
  render();
})();
