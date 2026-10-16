/* Site-wide settings. Edit here, nothing else needs to change.

   quoteEndpoint: URL of the quote API (server/quote-api, deployed on Railway),
   e.g. 'https://le-raccordement-quotes.up.railway.app/api/quote'.
   While it is empty, the quote form says so plainly and offers to open the
   visitor's mail client instead. It never pretends a request was sent. */
window.LR_CONFIG = {
  // Free direct sending to commande@ without a server: Web3Forms access key (https://web3forms.com, 250 requests/month).
  // The key only allows sending to the address it was created for; it is meant to be public.
  web3formsKey: '',          // quote requests → commande@leraccordement.com
  web3formsContactKey: '',   // contact form → info@leraccordement.com (a second key created for that address)
  quoteEndpoint: '',
  quoteEmail: 'commande@leraccordement.com',
  siteUrl: 'https://leraccordement.com'
};
