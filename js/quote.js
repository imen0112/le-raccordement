/* Quote request form (cart.html).
   Sends the quote list + contact details to the quote API (LR_CONFIG.quoteEndpoint),
   which emails commande@… server-side. Success is only shown when the API
   confirms the email was accepted for delivery. */
(function () {
  const form = document.querySelector('[data-quote-form]');
  if (!form || !window.LR_CART) return;
  const cfg = window.LR_CONFIG || {};
  const T = window.LR_T || ((en) => en);
  const errorBox = document.getElementById('quote-error');
  const submitBtn = form.querySelector('[data-quote-submit]');
  const toEl = document.getElementById('quote-to');
  if (toEl) toEl.textContent = cfg.quoteEmail || '';
  const startedAt = Date.now();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // One key per quote attempt: a retry after a network error reuses it, so the
  // server can recognise a request it already emailed and not send it twice.
  let requestKey = newKey();
  let sending = false;

  function newKey() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const a = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 256; });
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }

  const RULES = {
    name: v => v.length >= 2 || T('Please enter your full name.', 'Veuillez indiquer vos nom et prénom.'),
    company: v => v.length >= 2 || T('Please enter your company name.', 'Veuillez indiquer le nom de votre société.'),
    email: v => /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(v) || T('Please enter a valid email address.', 'Veuillez indiquer une adresse e-mail valide.'),
    phone: v => (/^\+?[\d\s().\-/]{6,30}$/.test(v) && v.replace(/\D/g, '').length >= 6 && v.replace(/\D/g, '').length <= 20) || T('Please enter a valid phone number (digits, spaces, + allowed).', 'Veuillez indiquer un numéro de téléphone valide (chiffres, espaces et + acceptés).')
  };

  function fieldError(name, msg) {
    const input = form.elements[name];
    if (!input) return;
    const field = input.closest('.field');
    let p = field.querySelector('.field-error');
    if (msg) {
      input.setAttribute('aria-invalid', 'true');
      if (!p) { p = document.createElement('p'); p.className = 'field-error'; p.id = 'err-' + name; field.appendChild(p); }
      p.textContent = msg;
      input.setAttribute('aria-describedby', p.id);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      if (p) p.remove();
    }
  }

  function validate() {
    let first = null;
    Object.keys(RULES).forEach(name => {
      const v = (form.elements[name].value || '').trim();
      const r = RULES[name](v);
      fieldError(name, r === true ? null : r);
      if (r !== true && !first) first = form.elements[name];
    });
    return first;
  }
  form.addEventListener('blur', e => {
    const n = e.target.name;
    if (RULES[n] && e.target.hasAttribute('aria-invalid')) {
      const r = RULES[n](e.target.value.trim());
      fieldError(n, r === true ? null : r);
    }
  }, true);

  function showError(html) {
    errorBox.innerHTML = html;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function payload() {
    const v = n => (form.elements[n] ? form.elements[n].value : '').trim();
    return {
      requestKey,
      elapsedMs: Date.now() - startedAt,
      website: v('website'),
      customer: { name: v('name'), company: v('company'), email: v('email'), phone: window.LR_PHONE ? window.LR_PHONE(v('phone')) : v('phone'), country: v('country'), message: v('message') },
      items: window.LR_CART.lines().map(l => Object.assign({ kind: l.kind, code: l.code, designation: l.designation, qty: l.qty, url: l.url }, l.detail)),
      page: window.location.href,
      lang: window.LR_LANG || 'en'
    };
  }

  function mailtoFallback(p) {
    const lines = p.items.map(i => `${i.code}\t${i.qty} ${T('pcs', 'pièces')}\t${i.designation}`).join('\n');
    const na = T('not provided', 'non renseigné');
    const body = T(`Quote request from the website\n\nName: ${p.customer.name}\nCompany: ${p.customer.company}\nEmail: ${p.customer.email}\nPhone: ${p.customer.phone}\nCountry: ${p.customer.country || na}\n\nMessage:\n${p.customer.message || na}\n\nReference\tQty\tDesignation\n${lines}\n`,
                   `Demande de devis depuis le site\n\nNom : ${p.customer.name}\nSociété : ${p.customer.company}\nE-mail : ${p.customer.email}\nTéléphone : ${p.customer.phone}\nPays : ${p.customer.country || na}\n\nMessage :\n${p.customer.message || na}\n\nRéférence\tQté\tDésignation\n${lines}\n`);
    return `mailto:${cfg.quoteEmail}?subject=${encodeURIComponent('Demande de devis, site Le Raccordement')}&body=${encodeURIComponent(body)}`;
  }

  // Direct email to commande@ through Web3Forms (free, no server)
  function newId() {
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const r = Array.from(crypto.getRandomValues(new Uint8Array(3)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
    return 'DV-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + r;
  }
  async function sendWeb3Forms(p) {
    const id = newId();
    const lines = p.items.map((i, n) => `${n + 1}. ${i.code} | ${i.qty} pièces | ${i.designationFr || i.designation}`).join('\n');
    const c = p.customer;
    const body = {
      access_key: cfg.web3formsKey,
      subject: `Demande de devis ${id} · ${c.company} (${p.items.length} réf.)`,
      from_name: 'Site Le Raccordement',
      replyto: c.email,
      botcheck: p.website ? true : '',
      'N° de demande': id,
      'Nom': c.name, 'Société': c.company, 'E-mail': c.email, 'Téléphone': c.phone, 'Pays': c.country || 'non renseigné',
      'Langue du site': p.lang === 'fr' ? 'français' : 'anglais',
      'Références demandées': lines,
      'Message': c.message || '(aucun)'
    };
    sending = true;
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');
    const label = submitBtn.innerHTML;
    submitBtn.textContent = T('Sending…', 'Envoi en cours…');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body), signal: ctrl.signal
      });
      let data = null;
      try { data = await res.json(); } catch (_) { /* non-JSON error page */ }
      if (res.ok && data && data.success) {
        try {
          sessionStorage.setItem('lr_last_quote', JSON.stringify({
            id, receivedAt: new Date().toISOString(), customer: { name: c.name, company: c.company, email: c.email },
            items: p.items.map(i => ({ code: i.code, designation: i.designation, qty: i.qty }))
          }));
        } catch (_) { /* confirmation page falls back to the id only */ }
        window.LR_CART.clear();
        requestKey = newKey();
        window.location.href = 'quote-sent.html?id=' + encodeURIComponent(id);
        return;
      }
      showError(T(`<strong>Your request was not sent.</strong> Please try again, or <a href="${esc(mailtoFallback(p))}">send it by email to ${esc(cfg.quoteEmail)}</a>.`,
                  `<strong>Votre demande n’a pas été envoyée.</strong> Veuillez réessayer, ou <a href="${esc(mailtoFallback(p))}">l’envoyer par e-mail à ${esc(cfg.quoteEmail)}</a>.`));
    } catch (err) {
      showError(T(`<strong>Your request was not sent</strong> (network error). Your list is kept, please try again, or <a href="${esc(mailtoFallback(p))}">send it by email to ${esc(cfg.quoteEmail)}</a>.`,
                  `<strong>Votre demande n’a pas été envoyée</strong> (erreur réseau). Votre liste est conservée : réessayez, ou <a href="${esc(mailtoFallback(p))}">envoyez-la par e-mail à ${esc(cfg.quoteEmail)}</a>.`));
    } finally {
      clearTimeout(timer);
      sending = false;
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-busy');
      submitBtn.innerHTML = label;
    }
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (sending) return;
    errorBox.hidden = true;
    if (!window.LR_CART.count()) { showError(T('Your quote list is empty. <a href="products/">Add references from the catalog</a>.', 'Votre liste de devis est vide. <a href="products/">Ajoutez des références depuis le catalogue</a>.')); return; }
    const bad = validate();
    if (bad) { bad.focus(); return; }
    const p = payload();

    if (cfg.web3formsKey) return sendWeb3Forms(p);
    if (!cfg.quoteEndpoint) {
      showError(T(`<strong>Online sending is not configured yet, your request has not been sent.</strong><br>
        You can send it from your own email app instead: <a href="${esc(mailtoFallback(p))}">open a pre-filled email to ${esc(cfg.quoteEmail)}</a>.`,
        `<strong>L’envoi en ligne n’est pas encore activé : votre demande n’a pas été envoyée.</strong><br>
        Vous pouvez l’envoyer depuis votre messagerie : <a href="${esc(mailtoFallback(p))}">ouvrir un e-mail pré-rempli à ${esc(cfg.quoteEmail)}</a>.`));
      return;
    }

    sending = true;
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');
    const label = submitBtn.innerHTML;
    submitBtn.textContent = T('Sending…', 'Envoi en cours…');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(cfg.quoteEndpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p), signal: ctrl.signal
      });
      let data = null;
      try { data = await res.json(); } catch (_) { /* non-JSON error page */ }
      if (res.ok && data && data.ok === true && data.id) {
        try {
          sessionStorage.setItem('lr_last_quote', JSON.stringify({
            id: data.id, receivedAt: data.receivedAt, customer: { name: p.customer.name, company: p.customer.company, email: p.customer.email },
            items: p.items.map(i => ({ code: i.code, designation: i.designation, qty: i.qty }))
          }));
        } catch (_) { /* confirmation page falls back to the id only */ }
        window.LR_CART.clear();
        requestKey = newKey();
        window.location.href = 'quote-sent.html?id=' + encodeURIComponent(data.id);
        return;
      }
      const msg = (data && data.error) ? esc(data.error) : T('The server could not process your request.', 'Le serveur n’a pas pu traiter votre demande.');
      showError(T(`<strong>Your request was not sent.</strong> ${msg}<br>Please try again, or <a href="${esc(mailtoFallback(p))}">send it by email to ${esc(cfg.quoteEmail)}</a>.`,
                  `<strong>Votre demande n’a pas été envoyée.</strong> ${msg}<br>Veuillez réessayer, ou <a href="${esc(mailtoFallback(p))}">l’envoyer par e-mail à ${esc(cfg.quoteEmail)}</a>.`));
    } catch (err) {
      showError(T(`<strong>Your request was not sent</strong> (${err.name === 'AbortError' ? 'the server did not answer in time' : 'network error'}).<br>Your list is kept, please try again, or <a href="${esc(mailtoFallback(p))}">send it by email to ${esc(cfg.quoteEmail)}</a>.`,
                  `<strong>Votre demande n’a pas été envoyée</strong> (${err.name === 'AbortError' ? 'le serveur n’a pas répondu à temps' : 'erreur réseau'}).<br>Votre liste est conservée : veuillez réessayer, ou <a href="${esc(mailtoFallback(p))}">l’envoyer par e-mail à ${esc(cfg.quoteEmail)}</a>.`));
    } finally {
      clearTimeout(timer);
      sending = false;
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-busy');
      submitBtn.innerHTML = label;
    }
  });
})();

