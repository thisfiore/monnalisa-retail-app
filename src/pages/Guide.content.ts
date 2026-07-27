// Bilingual copy for the public store-staff guide (/guida). Kept apart from the
// page component so the wording can be edited without touching layout code.
//
// Screenshots live in public/img/guide/ (deliberately NOT public/guide/, which
// would shadow the /guide route on Vercel's filesystem check) and are captured
// from the real app against the staging CRM using a purpose-made demo record
// (Giulia Bianchi) — never a real customer, because this page is public.
// How to capture and redact replacements: docs/guide-screenshots.md.
//
// The copy carries inline markup, rendered by renderRich() in Guide.tsx:
//
//   [[Save]]   something on screen you click or type into — button, field, tab
//   **text**   an important word or phrase
//   ==text==   the one thing in a step you must not get wrong
//
// **...** and ==...== may contain a chip; [[...]] is always literal. `alt` text
// takes no markup at all — it is read out as plain text by screen readers.
// Keep ==...== rare: at most one or two per step, or it stops meaning anything.

export type Lang = 'it' | 'en';

export interface Shot {
  src: string;
  /** Caption under the image. */
  caption: string;
  /** Alt text for screen readers. */
  alt: string;
}

export interface Step {
  /** Anchor id, shared across languages so a deep link survives a lang switch. */
  id: string;
  number: number;
  title: string;
  intro: string;
  /** Numbered instructions, in order. */
  actions: string[];
  shots: Shot[];
  /** Optional highlighted note at the end of the step. */
  note?: string;
}

export interface GuideContent {
  langLabel: string;
  title: string;
  subtitle: string;
  intro: string;
  tocTitle: string;
  steps: Step[];
  helpTitle: string;
  helpBody: string;
  backToTop: string;
  printLabel: string;
}

