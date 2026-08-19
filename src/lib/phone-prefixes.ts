/**
 * The complete ITU-T E.164 country calling-code table, shared by every phone
 * input in the app (staff customer forms + the public recovery flow).
 *
 * Historically each form hard-coded the same nine prefixes (+39, +1, +44, +33,
 * +49, +34, +41, +86, +81), which silently forced every other nationality onto
 * a wrong code. Nothing downstream ever required that shortlist: the back end
 * validates plain E.164 (`/^\+[1-9]\d{1,14}$/`) and `formatPhoneE164` just
 * strips separators, so the limitation was purely cosmetic.
 *
 * Assigned country codes are prefix-free (no code is a prefix of another), so
 * longest-first matching in `splitPhoneNumber` is unambiguous. Codes shared by
 * several territories (+1 NANP, +7 RU/KZ, +44 GB/JE/GG/IM, +39 IT/VA …) appear
 * once per country here for searchability, but split back to the single code —
 * the territory lives in the area code, which stays in the national number.
 */

export type PhonePrefix = {
  /** ISO 3166-1 alpha-2 code — unique, used as the React key. */
  iso: string;
  /** English country name, used for searching. */
  name: string;
  /** Calling code including the leading "+". */
  code: string;
};

/** Default when we have no signal: Monnalisa is an Italian retailer. */
export const DEFAULT_PHONE_PREFIX = '+39';

/** Offered at the top of the picker — the markets the stores serve most. */
export const COMMON_PREFIX_ISOS = ['IT', 'US', 'GB', 'FR', 'DE', 'ES', 'CH', 'CN', 'JP'] as const;

