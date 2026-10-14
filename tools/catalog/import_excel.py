#!/usr/bin/env python3
"""Import the official Excel product files into the website catalog.

Usage:
    python3 tools/catalog/import_excel.py \
        --en "/path/ARTICLES EN10253-1.xlsx" \
        --asme "/path/CODE ARTICLES ASME SANS SOUDURE PEINTE.xlsx" \
        --report-dir "/path/outside/the/repo"

Outputs
  data/catalog/<family>.json      public data used by the site (no client codes,
                                  no internal ERP codes)
  <report-dir>/catalog-full.json  every source row, nothing dropped (private)
  <report-dir>/rapport-qualite-donnees.md   data-quality report (private)

Nothing in the Excel files is modified. Requires: openpyxl.
"""
import argparse
import collections
import datetime
import json
import os
import re
import sys

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, 'data', 'catalog')

FAMILIES = {
    'elbows':   {'name': 'Elbows',   'nameFr': 'Coudes'},
    'tees':     {'name': 'Tees',     'nameFr': 'Tés'},
    'reducers': {'name': 'Reducers', 'nameFr': 'Réductions'},
    'caps':     {'name': 'Caps',     'nameFr': 'Caps & fonds'},
}

# Article (column "Article") → family. Matched on the normalised article prefix.
ARTICLE_FAMILY = [
    ('Coude', 'elbows'),
    ('Té', 'tees'),
    ('RC ', 'reducers'),
    ('RE ', 'reducers'),
    ('Caps', 'caps'),
    ('Fond', 'caps'),
]

# Display/filter normalisation of finishes. The original value is always kept
# in `finitionRaw`. "Peinte" is the feminine agreement of "Peint" (used for
# "réduction"), so both describe the same painted finish.
FINITION_NORMALISE = {'Peinte': 'Peint'}


def clean(v):
    """Trim and collapse internal whitespace; keep None for empty cells."""
    if v is None:
        return None
    if isinstance(v, str):
        s = re.sub(r'\s+', ' ', v).strip()
        return s or None
    return v


def num(s):
    """'21,3' / 21.3 / '73,0' → 21.3 (float) — raises on anything else."""
    if isinstance(s, (int, float)):
        return float(s)
    return float(str(s).strip().replace(',', '.'))


def key(n):
    """Canonical string key for a number: 21.3 → '21.3', 73.0 → '73'."""
    return ('%g' % n) if n is not None else None


def fr(n):
    """French display: 21.3 → '21,3'."""
    return key(n).replace('.', ',') if n is not None else None


def family_of(article):
    for prefix, fam in ARTICLE_FAMILY:
        if article.startswith(prefix):
            return fam
    return None


def designation_display(raw):
    """ERP designation 'Coude à souder  90° 3D _21,3x2_S235 _EN/1 _Noir ' →
    'Coude à souder 90° 3D 21,3x2 S235 EN/1 Noir'.
    Only separators/whitespace change; every token is kept."""
    parts = [re.sub(r'\s+', ' ', p).strip() for p in raw.split('_')]
    return ' '.join(p for p in parts if p)


def read_sheet(path, sheet):
    ws = openpyxl.load_workbook(path, data_only=True)[sheet]
    rows = list(ws.iter_rows(values_only=True))
    hdr_i = next(i for i, r in enumerate(rows) if r and any(isinstance(c, str) and c.strip() == 'Article' for c in r))
    header = [clean(c) for c in rows[hdr_i]]
    out, empty = [], 0
    for i, r in enumerate(rows[hdr_i + 1:], start=hdr_i + 2):
        if not any(c not in (None, '') for c in r):
            empty += 1
            continue
        out.append((i, dict(zip(header, r))))
    return {'header': header, 'headerRow': hdr_i + 1, 'rows': out, 'emptyRows': empty,
            'blankBeforeHeader': hdr_i, 'maxRow': ws.max_row}


