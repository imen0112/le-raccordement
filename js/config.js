/* Site-wide settings. Edit here, nothing else needs to change.

   quoteEndpoint: URL of the quote API (server/quote-api, deployed on Railway),
   e.g. 'https://le-raccordement-quotes.up.railway.app/api/quote'.
   While it is empty, the quote form says so plainly and offers to open the
   visitor's mail client instead. It never pretends a request was sent. */
window.LR_CONFIG = {
  quoteEndpoint: '',
  quoteEmail: 'commande@leraccordement.com',
  siteUrl: 'https://leraccordement.com'
};
