/**
 * Le Raccordement: quote requests and contact messages, sent by email. Free, no server.
 *
 * Paste this file in https://script.google.com (new project), then Deploy > New deployment >
 * type "Web app", Execute as "Me", Who has access "Anyone". Copy the web app URL into
 * js/config.js (appsScriptUrl). Full steps: tools/forms/README.md
 *
 * For each quote request:
 *   1. email to commande@leraccordement.com with the details and the references (Reply goes to the client)
 *   2. copy to the client: "we received your request no DV-…" with the same list
 * Contact form: email to info@leraccordement.com + a short acknowledgement to the sender.
 *
 * Protections: hidden spam field, minimum filling time, strict validation, at most 3 requests per
 * e-mail address per hour and 40 per day in total (the client copy cannot be used to spam others).
 */
const QUOTE_TO = 'commande@leraccordement.com';
const CONTACT_TO = 'info@leraccordement.com';
const SENDER_NAME = 'Le Raccordement';
const MIN_FILL_MS = 3000;
const PER_ADDRESS_PER_HOUR = 3;
const PER_DAY = 40;

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website) return reply({ ok: false, error: 'Request rejected.' });                    // hidden spam field
    if (!(Number(d.elapsedMs) >= MIN_FILL_MS)) return reply({ ok: false, error: 'The form was submitted too quickly. Please wait a few seconds and try again.' });
    const c = d.customer || {};
    const fr = d.lang !== 'en';
    const email = clean(c.email, 200);
    if (!/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(email)) return reply({ ok: false, error: fr ? 'Adresse e-mail invalide.' : 'Invalid email address.' });
    const limited = rateLimit(email);
    if (limited) return reply({ ok: false, error: fr ? 'Trop de demandes. Réessayez plus tard ou écrivez-nous directement.' : 'Too many requests. Please try again later or email us directly.' });
    return d.kind === 'contact' ? contact(d, c, email, fr) : quote(d, c, email, fr);
  } catch (err) {
    console.error(err);
    return reply({ ok: false, error: 'Server error' });
  }
}

function quote(d, c, email, fr) {
  const name = clean(c.name, 120), company = clean(c.company, 160);
  if (name.length < 2 || company.length < 2) return reply({ ok: false, error: fr ? 'Nom et société obligatoires.' : 'Name and company are required.' });
  const items = (Array.isArray(d.items) ? d.items : []).slice(0, 200).map(i => ({
    code: clean(i.code, 40), qty: Math.max(50, Math.min(999999, parseInt(i.qty, 10) || 50)),
    designation: clean(i.designationFr || i.designation, 300)
  })).filter(i => i.code);
  if (!items.length) return reply({ ok: false, error: fr ? 'Votre liste de devis est vide.' : 'Your quote list is empty.' });

  const id = newId();
  const phone = clean(c.phone, 40), country = clean(c.country, 80), message = clean(c.message, 4000, true);
  const rows = items.map((i, n) => '<tr><td>' + (n + 1) + '</td><td><b>' + esc(i.code) + '</b></td><td>' + esc(i.designation) + '</td><td align="right">' + i.qty + '</td></tr>').join('');
  const table = '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#dde3ea;font:14px Arial">' +
    '<tr style="background:#0E2A47;color:#fff"><th>#</th><th>Référence</th><th>Désignation</th><th>Qté</th></tr>' + rows + '</table>';
  const text = items.map((i, n) => (n + 1) + '. ' + i.code + ' | ' + i.qty + ' pièces | ' + i.designation).join('\n');

  // 1. to the sales team
  send({
    to: QUOTE_TO, replyTo: email, name: 'Site ' + SENDER_NAME,
    subject: 'Demande de devis ' + id + ' · ' + company + ' (' + items.length + ' réf.)',
    htmlBody: '<p><b>Demande de devis ' + id + '</b> reçue depuis le site (' + (fr ? 'version française' : 'version anglaise') + ').</p>' +
      '<p>Nom : ' + esc(name) + '<br>Société : ' + esc(company) + '<br>E-mail : ' + esc(email) + '<br>Téléphone : ' + esc(phone) +
      '<br>Pays : ' + esc(country || 'non renseigné') + '</p>' + table +
      '<p>Message :<br>' + esc(message || '(aucun)').replace(/\n/g, '<br>') + '</p><p>Répondre à cet e-mail écrit directement au client.</p>',
    body: 'Demande de devis ' + id + '\n\nNom : ' + name + '\nSociété : ' + company + '\nE-mail : ' + email + '\nTéléphone : ' + phone +
      '\nPays : ' + (country || 'non renseigné') + '\n\n' + text + '\n\nMessage :\n' + (message || '(aucun)')
  });

  // 2. copy to the client
  const intro = fr
    ? '<p>Bonjour ' + esc(name) + ',</p><p>Nous avons bien reçu votre demande de devis <b>n° ' + id + '</b>. Notre équipe commerciale vous répond sous un jour ouvré.</p><p>Récapitulatif de votre demande :</p>'
    : '<p>Hello ' + esc(name) + ',</p><p>We have received your quote request <b>no. ' + id + '</b>. Our sales team will reply within one business day.</p><p>Summary of your request:</p>';
  const outro = fr
    ? '<p>Pour toute précision, répondez simplement à cet e-mail.</p><p>Cordialement,<br>Le Raccordement<br>Zone Industrielle de Doukhane, El Hencha, 3043 Sfax, Tunisie<br>+216 39 15 65 43</p>'
    : '<p>For any detail, simply reply to this email.</p><p>Best regards,<br>Le Raccordement<br>Zone Industrielle de Doukhane, El Hencha, 3043 Sfax, Tunisia<br>+216 39 15 65 43</p>';
  send({
    to: email, replyTo: QUOTE_TO, name: SENDER_NAME, from: QUOTE_TO,
    subject: (fr ? 'Votre demande de devis ' : 'Your quote request ') + id + ' · Le Raccordement',
    htmlBody: intro + table + outro,
    body: (fr ? 'Nous avons bien reçu votre demande de devis n° ' : 'We have received your quote request no. ') + id + '.\n\n' + text
  });

  return reply({ ok: true, id: id, receivedAt: new Date().toISOString() });
}

