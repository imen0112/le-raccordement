/* Browser test-suite for the catalog data, the facet engine and the quote list. */
(async function () {
  const F = window.LR_FACETS;
  const results = [];
  const ok = (name, cond, detail) => results.push({ name, pass: !!cond, detail: cond ? '' : (detail || '') });
  const families = ['elbows', 'tees', 'reducers', 'caps'];
  const index = await fetch('../data/catalog/index.json').then(r => r.json());
  const data = {};
  for (const f of families) data[f] = await fetch(`../data/catalog/${f}.json`).then(r => r.json());

  /* ---------- Data ---------- */
  ok('4 families in index', index.families.map(f => f.slug).join() === families.join());
  let total = 0;
  for (const f of families) {
    const d = data[f], idx = index.families.find(x => x.slug === f);
    total += d.items.length;
    ok(`${f}: count matches index (${d.items.length})`, d.count === d.items.length && idx.count === d.items.length);
    ok(`${f}: every item in family`, d.items.every(it => it.family === f));
    ok(`${f}: unique ids & slugs`, new Set(d.items.map(i => i.id)).size === d.items.length && new Set(d.items.map(i => i.slug)).size === d.items.length);
    ok(`${f}: every item has code, designation, norme, nuance, finition`, d.items.every(it => it.code && it.designation && it.norme && it.nuance && it.finition));
    ok(`${f}: STD/XS never turned into numbers`, d.items.every(it => it.epRaw !== 'STD' && it.epRaw !== 'XS' || (it.dims.sch === it.epRaw)));
    ok(`${f}: no client-specific codes published`, d.items.every(it => !/\.0\d$/.test(it.code)));
  }
  ok('558 references in total', total === 558, total);

  // Spot checks against the Excel files (values read from the sheets)
  const all = [].concat(...families.map(f => data[f].items));
  const by = c => all.find(i => i.code === c);
  ok('C3S21N = Coude 90° 3D 21,3 × 2 S235 EN/1 Noir, sans soudure', (() => { const r = by('C3S21N'); return r && r.dims.d === 21.3 && r.dims.t === 2 && r.nuance === 'S235' && r.norme === 'EN/1' && r.finition === 'Noir' && r.type === 'Sans soudure' && r.family === 'elbows'; })());
  ok('R2W219114G = RC Forme 2 219,1/6,3 × 114,3/3,6, soudé, galv.', (() => { const r = by('R2W219114G'); return r && r.dims.d1 === 219.1 && r.dims.t1 === 6.3 && r.dims.d2 === 114.3 && r.dims.t2 === 3.6 && r.type === 'Soudé' && r.finitionRaw === 'Galv.' && r.family === 'reducers'; })());
  ok('C1219XSP = Caps 219,1 XS A234WPB ASME B16.9 Peint (exact duplicate published once)', (() => { const r = all.filter(i => i.code === 'C1219XSP'); return r.length === 1 && r[0].dims.d === 219.1 && r[0].dims.sch === 'XS' && r[0].family === 'caps'; })());
  ok('RCS3326STDP keeps its original D text', by('RCS3326STDP') && by('RCS3326STDP').dRaw === '33,4x26,7' && by('RCS3326STDP').dims.d1 === 33.4);
  ok('Peinte kept as raw value, grouped as Peint', all.filter(i => i.finitionRaw === 'Peinte').length === 108 && all.filter(i => i.finitionRaw === 'Peinte').every(i => i.finition === 'Peint'));
  ok('Designation kept verbatim (incl. original spacing)', by('C3S21N').designation === 'Coude à souder  90° 3D _21,3x2_S235 _EN/1 _Noir ');
  ok('English designation built from the glossary', by('C3S21N').designationEn === 'Butt-weld elbow 90° 3D, Ø21.3 × 2 mm, S235, seamless, EN 10253-1, black');
  ok('Every reference has English article, finish and designation', all.every(i => i.articleEn && i.finitionEn && i.designationEn && !/[àéè]/.test(i.designationEn)));
  ok('English facet values (no French in filters)', all.every(i => !/souder|Soudé|Sans soudure|Noir|Peint|Galv\.$/.test([i.f.article, i.f.type, i.f.finition].join(' '))));

  /* ---------- Facets: brute-force consistency ---------- */
  let seed = 42;
  const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  let checked = 0, failures = [];
  for (const f of families) {
    const items = data[f].items;
    const keys = F.facetKeys(f, items);
    ok(`${f}: facets shown = attributes with ≥2 values (${keys.join(', ')})`, keys.every(k => new Set(items.map(i => F.valueOf(i, k))).size > 1));
    for (let round = 0; round < 250; round++) {
      // Build a random selection by walking the facets the way a visitor would
      let sel = {};
      const steps = rnd(4);
      for (let s = 0; s < steps; s++) {
        const facets = F.compute(items, keys, sel, '');
        const fc = facets[rnd(facets.length)];
        const avail = fc.options.filter(o => o.count > 0 && !o.selected);
        if (!avail.length) continue;
        const pick = avail[rnd(avail.length)].value;
        sel = Object.assign({}, sel, { [fc.key]: (sel[fc.key] || []).concat(pick) });
      }
      const res = F.filter(items, sel, '');
      // 1. results honour every facet (OR inside, AND across)
      const bad = res.find(it => Object.keys(sel).some(k => sel[k].indexOf(F.valueOf(it, k)) === -1));
      if (bad) failures.push(['result outside selection', f, JSON.stringify(sel), bad.code]);
      // 2. no reference wrongly excluded
      const expected = items.filter(it => Object.keys(sel).every(k => sel[k].indexOf(F.valueOf(it, k)) !== -1));
      if (expected.length !== res.length) failures.push(['wrong result count', f, JSON.stringify(sel), res.length, expected.length]);
      // 3. walking forward never produces an empty result
      if (!res.length) failures.push(['empty result reached by picking offered options', f, JSON.stringify(sel)]);
      // 4. each option count = size of the result if that value were added
      for (const fc of F.compute(items, keys, sel, '')) {
        const others = Object.assign({}, sel); delete others[fc.key];
        const base = items.filter(it => Object.keys(others).every(k => others[k].indexOf(F.valueOf(it, k)) !== -1));
        const truth = new Map();
        base.forEach(it => { const v = F.valueOf(it, fc.key); truth.set(v, (truth.get(v) || 0) + 1); });
        for (const o of fc.options) {
          if ((truth.get(o.value) || 0) !== o.count) failures.push(['option count', f, fc.key, o.value, o.count, truth.get(o.value)]);
          if (o.count === 0 && !o.selected) failures.push(['zero option offered', f, fc.key, o.value]);
        }
        for (const v of truth.keys()) if (!fc.options.some(o => o.value === v)) failures.push(['compatible option hidden', f, fc.key, v]);
        checked++;
      }
    }
  }
  ok(`Facet engine: ${checked} facet computations verified against brute force`, failures.length === 0, JSON.stringify(failures.slice(0, 5)));

  // Bidirectional example (elbows): diameter first restricts the standards, standard first restricts the diameters
  {
    const items = data.elbows.items, keys = F.facetKeys('elbows', items);
    const normes = F.compute(items, keys, { d: ['26.9'] }, '').find(x => x.key === 'norme').options.map(o => o.value);
    ok('Elbows: Ø 26.9 selected → only EN 10253-1 offered as standard', normes.join() === 'EN 10253-1', normes);
    const ds = F.compute(items, keys, { norme: ['ASME B16.9'] }, '').find(x => x.key === 'd').options.map(o => o.value);
    ok('Elbows: ASME B16.9 selected → Ø 26.9 / 33.7 / 76.1 no longer offered', ['26.9', '33.7', '76.1'].every(v => ds.indexOf(v) === -1) && ds.indexOf('26.7') !== -1);
    const sel = { norme: ['ASME B16.9'] };
    const normeOpts = F.compute(items, keys, sel, '').find(x => x.key === 'norme').options.map(o => o.value);
    ok('Elbows: a facet keeps its own alternatives (multi-select)', normeOpts.length === 2);
  }
  // Missing values
  {
    const caps = data.caps.items;
    ok('Caps: "Type" is empty in the source → no Manufacturing filter, no crash', F.facetKeys('caps', caps).indexOf('type') === -1 && caps.every(i => F.valueOf(i, 'type') === F.NONE));
    const r = F.compute([{ f: { a: null } }, { f: { a: 'x' } }], ['a'], {}, '');
    ok('Missing value becomes "Not specified" option', r[0].options.some(o => o.value === F.NONE && o.label === 'Not specified'));
  }
  // Search
  {
    const el = data.elbows.items;
    ok('Search by code', F.filter(el, {}, 'c3s21n').length === 1);
    ok('Search "60,3" = search "60.3"', F.filter(el, {}, '60,3').length === F.filter(el, {}, '60.3').length && F.filter(el, {}, '60,3').length > 0);
    ok('Search is accent-insensitive', F.filter(el, {}, 'soude').length === F.filter(el, {}, 'soudé').length);
    ok('Search + facet combine', F.filter(el, { norme: ['ASME B16.9'] }, 'XS').every(i => i.norme === 'ASME B16.9' && i.epRaw === 'XS'));
  }
  // URL round-trip
  {
    const keys = F.facetKeys('elbows', data.elbows.items);
    const p = F.toParams({ norme: ['ASME B16.9'], d: ['21.3', '60.3'] }, 'xs');
    const back = F.fromParams(new URLSearchParams(p.toString()), keys);
    ok('URL round-trip', JSON.stringify(back.selection) === JSON.stringify({ norme: ['ASME B16.9'], d: ['21.3', '60.3'] }) && back.query === 'xs');
    const junk = F.fromParams(new URLSearchParams('evil=1&d=21.3'), keys);
    ok('Unknown URL params ignored', !('evil' in junk.selection));
  }

  /* ---------- Quote list ---------- */
  {
    const C = window.LR_CART;
    const saved = localStorage.getItem('lr_cart_v2');
    C.clear();
    const r1 = by('C3S21N'), r2 = by('R2W219114G');
    C.addRef(r1, 5); C.addRef(r1, 3); C.addRef(r2, '12');
    let l = C.lines();
    ok('Cart: quantities below 50 are raised to the minimum, same reference merges', l.length === 2 && l[0].qty === 100 && l[1].qty === 50);
    ok('Cart: line carries code, English designation, specs', l[0].code === 'C3S21N' && l[0].designation === r1.designationEn && l[0].specs.indexOf('EN 10253-1') !== -1);
    C.setQty(l[1].key, 0);
    ok('Cart: quantity never below 50', C.lines()[1].qty === 50);
    C.setQty(l[1].key, 'abc');
    ok('Cart: invalid quantity → 50', C.lines()[1].qty === 50);
    C.remove(l[0].key);
    ok('Cart: remove line', C.lines().length === 1 && C.lines()[0].code === 'R2W219114G');
    ok('Cart: count = references, units = pieces', C.count() === 1 && C.units() === 50);
    C.add('elbow-90-3d', 4, { Size: 'DN 50' });
    ok('Cart: product-type lines still supported (min. 50)', C.lines().some(x => x.kind === 'model' && x.qty === 50));
    ok('Cart: persisted in localStorage', JSON.parse(localStorage.getItem('lr_cart_v2')).length === 2);
    C.clear();
    if (saved) localStorage.setItem('lr_cart_v2', saved); else localStorage.removeItem('lr_cart_v2');
  }

  /* ---------- Report ---------- */
  const failed = results.filter(r => !r.pass);
  window.TEST_RESULTS = { total: results.length, failed: failed.length, failures: failed };
  document.getElementById('out').innerHTML = `<p><strong>${results.length - failed.length}/${results.length} passed</strong></p>` +
    results.map(r => `<div class="${r.pass ? 'pass' : 'fail'}">${r.pass ? '✓' : '✗'} ${r.name}${r.detail ? ' : <pre>' + String(r.detail).replace(/</g, '&lt;') + '</pre>' : ''}</div>`).join('');
})().catch(e => { window.TEST_RESULTS = { error: String(e && e.stack || e) }; document.getElementById('out').textContent = 'ERROR ' + e; });