def parse_dims(fam, d_raw, ep_raw, standard_kind, issues, ref):
    """Return (dims, facet values). Never approximates: values come straight
    from the D / Ep columns."""
    dims, f = {}, {}
    try:
        if fam == 'reducers':
            if standard_kind == 'EN':
                # D = 'Ø1/t1' (large end), Ep = 'Ø2/t2' (small end)
                d1, t1 = [num(x) for x in str(d_raw).split('/')]
                d2, t2 = [num(x) for x in str(ep_raw).split('/')]
                dims = {'d1': d1, 't1': t1, 'd2': d2, 't2': t2}
                f = {'d1': key(d1), 'd2': key(d2), 'ep': '%s/%s' % (key(t1), key(t2))}
            else:
                # D = 'Ø1 x Ø2', Ep = schedule (STD / XS)
                d1, d2 = [num(x) for x in re.split(r'\s*x\s*', str(d_raw).strip())]
                dims = {'d1': d1, 'd2': d2, 'sch': clean(ep_raw)}
                f = {'d1': key(d1), 'd2': key(d2), 'ep': clean(ep_raw)}
        else:
            d = num(d_raw)
            if isinstance(ep_raw, str) and not re.match(r'^[\d.,]+$', ep_raw.strip()):
                dims = {'d': d, 'sch': clean(ep_raw)}
                f = {'d': key(d), 'ep': clean(ep_raw)}
            else:
                t = num(ep_raw)
                dims = {'d': d, 't': t}
                f = {'d': key(d), 'ep': key(t)}
    except Exception as e:  # noqa: BLE001 — reported, never silently dropped
        issues.append(('Format dimension illisible', ref, 'D=%r Ep=%r (%s)' % (d_raw, ep_raw, e)))
    return dims, f


def dims_label(dims, n=fr):
    if 'd1' in dims:
        if 't1' in dims:
            return '%s×%s / %s×%s' % (n(dims['d1']), n(dims['t1']), n(dims['d2']), n(dims['t2']))
        return '%s × %s %s' % (n(dims['d1']), n(dims['d2']), dims.get('sch') or '')
    if 'sch' in dims:
        return '%s %s' % (n(dims['d']), dims['sch'])
    if dims:
        return '%s×%s' % (n(dims['d']), n(dims['t']))
    return ''


# ---- English display (fixed glossary, no machine translation). The French
# originals stay in article / type / finitionRaw / designation for the French pages.
ARTICLE_EN = [
    (r'^Coude à souder (\d+°) ([\d.]+D)$', r'Butt-weld elbow \1 \2'),
    (r'^Té égal à souder$', 'Butt-weld equal tee'),
    (r'^RC à souder Forme (\d)$', r'Butt-weld concentric reducer, Form \1'),
    (r'^RC à souder$', 'Butt-weld concentric reducer'),
    (r'^RE à souder$', 'Butt-weld eccentric reducer'),
    (r'^Caps à souder$', 'Butt-weld cap'),
    (r'^Fond à souder$', 'Butt-weld dished end'),
]
TYPE_EN = {'Sans soudure': 'Seamless', 'Soudé': 'Welded'}
FINISH_EN = {'Noir': 'Black', 'Galv.': 'Galvanized', 'Peint': 'Painted', 'Peinte': 'Painted'}
FINISH_FR = {'Noir': 'Noir', 'Galv.': 'Galvanisé', 'Peint': 'Peint', 'Peinte': 'Peint'}
NORME_EN = {'EN/1': 'EN 10253-1'}


def article_en(article):
    for pat, rep in ARTICLE_EN:
        if re.match(pat, article):
            return re.sub(pat, rep, article)
    raise SystemExit('No English label for article %r: add it to ARTICLE_EN' % article)


def designation_en(rec):
    d = rec['dims']
    if 'd1' in d:
        size = ('%s × %s mm %s' % (key(d['d1']), key(d['d2']), d['sch'])) if 'sch' in d else dims_label(d, key) + ' mm'
    elif 't' in d:
        size = 'Ø%s × %s mm' % (key(d['d']), key(d['t']))
    else:
        size = 'Ø%s mm %s' % (key(d['d']), d['sch'])
    parts = [rec['articleEn'], size, rec['nuance']]
    if rec['typeEn']:
        parts.append(rec['typeEn'].lower())
    parts += [NORME_EN.get(rec['norme'], rec['norme']), rec['finitionEn'].lower()]
    return ', '.join(parts)