export const CONTENT: Record<Lang, GuideContent> = {
  it: {
    langLabel: 'Italiano',
    title: 'Guida rapida',
    subtitle: 'Monnalisa · Retail Loyalty Platform',
    intro:
      'Quattro cose da sapere per usare l’app in negozio. Ogni passo ha le **schermate reali** dell’app: segui le immagini, non serve altro.',
    tocTitle: 'In questa guida',
    printLabel: 'Stampa',
    backToTop: 'Torna su',
    steps: [
      {
        id: 'login',
        number: 1,
        title: 'Accedere all’app',
        intro:
          'Ogni negozio ha il proprio account. Entrando, l’app sa già **in quale negozio ti trovi**.',
        actions: [
          'Apri l’app dal browser del tablet o del computer del negozio.',
          'Inserisci l’[[Email]] del negozio e la [[Password]] che ti sono state consegnate.',
          'Premi [[Sign In]].',
        ],
        shots: [
          {
            src: '/img/guide/01-login.jpg',
            caption: 'La schermata di accesso.',
            alt: 'Schermata di accesso con i campi Email e Password e il pulsante Sign In',
          },
          {
            src: '/img/guide/01-dashboard.jpg',
            caption:
              'Dopo l’accesso vedi la **Dashboard**: i clienti registrati questa settimana e la settimana scorsa.',
            alt: 'Dashboard con i contatori This Week e Last Week e l’elenco dei clienti registrati',
          },
        ],
        note:
          'Se sbagli password l’app te lo dice subito. Se l’accesso continua a non funzionare, avvisa il tuo responsabile: ==non creare un secondo account==.',
      },
      {
        id: 'cerca',
        number: 2,
        title: 'Cercare un cliente',
        intro:
          '==Prima di registrare qualcuno, cercalo sempre.== Serve a non creare due volte lo stesso cliente. La barra di ricerca è in alto ed è disponibile in ogni pagina.',
        actions: [
          'Clicca sulla **barra di ricerca** in alto.',
          'Scrivi il **nome**, il **numero di telefono** oppure l’**email** del cliente.',
          'Aspetta un istante: i risultati compaiono da soli mentre scrivi.',
          'Se trovi il cliente, **clicca sul suo nome** per aprire la scheda.',
          'Se non compare nessuno, clicca su [[+ Create New Customer]] per registrarlo (vedi il **passo 4**).',
        ],
        shots: [
          {
            src: '/img/guide/02-search-found.jpg',
            caption:
              'Cliente trovato: la parte di testo che corrisponde alla ricerca è **evidenziata in rosa**.',
            alt: 'Barra di ricerca con un risultato: Giulia Bianchi, con email e telefono',
          },
          {
            src: '/img/guide/02-search-notfound.jpg',
            caption:
              'Nessun risultato: da qui puoi creare subito il nuovo cliente.',
            alt: 'Ricerca senza risultati con il pulsante Create New Customer',
          },
        ],
        note:
          'Cerca prima per **email** o **telefono**: sono dati unici e trovano il cliente giusto anche se il nome è scritto in modo diverso.',
      },
      {
        id: 'aggiorna',
        number: 3,
        title: 'Aggiornare un cliente esistente',
        intro:
          'Dalla scheda del cliente puoi correggere i dati, aggiungere il telefono mancante, inserire i figli o modificare i consensi.',
        actions: [
          'Trova il cliente con la ricerca e apri la sua scheda.',
          'In alto a destra clicca su [[Edit]].',
          'Modifica i campi che ti servono. ==L’email non si può cambiare==: identifica il cliente.',
          'Per aggiungere un figlio clicca [[+ Add Child]] e compila **nome**, **data di nascita**, **sesso**, **altezza** e **numero di scarpe**.',
          'Clicca [[Save]] in alto a destra.',
        ],
        shots: [
          {
            src: '/img/guide/03-profile.jpg',
            caption: 'La scheda cliente. Il pulsante [[Edit]] è in alto a destra.',
            alt: 'Scheda cliente di Giulia Bianchi con il pulsante Edit in alto a destra',
          },
          {
            src: '/img/guide/03-edit-form.jpg',
            caption:
              'Il modulo di modifica. L’email è in grigio perché **non è modificabile**.',
            alt: 'Modulo di modifica con email in sola lettura, telefono, nome e cognome',
          },
          {
            src: '/img/guide/03-edit-child.jpg',
            caption: 'Aggiunta di un figlio: nome, data di nascita, sesso, altezza e scarpe.',
            alt: 'Sezione Children del modulo con i dati del figlio compilati',
          },
          {
            src: '/img/guide/03-saved.jpg',
            caption:
              'Dopo il salvataggio torni alla scheda e vedi subito le modifiche.',
            alt: 'Scheda cliente aggiornata che mostra il figlio appena aggiunto',
          },
        ],
        note:
          'Se il telefono manca, l’app lo segnala **in arancione**. Chiedilo al cliente: serve per i messaggi del programma fedeltà.',
      },
      {
        id: 'nuovo',
        number: 4,
        title: 'Registrare un nuovo cliente',
        intro:
          'Da fare **solo dopo** aver cercato il cliente e aver verificato che non esiste già.',
        actions: [
          'Clicca [[+ New Customer]] in alto a destra nella Dashboard (oppure [[+ Create New Customer]] dalla ricerca).',
          '**Passo 1 — Verify Identity**: scrivi email e telefono. L’app controlla da sola se esistono già.',
          'Aspetta la ==spunta verde [[Available]] su entrambi i campi== prima di continuare.',
          '**Passo 2 — Customer Information**: nome, cognome, data di nascita, indirizzo, città, CAP e paese.',
          '**Passo 3 — Children**: se il cliente ha figli, aggiungili con [[+ Add Child]]. È facoltativo.',
          '**Passo 4 — Consents**: attiva i consensi che il cliente ti conferma a voce.',
          'Clicca [[Register Customer]] in fondo alla pagina.',
        ],
        shots: [
          {
            src: '/img/guide/04-new-form.jpg',
            caption:
              'Spunta verde [[Available]] su email e telefono: puoi procedere.',
            alt: 'Modulo nuovo cliente con email e telefono contrassegnati come Available',
          },
          {
            src: '/img/guide/04-consents.jpg',
            caption:
              'I consensi. Il consenso privacy è automatico tramite l’email di conferma.',
            alt: 'Sezione consensi con Loyalty Program Enrollment e Marketing Consent attivi',
          },
          {
            src: '/img/guide/04-success.jpg',
            caption:
              'Cliente registrato: l’app apre da sola la sua scheda.',
            alt: 'Messaggio verde di conferma: Customer registered successfully',
          },
        ],
        note:
          '==Se compare il riquadro arancione **Already exists**, il cliente c’è già==: clicca [[Open]] per aprire la sua scheda e aggiornala invece di crearne una nuova.',
      },
    ],
    helpTitle: 'Qualcosa non torna?',
    helpBody:
      '==Non cancellare e non ricreare i clienti== per risolvere un problema. Segnalalo al tuo responsabile indicando **cosa stavi facendo** e **cosa è comparso a schermo**.',
  },

  en: {
    langLabel: 'English',
    title: 'Quick guide',
    subtitle: 'Monnalisa · Retail Loyalty Platform',
    intro:
      'Four things you need to know to use the app in store. Every step shows **real screenshots** of the app: follow the pictures, that is all you need.',
    tocTitle: 'In this guide',
    printLabel: 'Print',
    backToTop: 'Back to top',
    steps: [
      {
        id: 'login',
        number: 1,
        title: 'Signing in',
        intro:
          'Each store has its own account. Once you sign in, the app already knows **which store you are working in**.',
        actions: [
          'Open the app in the browser on the store tablet or computer.',
          'Enter the store [[Email]] and [[Password]] you were given.',
          'Press [[Sign In]].',
        ],
        shots: [
          {
            src: '/img/guide/01-login.jpg',
            caption: 'The sign-in screen.',
            alt: 'Sign-in screen with Email and Password fields and a Sign In button',
          },
          {
            src: '/img/guide/01-dashboard.jpg',
            caption:
              'After signing in you land on the **Dashboard**: customers registered this week and last week.',
            alt: 'Dashboard with This Week and Last Week counters and the list of registered customers',
          },
        ],
        note:
          'A wrong password is flagged straight away. If you still cannot sign in, tell your manager — ==do not create a second account==.',
      },
      {
        id: 'cerca',
        number: 2,
        title: 'Searching for a customer',
        intro:
          '==Always search before you register anyone.== It stops the same customer being created twice. The search bar sits at the top of every page.',
        actions: [
          'Click the **search bar** at the top.',
          'Type the customer’s **name**, **phone number** or **email**.',
          'Wait a moment: results appear on their own as you type.',
          'If you find the customer, **click their name** to open their profile.',
          'If nobody comes up, click [[+ Create New Customer]] to register them (see **step 4**).',
        ],
        shots: [
          {
            src: '/img/guide/02-search-found.jpg',
            caption:
              'Customer found: the part of the text matching your search is **highlighted in pink**.',
            alt: 'Search bar showing one result: Giulia Bianchi, with email and phone',
          },
          {
            src: '/img/guide/02-search-notfound.jpg',
            caption: 'No results: you can create the new customer right from here.',
            alt: 'Search with no results and a Create New Customer button',
          },
        ],
        note:
          'Search by **email** or **phone** first: they are unique, so they find the right person even when the name is spelled differently.',
      },
      {
        id: 'aggiorna',
        number: 3,
        title: 'Updating an existing customer',
        intro:
          'From the customer profile you can fix details, add a missing phone number, add children, or change consents.',
        actions: [
          'Find the customer with the search and open their profile.',
          'Click [[Edit]] at the top right.',
          'Change the fields you need. ==The email cannot be changed==: it identifies the customer.',
          'To add a child click [[+ Add Child]] and fill in **name**, **birth date**, **gender**, **height** and **shoe size**.',
          'Click [[Save]] at the top right.',
        ],
        shots: [
          {
            src: '/img/guide/03-profile.jpg',
            caption: 'The customer profile. The [[Edit]] button is at the top right.',
            alt: 'Customer profile for Giulia Bianchi with the Edit button at the top right',
          },
          {
            src: '/img/guide/03-edit-form.jpg',
            caption: 'The edit form. The email is greyed out because it is **read-only**.',
            alt: 'Edit form with read-only email, phone, first name and last name',
          },
          {
            src: '/img/guide/03-edit-child.jpg',
            caption: 'Adding a child: name, birth date, gender, height and shoe size.',
            alt: 'Children section of the form with the child details filled in',
          },
          {
            src: '/img/guide/03-saved.jpg',
            caption: 'After saving you return to the profile and see the change immediately.',
            alt: 'Updated customer profile showing the child that was just added',
          },
        ],
        note:
          'If the phone number is missing, the app flags it **in amber**. Ask the customer for it: it is needed for loyalty messages.',
      },
      {
        id: 'nuovo',
        number: 4,
        title: 'Registering a new customer',
        intro:
          'Only do this **after** searching and confirming the customer does not already exist.',
        actions: [
          'Click [[+ New Customer]] at the top right of the Dashboard (or [[+ Create New Customer]] from the search).',
          '**Step 1 — Verify Identity**: type the email and phone. The app checks by itself whether they already exist.',
          'Wait for the ==green [[Available]] tick on both fields== before carrying on.',
          '**Step 2 — Customer Information**: first name, last name, date of birth, address, city, postcode and country.',
          '**Step 3 — Children**: if the customer has children, add them with [[+ Add Child]]. This is optional.',
          '**Step 4 — Consents**: switch on the consents the customer confirms to you.',
          'Click [[Register Customer]] at the bottom of the page.',
        ],
        shots: [
          {
            src: '/img/guide/04-new-form.jpg',
            caption: 'Green [[Available]] tick on email and phone: you can carry on.',
            alt: 'New customer form with email and phone marked as Available',
          },
          {
            src: '/img/guide/04-consents.jpg',
            caption:
              'The consents. Privacy consent is automatic through the confirmation email.',
            alt: 'Consents section with Loyalty Program Enrollment and Marketing Consent switched on',
          },
          {
            src: '/img/guide/04-success.jpg',
            caption: 'Customer registered: the app opens their profile by itself.',
            alt: 'Green confirmation message: Customer registered successfully',
          },
        ],
        note:
          '==If the amber **Already exists** box appears, the customer is already in the system==: click [[Open]] to go to their profile and update it instead of creating a new one.',
      },
    ],
    helpTitle: 'Something not right?',
    helpBody:
      '==Do not delete and re-create customers== to work around a problem. Report it to your manager, saying **what you were doing** and **what appeared on screen**.',
  },
};
