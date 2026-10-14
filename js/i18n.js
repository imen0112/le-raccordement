/* Language of the page (from <html lang>) and the two roots used to build links:
   - LR_SITE_ROOT: shared folders (assets, js, css, data)
   - LR_PAGE_ROOT: pages of the current language (French at the root, English under /en/)
   LR_T('English', 'Français') returns the string for the page language. */
(function () {
  const lang = (document.documentElement.lang || 'fr').slice(0, 2) === 'en' ? 'en' : 'fr';
  const site = new URL('..', (document.currentScript && document.currentScript.src) || window.location.href).href;
  window.LR_LANG = lang;
  window.LR_DATA_V = '20261014v';   // version of data/catalog/*.json (bumped with the assets)
  window.LR_SITE_ROOT = site;
  window.LR_PAGE_ROOT = site + (lang === 'en' ? 'en/' : '');
  window.LR_T = (en, fr) => (lang === 'fr' ? fr : en);
  // Numbers as written in each language: 21.3 / 21,3
  window.LR_NUM = v => (lang === 'fr' ? String(v).replace('.', ',') : String(v));
  // Texts of a catalog reference in the page language (French = wording of the Excel files)
  window.LR_REFTXT = it => lang === 'fr'
    ? { designation: it.designationDisplay, dims: it.dimsLabelFr, norme: (it.ffr || it.f).norme, type: it.type,
        finish: it.finitionFr, article: it.article }
    : { designation: it.designationEn, dims: it.dimsLabel, norme: it.f.norme, type: it.typeEn,
        finish: it.finitionEn, article: it.articleEn };
  window.LR_FAMILY = fam => ({
    en: { elbows: 'Elbows', tees: 'Tees', reducers: 'Reducers', caps: 'Caps' },
    fr: { elbows: 'Coudes', tees: 'Tés', reducers: 'Réductions', caps: 'Caps et fonds' }
  })[lang][fam] || fam;
})();
