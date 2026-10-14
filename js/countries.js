/* Quote form: country list and international dialling code.
   Country names come from the browser (Intl.DisplayNames) in the page language; only ISO codes and
   dialling codes are stored here. Choosing a country sets its dialling code; both stay editable. */
(function () {
  const country = document.querySelector('[data-country-select]');
  const dial = document.querySelector('[data-dial-select]');
  if (!country || !dial) return;
  const LANG = window.LR_LANG === 'en' ? 'en' : 'fr';

  // ISO 3166-1 alpha-2 → international dialling code
  const CODES = ('AF93 AL355 DZ213 AD376 AO244 AG1268 AR54 AM374 AU61 AT43 AZ994 BS1242 BH973 BD880 BB1246 BY375 BE32 BZ501 BJ229 ' +
    'BT975 BO591 BA387 BW267 BR55 BN673 BG359 BF226 BI257 KH855 CM237 CA1 CV238 CF236 TD235 CL56 CN86 CO57 KM269 CG242 CD243 CR506 ' +
    'CI225 HR385 CU53 CY357 CZ420 DK45 DJ253 DM1767 DO1809 EC593 EG20 SV503 GQ240 ER291 EE372 SZ268 ET251 FJ679 FI358 FR33 GA241 GM220 ' +
    'GE995 DE49 GH233 GR30 GD1473 GT502 GN224 GW245 GY592 HT509 HN504 HK852 HU36 IS354 IN91 ID62 IR98 IQ964 IE353 IL972 IT39 JM1876 ' +
    'JP81 JO962 KZ7 KE254 KI686 KW965 KG996 LA856 LV371 LB961 LS266 LR231 LY218 LI423 LT370 LU352 MO853 MG261 MW265 MY60 MV960 ML223 ' +
    'MT356 MH692 MR222 MU230 MX52 FM691 MD373 MC377 MN976 ME382 MA212 MZ258 MM95 NA264 NR674 NP977 NL31 NZ64 NI505 NE227 NG234 KP850 ' +
    'MK389 NO47 OM968 PK92 PW680 PS970 PA507 PG675 PY595 PE51 PH63 PL48 PT351 QA974 RO40 RU7 RW250 KN1869 LC1758 VC1784 WS685 SM378 ' +
    'ST239 SA966 SN221 RS381 SC248 SL232 SG65 SK421 SI386 SB677 SO252 ZA27 KR82 SS211 ES34 LK94 SD249 SR597 SE46 CH41 SY963 TW886 ' +
    'TJ992 TZ255 TH66 TL670 TG228 TO676 TT1868 TN216 TR90 TM993 TV688 UG256 UA380 AE971 GB44 US1 UY598 UZ998 VU678 VA39 VE58 VN84 ' +
    'YE967 ZM260 ZW263 XK383 RE262 GP590 MQ596 GF594 YT262 NC687 PF689 PR1787').split(' ')
    .map(s => ({ iso: s.slice(0, 2), dial: '+' + s.slice(2) }));
  // Frequent markets first
  const FIRST = ['TN', 'FR', 'IT', 'DZ', 'LY', 'MA'];

  let names;
  try { names = new Intl.DisplayNames([LANG], { type: 'region' }); } catch (e) { names = null; }
  const nameOf = iso => (names && names.of(iso)) || iso;
  const list = CODES.map(c => Object.assign(c, { name: nameOf(c.iso) }))
    .sort((a, b) => a.name.localeCompare(b.name, LANG));
  const first = FIRST.map(iso => list.find(c => c.iso === iso)).filter(Boolean);
  const rest = list.filter(c => FIRST.indexOf(c.iso) === -1);

  const opt = (value, text, iso) => {
    const o = document.createElement('option');
    o.value = value; o.textContent = text; if (iso) o.dataset.iso = iso;
    return o;
  };
  const group = (label, items, make) => {
    const g = document.createElement('optgroup');
    g.label = label;
    items.forEach(c => g.appendChild(make(c)));
    return g;
  };
  const T = window.LR_T || ((en) => en);
  // country: value = name in the page language (what the sales team reads)
  country.appendChild(group(T('Frequent', 'Fréquents'), first, c => opt(c.name, c.name, c.iso)));
  country.appendChild(group(T('All countries', 'Tous les pays'), rest, c => opt(c.name, c.name, c.iso)));
  // dialling code: short label "TN +216"
  dial.appendChild(group(T('Frequent', 'Fréquents'), first, c => opt(c.dial, c.iso + ' ' + c.dial, c.iso)));
  dial.appendChild(group(T('All countries', 'Tous les pays'), rest, c => opt(c.dial, c.iso + ' ' + c.dial, c.iso)));

  const select = (sel, iso) => {
    const o = Array.from(sel.options).find(x => x.dataset.iso === iso);
    if (o) sel.value = o.value;
    return !!o;
  };
  // Default: where the visitor is, from the device time zone (Africa/Tunis → Tunisia, Europe/Zurich → Switzerland);
  // then the browser's region (fr-TN); otherwise Tunisia. Nothing is sent anywhere to find it.
  const TZ = {
    'Africa/Tunis': 'TN', 'Africa/Algiers': 'DZ', 'Africa/Tripoli': 'LY', 'Africa/Casablanca': 'MA', 'Africa/El_Aaiun': 'MA', 'Africa/Cairo': 'EG',
    'Africa/Dakar': 'SN', 'Africa/Abidjan': 'CI', 'Africa/Lagos': 'NG', 'Africa/Johannesburg': 'ZA', 'Africa/Nairobi': 'KE', 'Africa/Nouakchott': 'MR',
    'Africa/Bamako': 'ML', 'Africa/Douala': 'CM', 'Africa/Kinshasa': 'CD', 'Africa/Addis_Ababa': 'ET', 'Africa/Khartoum': 'SD', 'Africa/Accra': 'GH',
    'Europe/Paris': 'FR', 'Europe/Rome': 'IT', 'Europe/Madrid': 'ES', 'Atlantic/Canary': 'ES', 'Europe/Lisbon': 'PT', 'Europe/Berlin': 'DE',
    'Europe/Brussels': 'BE', 'Europe/Amsterdam': 'NL', 'Europe/Luxembourg': 'LU', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT', 'Europe/London': 'GB',
    'Europe/Dublin': 'IE', 'Europe/Monaco': 'MC', 'Europe/Malta': 'MT', 'Europe/Athens': 'GR', 'Europe/Istanbul': 'TR', 'Europe/Warsaw': 'PL',
    'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO', 'Europe/Sofia': 'BG', 'Europe/Belgrade': 'RS', 'Europe/Zagreb': 'HR',
    'Europe/Ljubljana': 'SI', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Kiev': 'UA',
    'Europe/Kyiv': 'UA', 'Europe/Moscow': 'RU', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Asia/Bahrain': 'BH',
    'Asia/Muscat': 'OM', 'Asia/Baghdad': 'IQ', 'Asia/Amman': 'JO', 'Asia/Beirut': 'LB', 'Asia/Jerusalem': 'IL', 'Asia/Tehran': 'IR', 'Asia/Karachi': 'PK',
    'Asia/Kolkata': 'IN', 'Asia/Shanghai': 'CN', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY',
    'Asia/Bangkok': 'TH', 'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH', 'Asia/Ho_Chi_Minh': 'VN', 'Australia/Sydney': 'AU', 'Pacific/Auckland': 'NZ',
    'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Toronto': 'CA',
    'America/Montreal': 'CA', 'America/Vancouver': 'CA', 'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR', 'America/Argentina/Buenos_Aires': 'AR',
    'America/Santiago': 'CL', 'America/Bogota': 'CO', 'America/Lima': 'PE'
  };
  let tzIso = '';
  try { tzIso = TZ[Intl.DateTimeFormat().resolvedOptions().timeZone] || ''; } catch (e) { tzIso = ''; }
  const region = ((navigator.language || '').split('-')[1] || '').toUpperCase();
  const known = iso => CODES.some(c => c.iso === iso);
  const start = known(tzIso) ? tzIso : known(region) ? region : 'TN';
  select(country, start);
  select(dial, start);

  country.addEventListener('change', () => {
    const o = country.selectedOptions[0];
    if (o && o.dataset.iso) select(dial, o.dataset.iso);
  });

  // Full number sent with the request: "+216 39 15 65 43"
  window.LR_PHONE = function (number) {
    const n = String(number || '').trim();
    if (!n) return '';
    if (n.startsWith('+') || n.startsWith('00')) return n;
    return dial.value + ' ' + n.replace(/^0+/, '');
  };
})();
