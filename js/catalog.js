/* Family page: reference list + interdependent filters + add to quote list.
   The page ships a server-rendered table of every reference (crawlable without
   JS); this script loads the family JSON and takes over the list. */
(function () {
  const root = document.querySelector('[data-catalog]');
  if (!root || !window.LR_FACETS) return;
  const F = window.LR_FACETS;
  const family = root.getAttribute('data-catalog');
  const PAGE = 50;
  const BAR = root.getAttribute('data-filter-style') === 'bar';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const els = {
    filters: root.querySelector('[data-catalog-filters]'),
    search: root.querySelector('[data-catalog-search]'),
    sort: root.querySelector('[data-catalog-sort]'),
    count: root.querySelector('[data-catalog-count]'),
    chips: root.querySelector('[data-catalog-chips]'),
    reset: root.querySelectorAll('[data-catalog-reset]'),
    table: root.querySelector('[data-catalog-table]'),
    more: root.querySelector('[data-catalog-more]'),
    details: root.querySelector('[data-catalog-details]'),
    filterCount: root.querySelector('[data-catalog-filter-count]')
  };

  let items = [], keys = [], state = { selection: {}, query: '', sort: 'default', shown: PAGE };

  fetch(root.getAttribute('data-src'), { credentials: 'same-origin' })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(init)
    .catch(err => {
      // The static table stays usable; only filtering is unavailable.
      console.error('Catalog data failed to load', err);
      if (els.filters) els.filters.innerHTML = '<p class="catalog-note">Filters are temporarily unavailable. The full list is shown below.</p>';
    });

  function init(data) {
    items = data.items || [];
    window.LR_REF_INDEX = window.LR_REF_INDEX || {};
    items.forEach((it, i) => { it._i = i; window.LR_REF_INDEX[it.id] = it; });
    keys = F.facetKeys(family, items);
    const p = new URLSearchParams(window.location.search);
    const s = F.fromParams(p, keys);
    state.selection = s.selection;
    state.query = s.query;
    state.sort = p.get('sort') || 'default';
    if (els.search) els.search.value = state.query;
    if (els.sort) els.sort.value = state.sort;
    if (els.details && window.matchMedia('(min-width: 1024px)').matches) els.details.open = true;
    root.classList.add('is-live');
    render(false);
  }

  /* ---------- Rendering ---------- */
  function sorted(list) {
    const dia = it => (it.dims.d != null ? it.dims.d : it.dims.d1) || 0;
    if (state.sort === 'code') return list.slice().sort((a, b) => a.code.localeCompare(b.code));
    if (state.sort === 'd-asc') return list.slice().sort((a, b) => dia(a) - dia(b) || (a.dims.d2 || 0) - (b.dims.d2 || 0) || a._i - b._i);
    if (state.sort === 'd-desc') return list.slice().sort((a, b) => dia(b) - dia(a) || (b.dims.d2 || 0) - (a.dims.d2 || 0) || a._i - b._i);
    return list;
  }

  function rowHtml(it) {
    return `<tr data-ref-row>
      <td data-label="Reference" class="ref-code"><a href="${esc(family)}/${esc(it.slug)}.html">${esc(it.code)}</a></td>
      <td data-label="Designation" class="ref-desig">${esc(it.designationEn)}</td>
      <td data-label="Dimensions" class="ref-dims">${esc(it.dimsLabel)}</td>
      <td data-label="Standard · grade">${esc(it.f.norme)}<span class="ref-sub">${esc(it.nuance)}</span></td>
      <td data-label="Type · finish">${it.typeEn ? `${esc(it.typeEn)}<span class="ref-sub">${esc(it.finitionEn)}</span>` : esc(it.finitionEn)}</td>
      <td data-label="Quantity" class="ref-actions">
        <div class="qty qty-sm"><button type="button" data-qty="dec" aria-label="Decrease">−</button><input type="text" inputmode="numeric" value="50" data-row-qty aria-label="Quantity for ${esc(it.code)}"/><button type="button" data-qty="inc" aria-label="Increase">+</button></div>
        <button type="button" class="btn btn-dark btn-sm" data-add-ref="${esc(it.id)}">Add<span class="sr-only"> ${esc(it.code)} to quote list</span></button>
      </td>
    </tr>`;
  }

  function optionHtml(fc, o) {
    return `
          <label class="facet-opt${o.count === 0 ? ' is-empty' : ''}">
            <input type="checkbox" data-facet="${esc(fc.key)}" value="${esc(o.value)}" ${o.selected ? 'checked' : ''}/>
            <span class="facet-label">${esc(o.label)}</span><span class="facet-count">${o.count}</span>
          </label>`;
  }

  function render(pushUrl) {
    const matched = sorted(F.filter(items, state.selection, state.query));
    const facets = F.compute(items, keys, state.selection, state.query);
    const nActive = Object.values(state.selection).reduce((s, v) => s + v.length, 0);

    // Count
    els.count.innerHTML = matched.length === items.length
      ? `<strong>${items.length}</strong> references`
      : `<strong>${matched.length}</strong> of ${items.length} references`;
    if (els.filterCount) els.filterCount.textContent = nActive ? `(${nActive})` : '';

    // Filters, keep keyboard focus across re-render
    const focused = document.activeElement && document.activeElement.matches && document.activeElement.matches('[data-facet]')
      ? [document.activeElement.getAttribute('data-facet'), document.activeElement.value] : null;
    if (BAR) {
      // Horizontal bar: one dropdown per facet; keep the open one open across re-renders
      const openEl = els.filters.querySelector('details[open]');
      const openKey = openEl ? openEl.getAttribute('data-key') : null;
      els.filters.innerHTML = facets.map(fc => {
        const opts = fc.options;
        const n = (state.selection[fc.key] || []).length;
        return `<details class="fdrop${n ? ' is-active' : ''}" data-key="${esc(fc.key)}"${fc.key === openKey ? ' open' : ''}>
          <summary>${esc(fc.label)}${n ? ` <span class="fdrop-n">${n}</span>` : ''}</summary>
          <fieldset class="fdrop-panel${opts.length > 8 ? ' is-long' : ''}">
            <legend class="sr-only">${esc(fc.label)}</legend>${opts.map(o => optionHtml(fc, o)).join('')}
          </fieldset>
        </details>`;
      }).join('');
    } else {
      // Sidebar: checkbox groups
      els.filters.innerHTML = facets.map(fc => `<fieldset class="facet${fc.options.length > 8 ? ' facet-long' : ''}">
        <legend>${esc(fc.label)}</legend>
        <div class="facet-options">${fc.options.map(o => optionHtml(fc, o)).join('')}</div>
      </fieldset>`).join('');
    }
    if (focused) {
      const back = Array.from(els.filters.querySelectorAll('[data-facet]')).find(x => x.getAttribute('data-facet') === focused[0] && x.value === focused[1]);
      if (back) back.focus();
    }

    // Active filter chips
    const chips = [];
    if (state.query) chips.push(`<button type="button" class="chip" data-chip-q>Search: “${esc(state.query)}” <span aria-hidden="true">×</span><span class="sr-only">remove</span></button>`);
    keys.forEach(k => (state.selection[k] || []).forEach(v => {
      chips.push(`<button type="button" class="chip" data-chip="${esc(k)}" data-value="${esc(v)}">${esc(F.LABELS[k])}: ${esc(F.valueLabel(k, v))} <span aria-hidden="true">×</span><span class="sr-only">remove</span></button>`);
    }));
    els.chips.innerHTML = chips.join('');
    els.reset.forEach(b => { b.hidden = !chips.length; });

    // Table
    const shown = matched.slice(0, state.shown);
    if (!matched.length) {
      els.table.innerHTML = `<div class="catalog-empty"><p><strong>No reference matches this combination.</strong></p><p>Remove a filter or <button type="button" class="link-btn" data-catalog-reset>reset all filters</button>.</p></div>`;
    } else {
      els.table.innerHTML = `<table class="ref-table">
        <caption class="sr-only">${matched.length} references</caption>
        <thead><tr><th scope="col">Reference</th><th scope="col">Designation</th><th scope="col">Dimensions (mm)</th><th scope="col">Standard · grade</th><th scope="col">Type · finish</th><th scope="col">Quantity (min. 50)</th></tr></thead>
        <tbody>${shown.map(rowHtml).join('')}</tbody></table>`;
    }
    const rest = matched.length - shown.length;
    els.more.innerHTML = rest > 0
      ? `<button type="button" class="btn btn-ghost" data-catalog-more-btn>Show ${Math.min(PAGE, rest)} more <span class="text-muted">(${rest} remaining)</span></button>`
      : (matched.length > PAGE ? `<p class="catalog-note">All ${matched.length} references shown.</p>` : '');

    syncUrl(pushUrl);
  }

  function exportList(kind) {
    const list = sorted(F.filter(items, state.selection, state.query));
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    const headers = ['Reference', 'Designation', 'Dimensions (mm)', 'Standard', 'Steel grade', 'Manufacturing', 'Finish', 'Web page'];
    const rows = list.map(it => [it.code, it.designationEn, it.dimsLabel, it.f.norme, it.nuance, it.typeEn || '', it.finitionEn, base + family + '/' + it.slug + '.html']);
    const famName = family.charAt(0).toUpperCase() + family.slice(1);
    const filters = Object.keys(state.selection).map(k => F.LABELS[k] + ': ' + state.selection[k].map(v => F.valueLabel(k, v)).join(', '));
    if (state.query) filters.push('Search: ' + state.query);
    const subtitle = list.length + ' references' + (filters.length ? ' · ' + filters.join(' · ') : ' · no filter');
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === 'xlsx') window.LR_EXPORT.excel(`le-raccordement-${family}-${stamp}.xlsx`, famName, headers, rows, `Le Raccordement · ${famName} · ${subtitle}`);
    else window.LR_EXPORT.print(`${famName}: reference list`, subtitle, headers.slice(0, 7), rows.map(r => r.slice(0, 7)));
  }

  function syncUrl(push) {
    const p = F.toParams(state.selection, state.query);
    if (state.sort !== 'default') p.set('sort', state.sort);
    const qs = p.toString();
    const url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
    if (url !== window.location.pathname + window.location.search + window.location.hash) {
      history[push ? 'pushState' : 'replaceState']({}, '', url);
    }
    // Filtered views share the family page's canonical URL and are not indexed on their own
    let robots = document.querySelector('meta[name="robots"]');
    if (qs) {
      if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots); }
      robots.content = 'noindex, follow';
    } else if (robots) robots.content = 'index, follow';
  }

  /* ---------- Events ---------- */
  root.addEventListener('change', e => {
    const cb = e.target.closest('[data-facet]');
    if (cb) {
      const k = cb.getAttribute('data-facet');
      const cur = new Set(state.selection[k] || []);
      cb.checked ? cur.add(cb.value) : cur.delete(cb.value);
      if (cur.size) state.selection[k] = Array.from(cur); else delete state.selection[k];
      state.shown = PAGE;
      render(true);
      return;
    }
    if (e.target === els.sort) { state.sort = els.sort.value; render(false); }
  });

  let t;
  if (els.search) els.search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.query = els.search.value.trim(); state.shown = PAGE; render(false); }, 150);
  });

  root.addEventListener('click', e => {
    const chip = e.target.closest('[data-chip]');
    if (chip) {
      const k = chip.getAttribute('data-chip'), v = chip.getAttribute('data-value');
      state.selection[k] = (state.selection[k] || []).filter(x => x !== v);
      if (!state.selection[k].length) delete state.selection[k];
      render(true);
      return;
    }
    if (e.target.closest('[data-chip-q]')) { state.query = ''; els.search.value = ''; render(true); return; }
    if (e.target.closest('[data-catalog-reset]')) {
      state.selection = {}; state.query = ''; if (els.search) els.search.value = '';
      state.shown = PAGE; render(true);
      return;
    }
    if (e.target.closest('[data-catalog-more-btn]')) { state.shown += PAGE; render(false); }
    const ex = e.target.closest('[data-export]');
    if (ex && window.LR_EXPORT && items.length) exportList(ex.getAttribute('data-export'));
  });

  if (BAR) {
    // Dropdowns: one open at a time; outside click or Escape closes
    root.addEventListener('toggle', e => {
      const d = e.target;
      if (d.matches && d.matches('details.fdrop') && d.open) {
        els.filters.querySelectorAll('details.fdrop[open]').forEach(x => { if (x !== d) x.open = false; });
      }
    }, true);
    document.addEventListener('click', e => {
      if (!e.target.closest('details.fdrop')) els.filters.querySelectorAll('details.fdrop[open]').forEach(x => { x.open = false; });
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const d = els.filters.querySelector('details.fdrop[open]');
      if (d) { d.open = false; d.querySelector('summary').focus(); }
    });
  }

  window.addEventListener('popstate', () => {
    if (!items.length) return;
    const s = F.fromParams(new URLSearchParams(window.location.search), keys);
    state.selection = s.selection; state.query = s.query; state.shown = PAGE;
    if (els.search) els.search.value = state.query;
    render(false);
  });
})();