/* Quote list export (Excel / printable page) for the buyer's internal approval */
(function () {
  document.addEventListener('click', function (e) {
    const b = e.target.closest('[data-cart-export]');
    if (!b || !window.LR_EXPORT || !window.LR_CART) return;
    const lines = window.LR_CART.lines();
    if (!lines.length) return;
    const T = window.LR_T || ((en) => en);
    const headers = T(['Reference', 'Designation', 'Dimensions (mm)', 'Standard', 'Steel grade', 'Manufacturing', 'Finish', 'Quantity (pcs)'],
                      ['Référence', 'Désignation', 'Dimensions (mm)', 'Norme', 'Nuance', 'Fabrication', 'Finition', 'Quantité (pièces)']);
    const rows = lines.map(l => [l.code, l.designation, (l.detail && l.detail.dims) || '', (l.detail && l.detail.norme) || '',
      (l.detail && l.detail.nuance) || '', (l.detail && l.detail.type) || '', (l.detail && l.detail.finition) || '', l.qty]);
    const units = lines.reduce((s, l) => s + l.qty, 0);
    const subtitle = T(lines.length + ' references · ' + units + ' pieces · prices on request',
                       lines.length + ' références · ' + units + ' pièces · prix sur demande');
    const stamp = new Date().toISOString().slice(0, 10);
    const title = T('Quote list', 'Liste de devis');
    if (b.getAttribute('data-cart-export') === 'xlsx') window.LR_EXPORT.excel(T('le-raccordement-quote-list-', 'le-raccordement-liste-de-devis-') + stamp + '.xlsx', title, headers, rows, 'Le Raccordement · ' + title + ' · ' + subtitle);
    else window.LR_EXPORT.print(title, subtitle, headers, rows);
  });
})();
