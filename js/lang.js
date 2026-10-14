/* First visit: open the site in the visitor's language. Loaded in <head>, before the page is shown.
   - Browser language French or Arabic (France, Tunisia, Algeria, Morocco…) → French site (root)
   - Any other browser language → English site (/en/)
   The choice is remembered; the FR/EN switch overrides it (js/main.js). Search engines are never redirected. */
(function () {
  try {
    var KEY = 'lr_lang';
    var script = document.currentScript;
    if (!script || /bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(navigator.userAgent)) return;
    var current = (document.documentElement.lang || 'fr').slice(0, 2) === 'en' ? 'en' : 'fr';
    var pref = localStorage.getItem(KEY);
    if (pref !== 'fr' && pref !== 'en') {
      var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'fr'];
      var first = String(langs[0]).slice(0, 2).toLowerCase();
      pref = first === 'fr' || first === 'ar' ? 'fr' : 'en';
      localStorage.setItem(KEY, pref);
    }
    if (pref === current) return;
    var root = new URL('..', script.src).href;
    var here = window.location.href;
    if (here.indexOf(root) !== 0) return;
    var rel = here.slice(root.length);
    var target = current === 'en' ? root + rel.replace(/^en\//, '') : root + 'en/' + rel;
    window.location.replace(target);
  } catch (e) { /* storage blocked: stay on this page */ }
})();