function contact(d, c, email, fr) {
  const name = clean(c.name, 120), company = clean(c.company, 160), phone = clean(c.phone, 40);
  const subject = clean(c.subject, 120), message = clean(c.message, 4000, true);
  if (name.length < 2 || !message) return reply({ ok: false, error: fr ? 'Nom et message obligatoires.' : 'Name and message are required.' });
  send({
    to: CONTACT_TO, replyTo: email, name: 'Site ' + SENDER_NAME,
    subject: 'Contact : ' + (subject || 'message') + ' · ' + (company || name),
    body: 'Nom : ' + name + '\nSociété : ' + (company || 'non renseigné') + '\nE-mail : ' + email + '\nTéléphone : ' + (phone || 'non renseigné') +
      '\nObjet : ' + (subject || 'non renseigné') + '\n\nMessage :\n' + message
  });
  send({
    to: email, replyTo: CONTACT_TO, name: SENDER_NAME, from: CONTACT_TO,
    subject: fr ? 'Votre message à Le Raccordement' : 'Your message to Le Raccordement',
    body: (fr ? 'Bonjour ' + name + ',\n\nNous avons bien reçu votre message et vous répondrons sous un jour ouvré.\n\nVotre message :\n'
              : 'Hello ' + name + ',\n\nWe have received your message and will reply within one business day.\n\nYour message:\n') + message +
          '\n\nLe Raccordement\n+216 39 15 65 43'
  });
  return reply({ ok: true, id: newId(), receivedAt: new Date().toISOString() });
}

function doGet() { return reply({ ok: true, service: 'Le Raccordement forms' }); }

// ---------------------------------------------------------------- helpers
/**
 * Send an email. When `from` (commande@ / info@) is configured in this Google account's Gmail as a
 * "Send mail as" address (with the mailbox's SMTP settings), the email leaves from that address;
 * otherwise it leaves from the Google account, with Reply-To set to the company address.
 */
function send(m) {
  const opts = { name: m.name, replyTo: m.replyTo };
  if (m.htmlBody) opts.htmlBody = m.htmlBody;
  if (m.from && GmailApp.getAliases().indexOf(m.from) !== -1) opts.from = m.from;
  GmailApp.sendEmail(m.to, m.subject, m.body || '', opts);
}

function reply(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function clean(v, max, multiline) {
  let s = String(v == null ? '' : v).trim().slice(0, max);
  if (!multiline) s = s.replace(/[\r\n]+/g, ' ');    // no header injection
  return s;
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function newId() {
  const d = Utilities.formatDate(new Date(), 'Africa/Tunis', 'yyyyMMdd');
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 5; i++) r += abc[Math.floor(Math.random() * abc.length)];
  return 'DV-' + d + '-' + r;
}

function rateLimit(email) {
  const cache = CacheService.getScriptCache();
  const k = 'a:' + email.toLowerCase();
  const n = Number(cache.get(k) || 0);
  if (n >= PER_ADDRESS_PER_HOUR) return true;
  const props = PropertiesService.getScriptProperties();
  const day = 'd:' + Utilities.formatDate(new Date(), 'Africa/Tunis', 'yyyyMMdd');
  const total = Number(props.getProperty(day) || 0);
  if (total >= PER_DAY) return true;
  cache.put(k, String(n + 1), 3600);
  props.setProperty(day, String(total + 1));
  return false;
}
