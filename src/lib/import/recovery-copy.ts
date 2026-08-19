/**
 * Localized copy for the public customer-recovery flow (`CustomerRecovery.tsx`).
 *
 * Only Italian and English are supported: Italian customers (it_* locale) see
 * `it`, everyone else falls back to `en`. The `RecoveryCopy` interface keeps the
 * two dictionaries structurally in sync — a missing key is a compile error.
 */

export type RecoveryLang = 'it' | 'en';

/** it_* → Italian; every other (or missing) locale → English. */
export function recoveryLang(locale: string | undefined): RecoveryLang {
  return (locale ?? '').toLowerCase().startsWith('it') ? 'it' : 'en';
}

/** A sentence broken around an inline anchor: `${before}<a>${link}</a>${after}`. */
export type LinkedText = { before: string; link: string; after: string };

export interface RecoveryCopy {
  loading: string;

  invalid: { title: string; body: string };

  /** name is the customer's first name (possibly empty). */
  doneTitle: (name: string) => string;
  doneBody: string;

  intro: {
    eyebrow: string;
    greeting: (name: string) => string;
    tagline: string;
    benefits: ReadonlyArray<{ icon: string; title: string; text: string }>;
    discoverMore: string;
    discoverMoreHref: string;
    cta: string;
  };

  /** Shared greeting used on step 1 & 2 (e.g. "Ciao Marco"/"Hi Marco"). */
  greeting: (name: string) => string;

  step1: {
    subtitleConfirm: string;
    subtitleMissing: string;
    emailLabel: string;
    emailPlaceholder: string;
    emailMissingHint: string;
    emailCheckInline: string;
    phoneLabel: string;
    phoneMissingHint: string;
    phonePlaceholder: string;
    /** Search box inside the country-calling-code picker. */
    phoneCountrySearch: string;
    joinTitle: string;
    joinDesc: string;
    marketingTitle: string;
    marketingDesc: string;
    marketingNote: LinkedText;
    privacyConsent: LinkedText;
    editLabel: string;
    saveContinue: string;
    errEmailRequired: string;
    errEmailInvalid: string;
    errPhoneRequired: string;
    errPrivacy: string;
    errGeneric: string;
  };

  step2: {
    subtitle: string;
    noChildren: string;
    childTitle: (n: number) => string;
    remove: string;
    nameLabel: string;
    dayMonthLabel: string;
    yearLabel: string;
    yearPlaceholder: string;
    genderLabel: string;
    boy: string;
    girl: string;
    addChild: string;
    skip: string;
    save: string;
  };
}

const PRIVACY_URL = 'https://www.monnalisa.com/privacy';

const en: RecoveryCopy = {
  loading: 'Loading…',
  invalid: {
    title: 'This link is no longer valid',
    body: 'It may have expired or already been used. Please contact your Monnalisa store for a new link.',
  },
  doneTitle: (name) => `Thank you${name ? `, ${name}` : ''}!`,
  doneBody:
    "Your details are saved. Welcome to Monnalisa Fun — we'll be in touch with rewards and news made for you.",
  intro: {
    eyebrow: 'Monnalisa Fun',
    greeting: (name) => (name ? `Hi ${name}!` : 'Hi there!'),
    tagline:
      'A world of exclusive benefits, dedicated surprises and special moments made for you and your children.',
    benefits: [
      {
        icon: '💖',
        title: 'Collect Fpoints',
        text: 'Every purchase, online and in store, brings you closer to new privileges and exclusive tiers.',
      },
      {
        icon: '🌸',
        title: 'Made for your children',
        text: 'Dedicated surprises and special occasions to celebrate the best moments of their growing up.',
      },
      {
        icon: '💌',
        title: 'Members-only access',
        text: 'News, events and special content to experience the Monnalisa world even more closely.',
      },
    ],
    discoverMore: 'Discover more →',
    discoverMoreHref: 'https://www.monnalisa.com/en-en/discover-monnalisa-fun.html',
    cta: 'Get started',
  },
  greeting: (name) => (name ? `Hi ${name}` : 'Welcome'),
  step1: {
    subtitleConfirm: 'Please confirm your details below — it only takes a moment.',
    subtitleMissing: "We're just missing one detail to keep your Monnalisa profile up to date.",
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    emailMissingHint: "We don't have your email yet — please add it.",
    emailCheckInline: 'Check this email',
    phoneLabel: 'Mobile number',
    phoneMissingHint: "We don't have your number yet — please add it.",
    phonePlaceholder: '123 456 7890',
    phoneCountrySearch: 'Search country or code',
    joinTitle: 'Join Monnalisa Fun',
    joinDesc:
      'Earn rewards on every purchase, plus members-only perks for you and your children.',
    marketingTitle: 'Keep me updated on my event invitations & loyalty opportunities',
    marketingDesc:
      'Personal invitations to in-store events, early access to new collections, and birthday surprises for your little ones.',
    marketingNote: {
      before: 'Includes occasional commercial communications — you can unsubscribe anytime. See our ',
      link: 'communications policy',
      after: '.',
    },
    privacyConsent: {
      before: 'I have read and accept the ',
      link: 'privacy policy',
      after: '.',
    },
    editLabel: 'Edit',
    saveContinue: 'Save & continue',
    errEmailRequired: 'Please enter a valid email address.',
    errEmailInvalid: 'That email address looks incorrect.',
    errPhoneRequired: 'Please enter your mobile number.',
    errPrivacy: 'Please accept the privacy policy to continue.',
    errGeneric: 'Something went wrong — please try again.',
  },
  step2: {
    subtitle: 'Tell us about your little ones so we can tailor sizes and birthday surprises.',
    noChildren: "No children added yet. Add one below — it's optional.",
    childTitle: (n) => `Child ${n}`,
    remove: 'Remove',
    nameLabel: 'Name (optional)',
    dayMonthLabel: 'Day / Month',
    yearLabel: 'Year',
    yearPlaceholder: 'e.g. 2018',
    genderLabel: 'Boy or girl?',
    boy: 'Boy',
    girl: 'Girl',
    addChild: '+ Add a child',
    skip: 'Skip',
    save: 'Save',
  },
};