def expected_dim_token(dims):
    """What the dimension segment of the ERP designation should contain."""
    if 'd1' in dims:
        if 't1' in dims:
            return '%s/%sx%s/%s' % (fr(dims['d1']), fr(dims['t1']), fr(dims['d2']), fr(dims['t2']))
        return None  # ASME reducers: spacing varies, checked numerically below
    if 'sch' in dims:
        return '%s %s' % (fr(dims['d']), dims['sch'])
    return '%sx%s' % (fr(dims['d']), fr(dims['t']))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--en', required=True)
    ap.add_argument('--asme', required=True)
    ap.add_argument('--report-dir', required=True)
    a = ap.parse_args()
    if os.path.abspath(a.report_dir).startswith(ROOT + os.sep):
        sys.exit('report-dir must be outside the repository (it contains client codes).')

    issues = []           # (category, reference, detail)
    spacing = collections.Counter()   # (sheet, column, kind) → cells
    stats = collections.OrderedDict()
    full = []             # every source row, for the private export
    records = []          # public catalog entries

    sources = [
        ('en-ss', a.en, 'SANS SOUDURE', 'EN'),
        ('en-w', a.en, 'SOUDE', 'EN'),
        ('asme', a.asme, 'CODES ARTICLES ASME SS PEINT', 'ASME'),
    ]
    # Sheets present in the workbooks but not part of the catalog
    for path in (a.en, a.asme):
        wb = openpyxl.load_workbook(path, data_only=True)
        for ws in wb.worksheets:
            if ws.title not in [s[2] for s in sources if s[1] == path]:
                vals = [c for r in ws.iter_rows(values_only=True) for c in r if c not in (None, '')]
                issues.append(('Onglet ignoré', '%s › %s' % (os.path.basename(path), ws.title),
                               'aucun en-tête produit ; contenu : %r' % vals[:10]))

    for src_id, path, sheet, kind in sources:
        sh = read_sheet(path, sheet)
        fname = os.path.basename(path)
        s = stats.setdefault('%s › %s' % (fname, sheet), collections.OrderedDict())
        s['Lignes du tableur (max_row)'] = sh['maxRow']
        s["Ligne d'en-tête"] = sh['headerRow']
        s['Lignes vides ignorées'] = sh['emptyRows'] + sh['blankBeforeHeader']
        s['Lignes de données'] = len(sh['rows'])
        s['Colonnes'] = ', '.join(c for c in sh['header'] if c)

        for rownum, r in sh['rows']:
            code = clean(r.get('Code livrable') or r.get('CODE'))
            article = clean(r.get('Article'))
            raw = {k: r.get(k) for k in sh['header'] if k}
            full.append({'source': src_id, 'file': fname, 'sheet': sheet, 'row': rownum, 'values': raw})
            ref = '%s L%d (%s)' % (sheet, rownum, code)

            for col in ('Article', 'D', 'Ep', 'Nuance', 'Norme', 'Finition', 'Désignation'):
                if r.get(col) in (None, ''):
                    issues.append(('Champ obligatoire manquant', ref, col))
            if not code:
                issues.append(('Code manquant', ref, ''))
                continue
            if r.get('Type') in (None, ''):
                issues.append(('Type de fabrication non renseigné', ref, article))
            if 'Code interne' in r and r.get('Code interne') in (None, ''):
                issues.append(('Code interne manquant', ref, article))
            for col, v in r.items():
                if isinstance(v, str) and v != v.strip():
                    spacing[(sheet, col, 'espace en début/fin')] += 1
                if isinstance(v, str) and '  ' in v:
                    spacing[(sheet, col, 'espaces doubles')] += 1

            cdc = clean(r.get('Cahier de charge client'))
            if cdc and cdc != 'Local':
                # Customer-specific deliverable code: kept in the private export only.
                continue

            fam = family_of(article or '')
            if not fam:
                issues.append(('Article sans famille connue', ref, article))
                continue
            dims, f = parse_dims(fam, r.get('D'), r.get('Ep'), kind, issues, ref)
            fin_raw = clean(r.get('Finition'))
            desig = r.get('Désignation') or ''
            rec = {
                'id': '%s:%s' % (src_id, code),
                'code': code,
                'slug': re.sub(r'[^a-z0-9]+', '-', code.lower()).strip('-'),
                'family': fam,
                'article': article,
                'type': clean(r.get('Type')),
                'nuance': clean(r.get('Nuance')),
                'norme': clean(r.get('Norme')),
                'finition': FINITION_NORMALISE.get(fin_raw, fin_raw),
                'finitionRaw': fin_raw,
                'dRaw': clean(r.get('D')) if isinstance(r.get('D'), str) else r.get('D'),
                'epRaw': clean(r.get('Ep')) if isinstance(r.get('Ep'), str) else r.get('Ep'),
                'dims': dims,
                'dimsLabel': dims_label(dims, key),
                'dimsLabelFr': dims_label(dims),
                'designation': desig,
                'designationDisplay': designation_display(desig),
                'src': {'file': fname, 'sheet': sheet, 'rows': [rownum]},
            }
            if r.get('TRI Index') is not None:
                rec['src']['tri'] = r.get('TRI Index')
            rec['articleEn'] = article_en(article)
            rec['typeEn'] = TYPE_EN.get(rec['type']) if rec['type'] else None
            rec['finitionEn'] = FINISH_EN[fin_raw]
            rec['designationEn'] = designation_en(rec)
            # French facet values (French pages): Excel wording, clear finish names
            rec['finitionFr'] = FINISH_FR[fin_raw]
            rec['ffr'] = dict(f, article=article, type=rec['type'], nuance=rec['nuance'],
                              norme=NORME_EN.get(rec['norme'], rec['norme']), finition=rec['finitionFr'])
            rec['f'] = dict(f, article=rec['articleEn'], type=rec['typeEn'], nuance=rec['nuance'],
                            norme=NORME_EN.get(rec['norme'], rec['norme']), finition=rec['finitionEn'])

            # Designation ↔ columns consistency
            dnorm = re.sub(r'\s+', ' ', desig)
            tok = expected_dim_token(dims)
            if tok and tok not in dnorm.replace(' x ', 'x') and tok not in dnorm:
                issues.append(('Désignation ≠ colonnes D/Ep', ref, 'attendu %r dans %r' % (tok, desig)))
            if 'd1' in dims and 'sch' in dims:
                nums = [num(x) for x in re.findall(r'\d+(?:,\d+)?', dnorm.split('_')[1])] if '_' in dnorm else []
                if nums[:2] != [dims['d1'], dims['d2']]:
                    issues.append(('Désignation ≠ colonnes D/Ep', ref, desig))
            for col in ('nuance', 'norme'):
                if rec[col] and rec[col] not in dnorm:
                    issues.append(('Désignation ≠ colonne %s' % col, ref, '%r absent de %r' % (rec[col], desig)))
            if fin_raw and fin_raw not in dnorm:
                issues.append(('Désignation ≠ colonne Finition', ref, '%r absent de %r' % (fin_raw, desig)))
            records.append(rec)

    # ---- Customer-spec rows vs their "Local" row (EN seamless sheet) ----
    tri_local = {}
    for x in full:
        v = x['values']
        if x['source'] == 'en-ss' and clean(v.get('Cahier de charge client')) == 'Local':
            tri_local[v.get('TRI Index')] = v
    client_rows = collections.Counter()
    for x in full:
        v = x['values']
        cdc = clean(v.get('Cahier de charge client'))
        if x['source'] != 'en-ss' or cdc in (None, 'Local'):
            continue
        client_rows[cdc] += 1
        loc = tri_local.get(v.get('TRI Index'))
        if not loc:
            issues.append(('Ligne client sans ligne Local', 'SANS SOUDURE L%d' % x['row'], cdc))
            continue
        for col in ('Code interne', 'Article', 'D', 'Ep', 'Type', 'Nuance', 'Norme', 'Finition', 'Désignation'):
            if v.get(col) != loc.get(col):
                issues.append(('Ligne client ≠ ligne Local', 'SANS SOUDURE L%d' % x['row'], col))

    # ---- Duplicates ----
    by_code = collections.defaultdict(list)
    for rec in records:
        by_code[rec['code']].append(rec)
    merged = []
    exact_dups = []
    for code, recs in by_code.items():
        first = recs[0]
        cmp_keys = [k for k in first if k not in ('src', 'id')]
        if len(recs) > 1 and all(all(r[k] == first[k] for k in cmp_keys) for r in recs[1:]):
            # Strictly identical rows (same code, same values): published once,
            # every source row number is kept for traceability.
            for r in recs[1:]:
                first['src']['rows'] += r['src']['rows']
            exact_dups.append((code, first['src']['sheet'], first['src']['rows']))
            merged.append(first)
        elif len(recs) > 1:
            for r in recs:
                issues.append(('Code répété avec valeurs différentes — à arbitrer', code, r['src']))
                r['slug'] = '%s-%s' % (r['slug'], r['src']['rows'][0])
                merged.append(r)
        else:
            merged.append(first)
    records = merged
    slugs = collections.Counter(r['slug'] for r in records)
    assert all(v == 1 for v in slugs.values()), 'slug collision'

    by_desig = collections.defaultdict(set)
    for r in records:
        by_desig[r['designation']].add(r['code'])
    for d, codes in by_desig.items():
        if len(codes) > 1:
            issues.append(('Même désignation pour plusieurs codes', ', '.join(sorted(codes)), d))
    by_specs = collections.defaultdict(list)
    for r in records:
        k = (r['article'], json.dumps(r['dims'], sort_keys=True), r['type'], r['nuance'], r['norme'], r['finition'])
        by_specs[k].append(r['code'])
    for k, codes in by_specs.items():
        if len(codes) > 1:
            issues.append(('Mêmes caractéristiques pour plusieurs codes', ', '.join(codes), str(k)))

    # Formatting variants in raw D (ASME reducers)
    for r in records:
        if isinstance(r['dRaw'], str) and 'x' in r['dRaw']:
            canon = '%s x %s' % (fr(r['dims']['d1']), fr(r['dims']['d2']))
            if r['dRaw'] != canon:
                issues.append(('Format de D non homogène', r['code'], '%r (forme majoritaire : %r)' % (r['dRaw'], canon)))

    # ---- Write public JSON ----
    fam_order = {'elbows': 0, 'tees': 1, 'reducers': 2, 'caps': 3}

    def sort_key(r):
        dm = r['dims']
        return (r['norme'] or '', r['article'] or '', r['type'] or '', r['finition'] or '',
                dm.get('d', dm.get('d1', 0)), dm.get('d2', 0), str(dm.get('t', dm.get('sch', ''))))
    records.sort(key=lambda r: (fam_order[r['family']],) + sort_key(r))
    public_keys = ['id', 'code', 'slug', 'family', 'article', 'type', 'nuance', 'norme', 'finition',
                   'finitionRaw', 'dRaw', 'epRaw', 'dims', 'dimsLabel', 'dimsLabelFr', 'designation', 'designationDisplay',
                   'articleEn', 'typeEn', 'finitionEn', 'designationEn', 'f', 'finitionFr', 'ffr']
    os.makedirs(OUT_DIR, exist_ok=True)
    generated = datetime.date.today().isoformat()
    counts = {}
    for fam, meta in FAMILIES.items():
        items = [{k: r[k] for k in public_keys} for r in records if r['family'] == fam]
        counts[fam] = len(items)
        with open(os.path.join(OUT_DIR, fam + '.json'), 'w', encoding='utf-8') as fh:
            json.dump({'family': fam, 'name': meta['name'], 'nameFr': meta['nameFr'],
                       'generated': generated, 'count': len(items), 'items': items},
                      fh, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT_DIR, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump({'generated': generated, 'families': [dict(slug=k, count=counts[k], **v) for k, v in FAMILIES.items()]},
                  fh, ensure_ascii=False, indent=1)

    # ---- Private exports ----
    with open(os.path.join(a.report_dir, 'catalog-full.json'), 'w', encoding='utf-8') as fh:
        json.dump({'generated': generated, 'rows': full, 'published': records}, fh, ensure_ascii=False, indent=1, default=str)

    for (sheet, col, kind), n in sorted(spacing.items()):
        issues.append(('Espaces superflus (nettoyés à l\'import)', '%s › colonne %s' % (sheet, col), '%s : %d cellules' % (kind, n)))
    issues.append(('Même désignation pour plusieurs codes (attendu)', 'SANS SOUDURE',
                   '%d codes clients (.01/.02) reprennent la désignation de leur ligne Local — '
                   'toutes leurs colonnes techniques ont été comparées à la ligne Local' % sum(client_rows.values())))
    write_report(a, stats, records, issues, exact_dups, client_rows, counts)
    print('Published references:', len(records), counts)
    print('Issues:', len(issues))


def write_report(a, stats, records, issues, exact_dups, client_rows, counts):
    L = []
    w = L.append
    w('# Rapport de qualité des données — catalogue Le Raccordement')
    w('')
    w('Généré le %s par `tools/catalog/import_excel.py`.' % datetime.datetime.now().strftime('%d/%m/%Y %H:%M'))
    w('')
    w('Sources : `%s` et `%s`. Les fichiers Excel ne sont jamais modifiés.' % (os.path.basename(a.en), os.path.basename(a.asme)))
    w('')
    w('## 1. Comptage par fichier et par onglet')
    w('')
    for name, s in stats.items():
        w('**%s**' % name)
        w('')
        for k, v in s.items():
            w('- %s : %s' % (k, v))
        w('')
    w('## 2. Références publiées sur le site')
    w('')
    w('| Famille | Références |')
    w('|---|---|')
    for fam, n in counts.items():
        w('| %s | %d |' % (fam, n))
    w('| **Total** | **%d** |' % sum(counts.values()))
    w('')
    w('Règles appliquées :')
    w('')
    w('- Onglet *SANS SOUDURE* : seules les lignes « Cahier de charge client = Local » sont publiées. '
      'Les codes propres aux clients (%s) restent dans `catalog-full.json` et ne sont pas affichés sur le site public.'
      % ', '.join('%s : %d lignes' % kv for kv in client_rows.items()))
    w('- Lignes **strictement identiques** (même code et mêmes valeurs dans toutes les colonnes) : publiées une seule fois, '
      'les numéros de toutes les lignes sources sont conservés. %d codes concernés.' % len(exact_dups))
    w('- Finition : « Peinte » est regroupée avec « Peint » dans le filtre (accord féminin pour les réductions). '
      'La valeur originale est conservée (`finitionRaw`) et la désignation n\'est pas modifiée.')
    w('- « EN/1 » (colonne Norme) est affiché tel quel ; le nom du fichier source indique qu\'il s\'agit de la norme EN 10253-1. **À confirmer.**')
    w('- STD et XS sont conservés comme désignations d\'épaisseur (jamais convertis en nombres).')
    w('- Réductions EN : D = « Ø grand côté / épaisseur », Ep = « Ø petit côté / épaisseur ». Réductions ASME : D = « Ø1 x Ø2 », Ep = STD/XS.')
    w('')
    w('## 3. Correspondance colonnes Excel → champs du catalogue')
    w('')
    w('| Colonne Excel | Champ | Remarque |')
    w('|---|---|---|')
    for row in [
        ('Code livrable (EN SS) / CODE (EN soudé, ASME)', 'code, slug', 'référence commerciale affichée, URL = code en minuscules'),
        ('—', 'id', 'identifiant interne stable `<source>:<code>` (en-ss, en-w, asme)'),
        ('Code interne', '— (export privé)', 'non publié'),
        ('TRI Index', '— (export privé)', 'traçabilité'),
        ('Article', 'article, family', 'famille déduite du début de l\'article : Coude → elbows, Té → tees, RC/RE → reducers, Caps/Fond → caps'),
        ('D', 'dims.d / dims.d1, dims.d2 ; dRaw', 'valeur exacte, unité mm'),
        ('Ep', 'dims.t / dims.sch / dims.t1, dims.t2 ; epRaw', 'valeur exacte (mm) ou STD/XS'),
        ('Type', 'type', 'Sans soudure / Soudé / vide'),
        ('Nuance', 'nuance', ''),
        ('Norme', 'norme', ''),
        ('Finition', 'finition, finitionRaw', ''),
        ('Cahier de charge client', '— (filtrage Local)', ''),
        ('Désignation', 'designation, designationDisplay', 'texte original intact ; version affichée : séparateurs « _ » remplacés par un espace, espaces multiples réduits'),
    ]:
        w('| %s | %s | %s |' % row)
    w('')
    w('## 4. Anomalies et points à valider')
    w('')
    groups = collections.OrderedDict()
    for cat, ref, detail in issues:
        groups.setdefault(cat, []).append((ref, detail))
    w('| Catégorie | Nombre |')
    w('|---|---|')
    for cat, items in groups.items():
        w('| %s | %d |' % (cat, len(items)))
    w('')
    if exact_dups:
        w('### Doublons strictement identiques (publiés une seule fois)')
        w('')
        for code, sheet, rows in exact_dups:
            w('- `%s` — %s, lignes %s' % (code, sheet, ', '.join(map(str, rows))))
        w('')
    for cat, items in groups.items():
        w('### %s (%d)' % (cat, len(items)))
        w('')
        for ref, detail in items[:60]:
            w('- %s — %s' % (ref, detail))
        if len(items) > 60:
            w('- … %d autres (voir `catalog-full.json`)' % (len(items) - 60))
        w('')
    with open(os.path.join(a.report_dir, 'rapport-qualite-donnees.md'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L))


if __name__ == '__main__':
    main()
