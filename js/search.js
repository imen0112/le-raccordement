/* Reference search, available from the header of every page (magnifier button, or "/" key).
   Searches the four families by code, size, designation (French and English), standard, grade and finish.
   The catalog JSON is loaded on first use only. */
(function () {
  const T = window.LR_T || ((en) => en);
  const FR = window.LR_LANG === 'fr';
  const SITE = window.LR_SITE_ROOT || '';
  const PAGES = window.LR_PAGE_ROOT || '';
  const FAMILIES = ['elbows', 'tees', 'reducers', 'caps'];
  const MAX = 25;
  const FAMILY_WORDS = { elbows: 'elbows coudes', tees: 'tees tés', reducers: 'reducers réductions', caps: 'caps fonds dished ends' };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fold = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let dlg, input, out, all = null, loading = null, timer;

  function load() {
    if (!loading) loading = Promise.all(FAMILIES.map(f => fetch(SITE + 'data/catalog/' + f + '.json?v=' + (window.LR_DATA_V || '')).then(r => r.json())))
      .then(list => {
        all = [].concat(...list.map(d => d.items));
        window.LR_REF_INDEX = window.LR_REF_INDEX || {};
        all.forEach(it => { window.LR_REF_INDEX[it.id] = it; });
      });
    return loading;
  }

  // Normalised text: lower case, no accents, decimal comma → dot, sizes "323,8x7,1" split, punctuation → spaces
  const norm = v => ' ' + fold(v).replace(/(\d),(\d)/g, '$1.$2').replace(/(\d)\s*x\s*(?=\d)/g, '$1 ').replace(/[^a-z0-9.°]+/g, ' ').trim() + ' ';
  function hay(it) {
    if (!it._q) it._q = norm([it.code, it.designationEn, it.articleEn, it.typeEn, it.finitionEn, it.finitionFr, it.f && it.f.norme,
      it.designation, it.designationDisplay, it.article, it.dimsLabel, it.dimsLabelFr, it.norme, it.nuance, it.finition, it.type,
      FAMILY_WORDS[it.family]].join(' '));
    return it._q;
  }
  // Every word typed must match the start of a word: "RE" finds "RE à souder", not "souder"; 21,3 = 21.3
  function matches(it, q) {
    const h = hay(it);
    return norm(q).trim().split(' ').filter(Boolean).every(t => h.includes(' ' + t));
  }
  // Whole-word matches first: "RE 88,9" lists the RE (eccentric) before the "reducers"
  function score(it, q) {
    const h = hay(it);
    return norm(q).trim().split(' ').filter(Boolean).reduce((n, t) => n + (h.includes(' ' + t + ' ') ? 1 : 0), 0);
  }

  function row(it) {
    const x = window.LR_REFTXT ? window.LR_REFTXT(it) : { designation: it.designationEn };
    const url = PAGES + 'products/' + it.family + '/' + it.slug + '.html';
    const fam = window.LR_FAMILY ? window.LR_FAMILY(it.family) : it.family;
    return `<tr data-ref-row>
      <td data-label="${T('Reference', 'Référence')}" class="ref-code"><a href="${url}">${esc(it.code)}</a></td>
      <td data-label="${T('Designation', 'Désignation')}" class="ref-desig"><a class="ref-desig-link" href="${url}">${esc(x.designation)}</a></td>
      <td data-label="${T('Family', 'Famille')}"><a href="${PAGES}products/${it.family}.html">${esc(fam)}</a></td>
      <td data-label="${T('Quantity', 'Quantité')}" class="ref-actions"><div class="qty qty-sm"><button type="button" data-qty="dec" aria-label="${T('Decrease', 'Diminuer')}">−</button><input type="text" inputmode="numeric" value="50" data-row-qty aria-label="${T('Quantity for', 'Quantité pour')} ${esc(it.code)}"/><button type="button" data-qty="inc" aria-label="${T('Increase', 'Augmenter')}">+</button></div>
        <button type="button" class="btn btn-dark btn-sm" data-add-ref="${esc(it.id)}">${T('Add', 'Ajouter')}<span class="sr-only"> ${esc(it.code)} ${T('to quote list', 'à la liste de devis')}</span></button></td>
    </tr>`;
  }

  function run() {
    const q = input.value.trim();
    if (q.length < 2) { out.innerHTML = `<p class="search-hint">${T('Type at least two characters: a reference, a diameter, a product type, a grade…', 'Saisissez au moins deux caractères : une référence, un diamètre, un type de produit, une nuance…')}</p>`; return; }
    out.innerHTML = `<p class="search-hint">${T('Searching…', 'Recherche…')}</p>`;
    load().then(() => {
      if (input.value.trim() !== q) return;
      const hits = all.filter(it => matches(it, q)).map((it, i) => [score(it, q), i, it]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(x => x[2]);
      if (!hits.length) {
        out.innerHTML = `<p class="search-hint">${FR ? `Aucune référence ne correspond à « ${esc(q)} ».` : `No reference matches “${esc(q)}”.`} <a href="${PAGES}products/">${T('Browse the catalog', 'Parcourir le catalogue')} →</a></p>`;
        return;
      }
      const count = FR
        ? `<strong>${hits.length}</strong> référence${hits.length > 1 ? 's' : ''}${hits.length > MAX ? ` (les ${MAX} premières sont affichées, précisez votre recherche)` : ''}`
        : `<strong>${hits.length}</strong> reference${hits.length > 1 ? 's' : ''}${hits.length > MAX ? ` (first ${MAX} shown, refine your search)` : ''}`;
      out.innerHTML = `<p class="search-hint">${count}</p>
        <div class="ref-table-wrap"><table class="ref-table"><thead><tr><th scope="col">${T('Reference', 'Référence')}</th><th scope="col">${T('Designation', 'Désignation')}</th><th scope="col">${T('Family', 'Famille')}</th><th scope="col">${T('Quantity (min. 50)', 'Quantité (min. 50)')}</th></tr></thead>
        <tbody>${hits.slice(0, MAX).map(row).join('')}</tbody></table></div>`;
    }).catch(() => { out.innerHTML = `<p class="search-hint">${T('Search is temporarily unavailable.', 'La recherche est momentanément indisponible.')} <a href="${PAGES}products/">${T('Browse the catalog', 'Parcourir le catalogue')} →</a></p>`; });
  }

  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'search-dialog';
    dlg.setAttribute('aria-label', T('Search a reference', 'Rechercher une référence'));
    dlg.innerHTML = `<div class="search-panel">
      <div class="search-head">
        <label class="filter-search search-field">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" autocomplete="off" placeholder="${T('Reference, size, product… e.g. C3S21N, 60.3, eccentric', 'Référence, dimension, produit… ex. C3S21N, 60,3, RE à souder')}" aria-label="${T('Search a reference', 'Rechercher une référence')}" />
        </label>
        <button type="button" class="search-close" data-close-search aria-label="${T('Close', 'Fermer')}">×</button>
      </div>
      <div class="search-results" aria-live="polite"></div>
    </div>`;
    document.body.appendChild(dlg);
    input = dlg.querySelector('input');
    out = dlg.querySelector('.search-results');
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 160); });
    dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close-search]')) dlg.close(); });
  }

  function open() {
    if (!dlg) build();
    if (!dlg.open) dlg.showModal();
    input.focus();
    input.select();
    run();
    load().catch(() => {});
  }

  document.addEventListener('click', e => { if (e.target.closest('[data-open-search]')) { e.preventDefault(); open(); } });
  document.addEventListener('keydown', e => {
    const t = e.target;
    const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); open(); }
  });
  window.LR_SEARCH = { open };
})();