const it: RecoveryCopy = {
  loading: 'Caricamento…',
  invalid: {
    title: 'Questo link non è più valido',
    body: 'Potrebbe essere scaduto o già utilizzato. Contatta il tuo store Monnalisa per ricevere un nuovo link.',
  },
  doneTitle: (name) => `Grazie${name ? `, ${name}` : ''}!`,
  doneBody:
    'I tuoi dati sono stati salvati. Benvenuto in Monnalisa Fun — ti aggiorneremo con vantaggi e novità pensati per te.',
  intro: {
    eyebrow: 'Monnalisa Fun',
    greeting: (name) => (name ? `Ciao ${name}!` : 'Ciao!'),
    tagline:
      'Un mondo di vantaggi esclusivi, sorprese dedicate e momenti speciali pensati per te e per i tuoi bambini.',
    benefits: [
      {
        icon: '💖',
        title: 'Colleziona Fpoints',
        text: 'Ogni acquisto online e in store ti avvicina a nuovi privilegi e livelli esclusivi.',
      },
      {
        icon: '🌸',
        title: 'Pensato per i tuoi bambini',
        text: 'Sorprese dedicate e occasioni speciali per celebrare i momenti più belli della loro crescita.',
      },
      {
        icon: '💌',
        title: 'Accessi riservati',
        text: 'Novità, eventi e contenuti speciali per vivere ancora più da vicino l’universo Monnalisa.',
      },
    ],
    discoverMore: 'Scopri di più →',
    discoverMoreHref: 'https://www.monnalisa.com/it-it/discover-monnalisa-fun.html',
    cta: 'Iniziamo',
  },
  greeting: (name) => (name ? `Ciao ${name}` : 'Benvenuto'),
  step1: {
    subtitleConfirm: 'Conferma i tuoi dati qui sotto — bastano pochi secondi.',
    subtitleMissing: 'Ci manca solo un dettaglio per tenere aggiornato il tuo profilo Monnalisa.',
    emailLabel: 'Email',
    emailPlaceholder: 'tu@esempio.com',
    emailMissingHint: 'Non abbiamo ancora la tua email — aggiungila qui.',
    emailCheckInline: 'Controlla questa email',
    phoneLabel: 'Numero di cellulare',
    phoneMissingHint: 'Non abbiamo ancora il tuo numero — aggiungilo qui.',
    phonePlaceholder: '123 456 7890',
    phoneCountrySearch: 'Cerca paese o prefisso',
    joinTitle: 'Iscriviti a Monnalisa Fun',
    joinDesc:
      'Accumula vantaggi a ogni acquisto, con privilegi riservati per te e i tuoi bambini.',
    marketingTitle: 'Tienimi aggiornato su inviti agli eventi e opportunità loyalty',
    marketingDesc:
      'Inviti personali a eventi in store, anteprime sulle nuove collezioni e sorprese di compleanno per i tuoi bambini.',
    marketingNote: {
      before:
        'Include comunicazioni commerciali occasionali — puoi annullare l’iscrizione in qualsiasi momento. Consulta la nostra ',
      link: 'normativa sulle comunicazioni',
      after: '.',
    },
    privacyConsent: {
      before: 'Ho letto e accetto la ',
      link: 'privacy policy',
      after: '.',
    },
    editLabel: 'Modifica',
    saveContinue: 'Salva e continua',
    errEmailRequired: 'Inserisci un indirizzo email valido.',
    errEmailInvalid: 'L’indirizzo email non sembra corretto.',
    errPhoneRequired: 'Inserisci il tuo numero di cellulare.',
    errPrivacy: 'Accetta la privacy policy per continuare.',
    errGeneric: 'Qualcosa è andato storto — riprova.',
  },
  step2: {
    subtitle: 'Raccontaci dei tuoi bambini per personalizzare taglie e sorprese di compleanno.',
    noChildren: 'Nessun bambino aggiunto. Aggiungine uno qui sotto — è facoltativo.',
    childTitle: (n) => `Bambino ${n}`,
    remove: 'Rimuovi',
    nameLabel: 'Nome (facoltativo)',
    dayMonthLabel: 'Giorno / Mese',
    yearLabel: 'Anno',
    yearPlaceholder: 'es. 2018',
    genderLabel: 'Maschio o femmina?',
    boy: 'Maschio',
    girl: 'Femmina',
    addChild: '+ Aggiungi un bambino',
    skip: 'Salta',
    save: 'Salva',
  },
};

export const RECOVERY_COPY: Record<RecoveryLang, RecoveryCopy> = { it, en };

/** Resolve the copy bundle for a customer locale. */
export function recoveryCopy(locale: string | undefined): RecoveryCopy {
  return RECOVERY_COPY[recoveryLang(locale)];
}

export { PRIVACY_URL };