/** ISO alpha-2 → regional-indicator flag emoji ("IT" → 🇮🇹). */
export function flagEmoji(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/[A-Z]/g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Every country/territory with a dialing code, alphabetical by name. */
export const PHONE_PREFIXES: ReadonlyArray<PhonePrefix> = [
  { iso: 'AF', name: 'Afghanistan', code: '+93' },
  { iso: 'AL', name: 'Albania', code: '+355' },
  { iso: 'DZ', name: 'Algeria', code: '+213' },
  { iso: 'AS', name: 'American Samoa', code: '+1' },
  { iso: 'AD', name: 'Andorra', code: '+376' },
  { iso: 'AO', name: 'Angola', code: '+244' },
  { iso: 'AI', name: 'Anguilla', code: '+1' },
  { iso: 'AG', name: 'Antigua and Barbuda', code: '+1' },
  { iso: 'AR', name: 'Argentina', code: '+54' },
  { iso: 'AM', name: 'Armenia', code: '+374' },
  { iso: 'AW', name: 'Aruba', code: '+297' },
  { iso: 'AU', name: 'Australia', code: '+61' },
  { iso: 'AT', name: 'Austria', code: '+43' },
  { iso: 'AZ', name: 'Azerbaijan', code: '+994' },
  { iso: 'BS', name: 'Bahamas', code: '+1' },
  { iso: 'BH', name: 'Bahrain', code: '+973' },
  { iso: 'BD', name: 'Bangladesh', code: '+880' },
  { iso: 'BB', name: 'Barbados', code: '+1' },
  { iso: 'BY', name: 'Belarus', code: '+375' },
  { iso: 'BE', name: 'Belgium', code: '+32' },
  { iso: 'BZ', name: 'Belize', code: '+501' },
  { iso: 'BJ', name: 'Benin', code: '+229' },
  { iso: 'BM', name: 'Bermuda', code: '+1' },
  { iso: 'BT', name: 'Bhutan', code: '+975' },
  { iso: 'BO', name: 'Bolivia', code: '+591' },
  { iso: 'BQ', name: 'Bonaire, Sint Eustatius and Saba', code: '+599' },
  { iso: 'BA', name: 'Bosnia and Herzegovina', code: '+387' },
  { iso: 'BW', name: 'Botswana', code: '+267' },
  { iso: 'BR', name: 'Brazil', code: '+55' },
  { iso: 'IO', name: 'British Indian Ocean Territory', code: '+246' },
  { iso: 'VG', name: 'British Virgin Islands', code: '+1' },
  { iso: 'BN', name: 'Brunei', code: '+673' },
  { iso: 'BG', name: 'Bulgaria', code: '+359' },
  { iso: 'BF', name: 'Burkina Faso', code: '+226' },
  { iso: 'BI', name: 'Burundi', code: '+257' },
  { iso: 'KH', name: 'Cambodia', code: '+855' },
  { iso: 'CM', name: 'Cameroon', code: '+237' },
  { iso: 'CA', name: 'Canada', code: '+1' },
  { iso: 'CV', name: 'Cape Verde', code: '+238' },
  { iso: 'KY', name: 'Cayman Islands', code: '+1' },
  { iso: 'CF', name: 'Central African Republic', code: '+236' },
  { iso: 'TD', name: 'Chad', code: '+235' },
  { iso: 'CL', name: 'Chile', code: '+56' },
  { iso: 'CN', name: 'China', code: '+86' },
  { iso: 'CX', name: 'Christmas Island', code: '+61' },
  { iso: 'CC', name: 'Cocos (Keeling) Islands', code: '+61' },
  { iso: 'CO', name: 'Colombia', code: '+57' },
  { iso: 'KM', name: 'Comoros', code: '+269' },
  { iso: 'CK', name: 'Cook Islands', code: '+682' },
  { iso: 'CR', name: 'Costa Rica', code: '+506' },
  { iso: 'CI', name: "Côte d'Ivoire", code: '+225' },
  { iso: 'HR', name: 'Croatia', code: '+385' },
  { iso: 'CU', name: 'Cuba', code: '+53' },
  { iso: 'CW', name: 'Curaçao', code: '+599' },
  { iso: 'CY', name: 'Cyprus', code: '+357' },
  { iso: 'CZ', name: 'Czechia', code: '+420' },
  { iso: 'CD', name: 'Democratic Republic of the Congo', code: '+243' },
  { iso: 'DK', name: 'Denmark', code: '+45' },
  { iso: 'DJ', name: 'Djibouti', code: '+253' },
  { iso: 'DM', name: 'Dominica', code: '+1' },
  { iso: 'DO', name: 'Dominican Republic', code: '+1' },
  { iso: 'EC', name: 'Ecuador', code: '+593' },
  { iso: 'EG', name: 'Egypt', code: '+20' },
  { iso: 'SV', name: 'El Salvador', code: '+503' },
  { iso: 'GQ', name: 'Equatorial Guinea', code: '+240' },
  { iso: 'ER', name: 'Eritrea', code: '+291' },
  { iso: 'EE', name: 'Estonia', code: '+372' },
  { iso: 'SZ', name: 'Eswatini', code: '+268' },
  { iso: 'ET', name: 'Ethiopia', code: '+251' },
  { iso: 'FK', name: 'Falkland Islands', code: '+500' },
  { iso: 'FO', name: 'Faroe Islands', code: '+298' },
  { iso: 'FJ', name: 'Fiji', code: '+679' },
  { iso: 'FI', name: 'Finland', code: '+358' },
  { iso: 'FR', name: 'France', code: '+33' },
  { iso: 'GF', name: 'French Guiana', code: '+594' },
  { iso: 'PF', name: 'French Polynesia', code: '+689' },
  { iso: 'GA', name: 'Gabon', code: '+241' },
  { iso: 'GM', name: 'Gambia', code: '+220' },
  { iso: 'GE', name: 'Georgia', code: '+995' },
  { iso: 'DE', name: 'Germany', code: '+49' },
  { iso: 'GH', name: 'Ghana', code: '+233' },
  { iso: 'GI', name: 'Gibraltar', code: '+350' },
  { iso: 'GR', name: 'Greece', code: '+30' },
  { iso: 'GL', name: 'Greenland', code: '+299' },
  { iso: 'GD', name: 'Grenada', code: '+1' },
  { iso: 'GP', name: 'Guadeloupe', code: '+590' },
  { iso: 'GU', name: 'Guam', code: '+1' },
  { iso: 'GT', name: 'Guatemala', code: '+502' },
  { iso: 'GG', name: 'Guernsey', code: '+44' },
  { iso: 'GN', name: 'Guinea', code: '+224' },
  { iso: 'GW', name: 'Guinea-Bissau', code: '+245' },
  { iso: 'GY', name: 'Guyana', code: '+592' },
  { iso: 'HT', name: 'Haiti', code: '+509' },
  { iso: 'HN', name: 'Honduras', code: '+504' },
  { iso: 'HK', name: 'Hong Kong', code: '+852' },
  { iso: 'HU', name: 'Hungary', code: '+36' },
  { iso: 'IS', name: 'Iceland', code: '+354' },
  { iso: 'IN', name: 'India', code: '+91' },
  { iso: 'ID', name: 'Indonesia', code: '+62' },
  { iso: 'IR', name: 'Iran', code: '+98' },
  { iso: 'IQ', name: 'Iraq', code: '+964' },
  { iso: 'IE', name: 'Ireland', code: '+353' },
  { iso: 'IM', name: 'Isle of Man', code: '+44' },
  { iso: 'IL', name: 'Israel', code: '+972' },
  { iso: 'IT', name: 'Italy', code: '+39' },
  { iso: 'JM', name: 'Jamaica', code: '+1' },
  { iso: 'JP', name: 'Japan', code: '+81' },
  { iso: 'JE', name: 'Jersey', code: '+44' },
  { iso: 'JO', name: 'Jordan', code: '+962' },
  { iso: 'KZ', name: 'Kazakhstan', code: '+7' },
  { iso: 'KE', name: 'Kenya', code: '+254' },
  { iso: 'KI', name: 'Kiribati', code: '+686' },
  { iso: 'XK', name: 'Kosovo', code: '+383' },
  { iso: 'KW', name: 'Kuwait', code: '+965' },
  { iso: 'KG', name: 'Kyrgyzstan', code: '+996' },
  { iso: 'LA', name: 'Laos', code: '+856' },
  { iso: 'LV', name: 'Latvia', code: '+371' },
  { iso: 'LB', name: 'Lebanon', code: '+961' },
  { iso: 'LS', name: 'Lesotho', code: '+266' },
  { iso: 'LR', name: 'Liberia', code: '+231' },
  { iso: 'LY', name: 'Libya', code: '+218' },
  { iso: 'LI', name: 'Liechtenstein', code: '+423' },
  { iso: 'LT', name: 'Lithuania', code: '+370' },
  { iso: 'LU', name: 'Luxembourg', code: '+352' },
  { iso: 'MO', name: 'Macau', code: '+853' },
  { iso: 'MG', name: 'Madagascar', code: '+261' },
  { iso: 'MW', name: 'Malawi', code: '+265' },
  { iso: 'MY', name: 'Malaysia', code: '+60' },
  { iso: 'MV', name: 'Maldives', code: '+960' },
  { iso: 'ML', name: 'Mali', code: '+223' },
  { iso: 'MT', name: 'Malta', code: '+356' },
  { iso: 'MH', name: 'Marshall Islands', code: '+692' },
  { iso: 'MQ', name: 'Martinique', code: '+596' },
  { iso: 'MR', name: 'Mauritania', code: '+222' },
  { iso: 'MU', name: 'Mauritius', code: '+230' },
  { iso: 'YT', name: 'Mayotte', code: '+262' },
  { iso: 'MX', name: 'Mexico', code: '+52' },
  { iso: 'FM', name: 'Micronesia', code: '+691' },
  { iso: 'MD', name: 'Moldova', code: '+373' },
  { iso: 'MC', name: 'Monaco', code: '+377' },
  { iso: 'MN', name: 'Mongolia', code: '+976' },
  { iso: 'ME', name: 'Montenegro', code: '+382' },
  { iso: 'MS', name: 'Montserrat', code: '+1' },
  { iso: 'MA', name: 'Morocco', code: '+212' },
  { iso: 'MZ', name: 'Mozambique', code: '+258' },
  { iso: 'MM', name: 'Myanmar', code: '+95' },
  { iso: 'NA', name: 'Namibia', code: '+264' },
  { iso: 'NR', name: 'Nauru', code: '+674' },
  { iso: 'NP', name: 'Nepal', code: '+977' },
  { iso: 'NL', name: 'Netherlands', code: '+31' },
  { iso: 'NC', name: 'New Caledonia', code: '+687' },
  { iso: 'NZ', name: 'New Zealand', code: '+64' },
  { iso: 'NI', name: 'Nicaragua', code: '+505' },
  { iso: 'NE', name: 'Niger', code: '+227' },
  { iso: 'NG', name: 'Nigeria', code: '+234' },
  { iso: 'NU', name: 'Niue', code: '+683' },
  { iso: 'NF', name: 'Norfolk Island', code: '+672' },
  { iso: 'KP', name: 'North Korea', code: '+850' },
  { iso: 'MK', name: 'North Macedonia', code: '+389' },
  { iso: 'MP', name: 'Northern Mariana Islands', code: '+1' },
  { iso: 'NO', name: 'Norway', code: '+47' },
  { iso: 'OM', name: 'Oman', code: '+968' },
  { iso: 'PK', name: 'Pakistan', code: '+92' },
  { iso: 'PW', name: 'Palau', code: '+680' },
  { iso: 'PS', name: 'Palestine', code: '+970' },
  { iso: 'PA', name: 'Panama', code: '+507' },
  { iso: 'PG', name: 'Papua New Guinea', code: '+675' },
  { iso: 'PY', name: 'Paraguay', code: '+595' },
  { iso: 'PE', name: 'Peru', code: '+51' },
  { iso: 'PH', name: 'Philippines', code: '+63' },
  { iso: 'PL', name: 'Poland', code: '+48' },
  { iso: 'PT', name: 'Portugal', code: '+351' },
  { iso: 'PR', name: 'Puerto Rico', code: '+1' },
  { iso: 'QA', name: 'Qatar', code: '+974' },
  { iso: 'CG', name: 'Republic of the Congo', code: '+242' },
  { iso: 'RE', name: 'Réunion', code: '+262' },
  { iso: 'RO', name: 'Romania', code: '+40' },
  { iso: 'RU', name: 'Russia', code: '+7' },
  { iso: 'RW', name: 'Rwanda', code: '+250' },
  { iso: 'BL', name: 'Saint Barthélemy', code: '+590' },
  { iso: 'SH', name: 'Saint Helena', code: '+290' },
  { iso: 'KN', name: 'Saint Kitts and Nevis', code: '+1' },
  { iso: 'LC', name: 'Saint Lucia', code: '+1' },
  { iso: 'MF', name: 'Saint Martin', code: '+590' },
  { iso: 'PM', name: 'Saint Pierre and Miquelon', code: '+508' },
  { iso: 'VC', name: 'Saint Vincent and the Grenadines', code: '+1' },
  { iso: 'WS', name: 'Samoa', code: '+685' },
  { iso: 'SM', name: 'San Marino', code: '+378' },
  { iso: 'ST', name: 'São Tomé and Príncipe', code: '+239' },
  { iso: 'SA', name: 'Saudi Arabia', code: '+966' },
  { iso: 'SN', name: 'Senegal', code: '+221' },
  { iso: 'RS', name: 'Serbia', code: '+381' },
  { iso: 'SC', name: 'Seychelles', code: '+248' },
  { iso: 'SL', name: 'Sierra Leone', code: '+232' },
  { iso: 'SG', name: 'Singapore', code: '+65' },
  { iso: 'SX', name: 'Sint Maarten', code: '+1' },
  { iso: 'SK', name: 'Slovakia', code: '+421' },
  { iso: 'SI', name: 'Slovenia', code: '+386' },
  { iso: 'SB', name: 'Solomon Islands', code: '+677' },
  { iso: 'SO', name: 'Somalia', code: '+252' },
  { iso: 'ZA', name: 'South Africa', code: '+27' },
  { iso: 'KR', name: 'South Korea', code: '+82' },
  { iso: 'SS', name: 'South Sudan', code: '+211' },
  { iso: 'ES', name: 'Spain', code: '+34' },
  { iso: 'LK', name: 'Sri Lanka', code: '+94' },
  { iso: 'SD', name: 'Sudan', code: '+249' },
  { iso: 'SR', name: 'Suriname', code: '+597' },
  { iso: 'SJ', name: 'Svalbard and Jan Mayen', code: '+47' },
  { iso: 'SE', name: 'Sweden', code: '+46' },
  { iso: 'CH', name: 'Switzerland', code: '+41' },
  { iso: 'SY', name: 'Syria', code: '+963' },
  { iso: 'TW', name: 'Taiwan', code: '+886' },
  { iso: 'TJ', name: 'Tajikistan', code: '+992' },
  { iso: 'TZ', name: 'Tanzania', code: '+255' },
  { iso: 'TH', name: 'Thailand', code: '+66' },
  { iso: 'TL', name: 'Timor-Leste', code: '+670' },
  { iso: 'TG', name: 'Togo', code: '+228' },
  { iso: 'TK', name: 'Tokelau', code: '+690' },
  { iso: 'TO', name: 'Tonga', code: '+676' },
  { iso: 'TT', name: 'Trinidad and Tobago', code: '+1' },
  { iso: 'TN', name: 'Tunisia', code: '+216' },
  { iso: 'TR', name: 'Türkiye', code: '+90' },
  { iso: 'TM', name: 'Turkmenistan', code: '+993' },
  { iso: 'TC', name: 'Turks and Caicos Islands', code: '+1' },
  { iso: 'TV', name: 'Tuvalu', code: '+688' },
  { iso: 'UG', name: 'Uganda', code: '+256' },
  { iso: 'UA', name: 'Ukraine', code: '+380' },
  { iso: 'AE', name: 'United Arab Emirates', code: '+971' },
  { iso: 'GB', name: 'United Kingdom', code: '+44' },
  { iso: 'US', name: 'United States', code: '+1' },
  { iso: 'UY', name: 'Uruguay', code: '+598' },
  { iso: 'VI', name: 'US Virgin Islands', code: '+1' },
  { iso: 'UZ', name: 'Uzbekistan', code: '+998' },
  { iso: 'VU', name: 'Vanuatu', code: '+678' },
  { iso: 'VA', name: 'Vatican City', code: '+39' },
  { iso: 'VE', name: 'Venezuela', code: '+58' },
  { iso: 'VN', name: 'Vietnam', code: '+84' },
  { iso: 'WF', name: 'Wallis and Futuna', code: '+681' },
  { iso: 'EH', name: 'Western Sahara', code: '+212' },
  { iso: 'YE', name: 'Yemen', code: '+967' },
  { iso: 'ZM', name: 'Zambia', code: '+260' },
  { iso: 'ZW', name: 'Zimbabwe', code: '+263' },
];

/** Distinct calling codes, longest first — the order `splitPhoneNumber` needs. */
const CODES_LONGEST_FIRST: ReadonlyArray<string> = [
  ...new Set(PHONE_PREFIXES.map((p) => p.code)),
].sort((a, b) => b.length - a.length);

/** The first country listed for a code, for labelling a picked prefix. */
const COUNTRY_BY_CODE = new Map<string, PhonePrefix>();
for (const p of PHONE_PREFIXES) if (!COUNTRY_BY_CODE.has(p.code)) COUNTRY_BY_CODE.set(p.code, p);

/** Whether `code` (with leading "+") is an assigned calling code. */
export function isKnownPhonePrefix(code: string): boolean {
  return COUNTRY_BY_CODE.has(code);
}

/** The representative country for a calling code, or undefined if unassigned. */
export function countryForPrefix(code: string): PhonePrefix | undefined {
  return COUNTRY_BY_CODE.get(code);
}

/**
 * Split a stored phone into its calling code and national number.
 *
 * Accepts "+39 333 1231231", "0039 333 1231231" and bare national numbers;
 * anything without a recognisable code falls back to `DEFAULT_PHONE_PREFIX`
 * with all digits kept as the national part.
 */
export function splitPhoneNumber(
  phone: string,
  fallbackPrefix: string = DEFAULT_PHONE_PREFIX,
): { prefix: string; national: string } {
  const trimmed = (phone ?? '').trim();
  const digits = trimmed.replace(/\D/g, '');
  const hasPlus = trimmed.startsWith('+');
  const hasZeroZero = !hasPlus && digits.startsWith('00');
  if (hasPlus || hasZeroZero) {
    const intl = hasZeroZero ? digits.slice(2) : digits;
    for (const code of CODES_LONGEST_FIRST) {
      if (intl.startsWith(code.slice(1))) {
        return { prefix: code, national: intl.slice(code.length - 1) };
      }
    }
  }
  return { prefix: fallbackPrefix, national: digits };
}

/** Options for a picker: the common markets first, then everything else. */
export function phonePrefixOptions(): {
  common: PhonePrefix[];
  rest: PhonePrefix[];
} {
  const commons = new Set<string>(COMMON_PREFIX_ISOS);
  return {
    common: COMMON_PREFIX_ISOS.map(
      (iso) => PHONE_PREFIXES.find((p) => p.iso === iso)!,
    ),
    rest: PHONE_PREFIXES.filter((p) => !commons.has(p.iso)),
  };
}

/** Drop diacritics so "Turkiye" finds "Türkiye" and vice versa. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Case/accent-insensitive match on country name, ISO code or calling code. */
export function matchesPrefixQuery(p: PhonePrefix, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  return (
    fold(p.name).includes(q) ||
    p.iso.toLowerCase() === q ||
    (!!digits && p.code.slice(1).startsWith(digits))
  );
}
