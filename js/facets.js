/* Faceted filtering for the reference catalog, pure functions, no DOM.

   Rule: the options offered by a facet are computed from the references that
   match the search text and every OTHER active facet (the facet's own selection
   is ignored while computing its options). Values within a facet are OR-ed,
   facets are AND-ed. So picking a standard narrows the diameters on offer, and
   picking a diameter first narrows the standards just the same. */
(function (root) {
  const NONE = '__none';

  const LABELS = {
    norme: 'Standard',
    article: 'Product type',
    type: 'Manufacturing',
    d: 'Outside Ø (mm)',
    d1: 'Large-end Ø (mm)',
    d2: 'Small-end Ø (mm)',
    ep: 'Wall thickness',
    nuance: 'Steel grade',
    finition: 'Finish'
  };
  const ORDER = {
    reducers: ['norme', 'article', 'type', 'd1', 'd2', 'ep', 'nuance', 'finition'],
    _default: ['norme', 'article', 'type', 'd', 'ep', 'nuance', 'finition']
  };
  const NUMERIC = { d: 1, d1: 1, d2: 1 };
  // "EN/1" is the code used in the source files; the file name identifies it
  // as EN 10253-1. Shown with both so the original value stays visible.
  const NORME_LABELS = { 'EN/1': 'EN 10253-1 (EN/1)' };

  const frNum = v => String(v).replace('.', ',');

  function valueOf(item, key) {
    const v = item.f ? item.f[key] : undefined;
    return v === null || v === undefined || v === '' ? NONE : String(v);
  }

  function valueLabel(key, v) {
    if (v === NONE) return 'Not specified';
    if (NUMERIC[key]) return frNum(v);
    if (key === 'ep') {
      if (/^[\d.]+\/[\d.]+$/.test(v)) return v.split('/').map(frNum).join(' / ') + ' mm';
      if (/^[\d.]+$/.test(v)) return frNum(v) + ' mm';
      return v;
    }
    if (key === 'norme') return NORME_LABELS[v] || v;
    return v;
  }

  function fold(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function searchText(item) {
    if (!item._q) {
      item._q = fold([item.code, item.designation, item.designationDisplay, item.article,
        item.dimsLabel, item.norme, item.nuance, item.finition, item.finitionRaw, item.type].join(' '));
    }
    return item._q;
  }

  function matchesQuery(item, query) {
    const q = fold(query).trim();
    if (!q) return true;
    const hay = searchText(item);
    // Also match "21.3" against "21,3" and vice versa
    return q.split(/\s+/).every(t => hay.includes(t) || hay.includes(t.replace(/\./g, ',')) || hay.includes(t.replace(/,/g, '.')));
  }

  function matches(item, selection, query, ignoreKey) {
    if (!matchesQuery(item, query)) return false;
    for (const key in selection) {
      if (key === ignoreKey) continue;
      const vals = selection[key];
      if (!vals || !vals.length) continue;
      if (vals.indexOf(valueOf(item, key)) === -1) return false;
    }
    return true;
  }

  function filter(items, selection, query) {
    return items.filter(it => matches(it, selection, query, null));
  }

  function sortValues(key, values) {
    if (NUMERIC[key]) return values.sort((a, b) => (a === NONE) - (b === NONE) || parseFloat(a) - parseFloat(b));
    if (key === 'ep') {
      const rank = v => v === NONE ? [3, 0] : /^[\d.]/.test(v) ? [0, parseFloat(v)] : [1, v === 'STD' ? 0 : v === 'XS' ? 1 : 2];
      return values.sort((a, b) => { const ra = rank(a), rb = rank(b); return ra[0] - rb[0] || ra[1] - rb[1] || String(a).localeCompare(String(b)); });
    }
    return values.sort((a, b) => (a === NONE) - (b === NONE) || a.localeCompare(b, 'fr'));
  }

  /* Facets present for a family: only attributes with at least two distinct
     values in the family (a filter with one choice is noise). */
  function facetKeys(family, items) {
    return (ORDER[family] || ORDER._default).filter(key => {
      const seen = new Set(items.map(it => valueOf(it, key)));
      return seen.size > 1;
    });
  }

  /* Returns [{ key, label, options: [{ value, label, count, selected }] }].
     Options with no compatible reference are dropped, except an option that is
     still selected (so the visitor can always untick it). */
  function compute(items, keys, selection, query) {
    return keys.map(key => {
      const counts = new Map();
      for (const it of items) {
        if (!matches(it, selection, query, key)) continue;
        const v = valueOf(it, key);
        counts.set(v, (counts.get(v) || 0) + 1);
      }
      const selected = selection[key] || [];
      selected.forEach(v => { if (!counts.has(v)) counts.set(v, 0); });
      const values = sortValues(key, Array.from(counts.keys()));
      return {
        key,
        label: LABELS[key] || key,
        options: values.map(v => ({ value: v, label: valueLabel(key, v), count: counts.get(v), selected: selected.indexOf(v) !== -1 }))
      };
    });
  }

  /* URL <-> selection. Repeated params: ?d=21.3&d=26.9&q=… */
  function fromParams(params, keys) {
    const sel = {};
    keys.forEach(k => { const v = params.getAll(k).filter(Boolean); if (v.length) sel[k] = v; });
    return { selection: sel, query: params.get('q') || '', page: Math.max(1, parseInt(params.get('page'), 10) || 1) };
  }
  function toParams(selection, query) {
    const p = new URLSearchParams();
    Object.keys(selection).forEach(k => (selection[k] || []).forEach(v => p.append(k, v)));
    if (query) p.set('q', query);
    return p;
  }

  root.LR_FACETS = { NONE, LABELS, valueOf, valueLabel, matches, matchesQuery, filter, facetKeys, compute, fromParams, toParams, fold };
})(typeof window !== 'undefined' ? window : globalThis);
