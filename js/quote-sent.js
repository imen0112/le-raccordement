/* Quote request confirmation (quote-sent.html), both languages. Shows only what this browser sent. */
(function () {
  const T = window.LR_T || ((en) => en);
  const FR = window.LR_LANG === 'fr';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const id = new URLSearchParams(location.search).get('id') || '';
  let q = null;
  try { q = JSON.parse(sessionStorage.getItem('lr_last_quote')); } catch (e) { /* storage blocked */ }
  const title = document.getElementById('qs-title'), lead = document.getElementById('qs-lead'), body = document.getElementById('qs-body');
  if (!title || !lead || !body) return;
  if (!q || q.id !== id || !q.customer || !Array.isArray(q.items)) {
    title.textContent = T('No recent request found', 'Aucune demande récente trouvée');
    lead.textContent = T('This page confirms a quote request sent from this browser. Nothing matching was found. If you were sending a request, please check your quote list.',
      'Cette page confirme une demande de devis envoyée depuis ce navigateur. Aucune demande correspondante n’a été trouvée. Si vous étiez en train d’envoyer une demande, vérifiez votre liste de devis.');
    body.innerHTML = `<a class="btn btn-primary" href="cart.html">${T('Open my quote list', 'Ouvrir ma liste de devis')}</a>`;
    return;
  }
  title.textContent = T('Thank you, your request has been sent.', 'Merci, votre demande a bien été envoyée.');
  const when = q.receivedAt ? new Date(q.receivedAt).toLocaleString(FR ? 'fr-FR' : 'en-GB') : '';
  lead.innerHTML = FR
    ? `Demande n° <strong class="mono">${esc(q.id)}</strong>${when ? ' · ' + esc(when) : ''}. Notre équipe commerciale l’a reçue par e-mail et répondra à <strong>${esc(q.customer.email)}</strong> sous un jour ouvré.`
    : `Request number <strong class="mono">${esc(q.id)}</strong>${when ? ' · ' + esc(when) : ''}. Our sales team has received it by email and will reply to <strong>${esc(q.customer.email)}</strong> within one business day.`;
  const L = { ref: T('Reference', 'Référence'), des: T('Designation', 'Désignation'), qty: T('Quantity', 'Quantité') };
  body.innerHTML = `<h2 class="h-3">${T('Summary', 'Récapitulatif')}</h2>
    <p class="text-muted mt-2">${esc(q.customer.name)} · ${esc(q.customer.company)}</p>
    <div class="ref-table-wrap mt-4"><table class="ref-table"><thead><tr><th scope="col">${L.ref}</th><th scope="col">${L.des}</th><th scope="col">${L.qty}</th></tr></thead>
    <tbody>${q.items.map(i => `<tr><td data-label="${L.ref}" class="ref-code">${esc(i.code)}</td><td data-label="${L.des}">${esc(i.designation)}</td><td data-label="${L.qty}">${esc(i.qty)}</td></tr>`).join('')}</tbody></table></div>
    <p class="mt-8"><a class="btn btn-dark" href="products/">${T('Back to the catalog', 'Retour au catalogue')}</a></p>`;
})();
