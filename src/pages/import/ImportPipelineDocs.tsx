import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/Button';

/**
 * Internal explainer for the legacy-CSV → loyalty-CRM import pipeline.
 *
 * Mirrors the style of the UAT page (/uat): a self-contained, login-gated
 * reference that documents the programmatic + AI normalization steps, the
 * manager review queue, and the customer self-validation page. Pure content —
 * no data fetching.
 */

/* ------------------------------------------------------------------ data */

type Stage = {
  key: string;
  n: string;
  title: string;
  who: string;
  tint: string; // tailwind classes for the card
  dot: string; // tailwind bg for the number chip
  blurb: string;
};

const STAGES: Stage[] = [
  {
    key: 'parse',
    n: '1',
    title: 'Programmatic normalization',
    who: 'Automatic · rule-based',
    tint: 'bg-blue-50 border-blue-200',
    dot: 'bg-blue-600',
    blurb:
      'Parse the legacy CSV, split names, clean email/phone, parse dates, dedup by customer id, and resolve a preferred-language locale from the strongest available signal.',
  },
  {
    key: 'ai',
    n: '2',
    title: 'AI recovery pass',
    who: 'On-demand · gpt-4o-mini',
    tint: 'bg-purple-50 border-purple-200',
    dot: 'bg-purple-600',
    blurb:
      'For records the rules can’t finish, an LLM repairs typos, infers the right locale from the name’s semantics, and suggests what the manager should still collect — without inventing data.',
  },
  {
    key: 'review',
    n: '3',
    title: 'Manager review queue',
    who: 'Store manager',
    tint: 'bg-amber-50 border-amber-200',
    dot: 'bg-amber-600',
    blurb:
      'Each record gets a status. The manager edits fields, runs the AI repair, checks for a CRM duplicate, and either approves it or sends the customer a self-fix link.',
  },
  {
    key: 'recover',
    n: '4',
    title: 'Customer self-validation',
    who: 'Customer · public link',
    tint: 'bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-600',
    blurb:
      'A token-gated mobile page where the customer confirms or fills their email + phone, gives consents, and (optionally) adds their children. Submissions write straight back onto the record.',
  },
  {
    key: 'crm',
    n: '5',
    title: 'Create in CRM',
    who: 'Salesforce BFF',
    tint: 'bg-gray-100 border-gray-300',
    dot: 'bg-gray-800',
    blurb:
      'Once valid (email + E.164 phone), the manager approves and the record is pushed to the loyalty CRM with its store_id, locale and consents.',
  },
];

type Rule = { field: string; rule: string };

const PROGRAMMATIC_RULES: Rule[] = [
  {
    field: 'CSV parse',
    rule: 'Split the “;”-delimited legacy export, drop the trailing “Total” summary row, flag malformed rows as corrupted.',
  },
  {
    field: 'Name',
    rule: 'Legacy format is “LASTNAME FIRSTNAME” → title-cased first/last (keeps O’Connor; a single token becomes the last name).',
  },
  {
    field: 'Email',
    rule: 'Lower-case + trim; the “-” placeholder becomes empty; a value with “@” that landed in the phone column is dropped.',
  },
  {
    field: 'Phone',
    rule: 'Strip to digits, keep a leading “+” → best-effort E.164. Bare Italian mobiles (start with 3) are kept as-is.',
  },
  {
    field: 'Dates & birthdays',
    rule: 'DD/MM/YYYY → ISO. COMPLEANNO 1/2 → a child’s day/month; the “2026” placeholder year is flagged year-unknown.',
  },
  {
    field: 'Dedup & merge',
    rule: 'Group by CUSTOMER ID, keep the freshest row as primary, backfill empty email/phone/children from older rows, mark cross-store duplicates.',
  },
  {
    field: 'Locale',
    rule: 'Resolved by signal priority (see ladder below) — never assumed from the store country alone.',
  },
];

const LOCALE_LADDER: { n: string; label: string; detail: string; out: string; tint: string }[] = [
  {
    n: '1',
    label: 'Phone country code',
    detail: 'An explicit “+CC” / “00CC” on any phone is the customer’s real number.',
    out: '+39→it_IT, +33→fr_FR, +44→en_GB …',
    tint: 'border-green-300 bg-green-50',
  },
  {
    n: '2',
    label: 'Name script',
    detail: 'A non-Latin name is not an Italian, even at an Italian store.',
    out: 'Han→zh_CN · Kana→ja_JP · Cyrillic/Arabic→en_GB',
    tint: 'border-blue-300 bg-blue-50',
  },
  {
    n: '3',
    label: 'Store-country evidence',
    detail:
      'At Italy / San Marino stores we REQUIRE positive Italian evidence (an Italian-format mobile). Other store countries are trusted as a prior.',
    out: 'Italian mobile→it_IT · US store→en_US · China store→zh_CN',
    tint: 'border-amber-300 bg-amber-50',
  },
  {
    n: '4',
    label: 'Fallback',
    detail: 'No usable signal → English, never Italian. This is the AI pass’s main queue.',
    out: '→ en_GB',
    tint: 'border-gray-300 bg-gray-50',
  },
];

const AI_FIXES: string[] = [
  'Email typos — “gmial.com” → “gmail.com”, stray whitespace, trailing dots.',
  'Locale from name semantics — “Schockaert”→Flemish→en_GB, “Rossi”→it_IT, “Dupont”→fr_FR. This is the main job when localeSource = “fallback”.',
  'Phone country code inferred from the customer’s likely country (name / other phone) — NOT from the store location.',
  'Name capitalization the title-caser missed — “Mc Donald” → “McDonald”.',
];

const AI_CONSTRAINTS: string[] = [
  'Never invent data — a missing email/phone stays empty; instead it lists what the manager should collect.',
  'Supported locales only (it_IT, it_CH, en_US, en_GB, fr_FR, fr_CH, de_DE, de_CH, es_ES, zh_CN, ja_JP); anything else is coerced to en_GB.',
  'Never fabricate children data (name, height, shoe size are never in the source).',
  'A locale change must be explained in the reasoning; flags “hopeless” only when there’s no way forward without contacting the customer.',
];

type StatusRow = { status: string; tint: string; meaning: string };

const STATUSES: StatusRow[] = [
  { status: 'review', tint: 'bg-yellow-100 text-yellow-800', meaning: 'Missing or ambiguous fields — needs a manager (or the customer) to finish it.' },
  { status: 'ready', tint: 'bg-green-100 text-green-800', meaning: 'Valid email + E.164 phone + confident locale — can be pushed as-is.' },
  { status: 'blocked', tint: 'bg-red-100 text-red-800', meaning: 'No email AND no phone — unreachable until contact data is recovered.' },
  { status: 'duplicate', tint: 'bg-orange-100 text-orange-800', meaning: 'Already exists in the CRM (matched by email or phone).' },
  { status: 'created', tint: 'bg-emerald-100 text-emerald-800', meaning: 'Successfully pushed to the loyalty CRM.' },
  { status: 'failed', tint: 'bg-rose-100 text-rose-800', meaning: 'A create was attempted but the API errored — see lastError.' },
  { status: 'skipped', tint: 'bg-gray-100 text-gray-600', meaning: 'The manager explicitly dropped the record.' },
];

const MANAGER_ACTIONS: { action: string; detail: string }[] = [
  { action: 'Edit & save draft', detail: 'Hand-correct any field; the locale picker shows how it was auto-derived and why.' },
  { action: 'Run AI repair', detail: 'Calls the gpt-4o-mini pass; applies patches and shows AI notes + confidence.' },
  { action: 'Check CRM duplicate', detail: 'checkEmailExists / checkPhoneExists; flips the record to “duplicate” on a hit.' },
  { action: 'Send recovery link', detail: 'Mints a 30-day token link the customer opens to self-fix (or previews it).' },
  { action: 'Mark contacted', detail: 'Notes that the manager phoned the customer.' },
  { action: 'Approve & create', detail: 'Validates email + E.164 phone, then POSTs createAccount with store_id, locale and consents.' },
];

/* ----------------------------------------------------- stats (real data) */

// Legacy full export, deduped to 90,607 contacts.
const DB_HEADLINE = [
  { label: 'Contacts in legacy DB', value: '90,607' },
  { label: 'Without email', value: '76,693', sub: '84.6%' },
  { label: 'Active · last 5 yrs', value: '67,107', sub: '74.1%' },
  { label: 'Active · last 12 mo', value: '12,087', sub: '13.3%' },
];

// Of the 12,087 active (last 12 mo) customers.
const ACTIVE_EMAIL_SPLIT = [
  { label: 'Active & WITHOUT email (in scope)', n: 10560, pct: 87.4, tint: 'bg-amber-500' },
  { label: 'Active & with email (already in CRM)', n: 1527, pct: 12.6, tint: 'bg-gray-300' },
];

// The 10,560 active-emailless customers, by primary store country.
const COUNTRY_SPLIT = [
  { country: 'Italy', n: 5644 }, { country: 'USA', n: 1543 }, { country: 'Russia', n: 1275 },
  { country: 'Turkey', n: 719 }, { country: 'San Marino', n: 509 }, { country: 'Singapore', n: 417 },
  { country: 'Hong Kong', n: 331 }, { country: 'Taiwan', n: 74 }, { country: 'Spain', n: 23 },
  { country: 'UK', n: 16 }, { country: 'China', n: 8 }, { country: 'Belgium', n: 1 },
];

// The 5,644 Italian-store active-emailless customers, by store.
const ITALY_STORE_SPLIT = [
  { store: 'Marcianise', n: 1319 }, { store: 'Arezzo', n: 982 }, { store: 'Roma Babuino', n: 684 },
  { store: 'Serravalle', n: 651 }, { store: 'Fidenza', n: 610 }, { store: 'Enna', n: 586 },
  { store: 'Milano', n: 268 }, { store: 'Firenze', n: 252 }, { store: 'Barberino', n: 214 },
  { store: 'Forte dei Marmi', n: 50 }, { store: 'Noventa di Piave', n: 10 },
  { store: 'Milano Rinascente', n: 9 }, { store: 'Napoli', n: 7 }, { store: 'Arezzo temporary', n: 2 },
];

// Phone recovery in the two processed imports.
const PHONE_STATS = [
  { store: 'Arezzo', total: '3,462', hasPhone: '96.0%', e164: '96.0%', reachable: '96.1%', noPhone: '3.9%' },
  { store: 'Milano', total: '2,022', hasPhone: '78.7%', e164: '77.2%', reachable: '78.9%', noPhone: '21.1%' },
  { store: 'Combined', total: '5,484', hasPhone: '89.7%', e164: '89.1%', reachable: '89.8%', noPhone: '10.2%' },
];

const CHILDREN_STATS = [
  { store: 'Arezzo', withKids: '1,758', pct: '50.8%', two: '261', total: '2,019' },
  { store: 'Milano', withKids: '1,507', pct: '74.5%', two: '202', total: '1,709' },
  { store: 'Combined', withKids: '3,265', pct: '59.5%', two: '463', total: '3,728' },
];

// Final locale mix across both imports (5,484), after the AI pass.
const LOCALE_AFTER_AI = [
  { code: 'it_IT', n: 4737 }, { code: 'en_GB', n: 538 }, { code: 'en_US', n: 97 },
  { code: 'es_ES', n: 39 }, { code: 'fr_FR', n: 27 }, { code: 'zh_CN', n: 23 },
  { code: 'de_DE', n: 8 }, { code: 'fr_CH', n: 6 }, { code: 'de_CH', n: 5 },
  { code: 'ja_JP', n: 3 }, { code: 'it_CH', n: 1 },
];

// Where the AI reassigned the 505 changed locales (from the en_GB fallback).
const AI_REASSIGN = [
  { to: 'it_IT', n: 298 }, { to: 'en_US', n: 97 }, { to: 'es_ES', n: 38 }, { to: 'fr_FR', n: 26 },
  { to: 'zh_CN', n: 23 }, { to: 'de_DE', n: 8 }, { to: 'fr_CH', n: 6 }, { to: 'de_CH', n: 5 },
  { to: 'ja_JP', n: 3 }, { to: 'it_CH', n: 1 },
];

const sum = (xs: { n: number }[]) => xs.reduce((a, b) => a + b.n, 0);

function Bar({ label, n, total, tint = 'bg-gray-800' }: { label: string; n: number; total: number; tint?: string }) {
  const pct = (n / total) * 100;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 shrink-0 text-gray-600 truncate">{label}</span>
      <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
        <div className={`h-full ${tint} rounded`} style={{ width: `${Math.max(pct, 1.5)}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right tabular-nums text-gray-700">
        {n.toLocaleString()} <span className="text-gray-400">({pct.toFixed(1)}%)</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- component */

export function ImportPipelineDocs() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Import Normalization &amp; Recovery</h1>
            <p className="text-sm text-gray-600 mt-1">
              How the legacy customer CSV becomes clean, consented loyalty-CRM records.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/import">
              <Button variant="outline">Open Imports</Button>
            </Link>
            <Button variant="outline" onClick={() => navigate('/')}>
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* ---------------------------------------------- Pipeline schema */}
        <div className="bg-white rounded-lg border mb-6 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">The pipeline at a glance</h2>
          <p className="text-xs text-gray-500 mb-4">
            Five stages. Stages 1–2 are automatic; 3 is the manager; 4 loops the customer back into the
            queue; 5 writes the CRM.
          </p>

          <div className="flex flex-col lg:flex-row lg:items-stretch gap-2">
            {STAGES.map((s, i) => (
              <div key={s.key} className="flex flex-col lg:flex-row lg:items-stretch gap-2 flex-1">
                <div className={`flex-1 rounded-xl border p-4 ${s.tint}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`w-6 h-6 rounded-full ${s.dot} text-white text-xs font-bold flex items-center justify-center shrink-0`}
                    >
                      {s.n}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{s.title}</p>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500">{s.who}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 leading-snug">{s.blurb}</p>
                </div>
                {i < STAGES.length - 1 && (
                  <div className="hidden lg:flex items-center text-gray-300 font-bold">→</div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <span className="font-semibold">↩ Feedback loop:</span>
            <span className="text-emerald-800">
              When the customer submits via the recovery link (stage 4), the record is updated in place and
              re-appears in the manager queue (stage 3), ready to approve.
            </span>
          </div>
        </div>

        {/* ----------------------------------- Stage 1: programmatic */}
        <div className="bg-white rounded-lg border mb-6 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
              1
            </span>
            <h2 className="text-lg font-semibold text-gray-900">Programmatic normalization</h2>
            <span className="text-xs text-gray-400">deterministic · runs on every row at import time</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Pure rules, no AI. Turns each raw CSV row into a structured record with quality flags and a
            starting status.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3 font-medium text-gray-600 w-40">Field / step</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">What the rule does</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {PROGRAMMATIC_RULES.map((r) => (
                  <tr key={r.field} className="border-b">
                    <td className="py-2 px-3 font-medium whitespace-nowrap">{r.field}</td>
                    <td className="py-2 px-3 text-gray-600">{r.rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ----------------------------------- Locale ladder */}
        <div className="bg-white rounded-lg border mb-6 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Locale resolution — the key insight</h2>
          <p className="text-sm text-gray-600 mb-4">
            The CSV <code className="bg-gray-100 px-1 rounded">COUNTRY</code> column is the{' '}
            <strong>store’s location, not the customer’s</strong>. Monnalisa’s Italian stores are full of
            tourists, so locale is resolved from real signals in priority order — the first match wins.
          </p>
          <div className="space-y-2">
            {LOCALE_LADDER.map((l) => (
              <div key={l.n} className={`flex items-start gap-3 rounded-xl border p-3 ${l.tint}`}>
                <span className="w-6 h-6 rounded-full bg-white border text-gray-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {l.n}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{l.label}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{l.detail}</p>
                </div>
                <code className="text-[11px] bg-white/70 border rounded px-2 py-1 text-gray-700 shrink-0 hidden sm:block">
                  {l.out}
                </code>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Records resolved by “fallback” (or low confidence) are flagged{' '}
            <code className="bg-gray-100 px-1 rounded">localeUncertain</code> and held in{' '}
            <strong>review</strong> for the AI pass / manager.
          </p>
        </div>

        {/* ----------------------------------- Stage 2: AI pass */}
        <div className="bg-white rounded-lg border mb-6 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">
              2
            </span>
            <h2 className="text-lg font-semibold text-gray-900">AI recovery pass</h2>
            <span className="text-xs text-gray-400">OpenAI gpt-4o-mini · temp 0.1 · strict JSON</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Triggered per-record from the editor (“Run AI repair”). It receives the raw row, the normalized
            fields, and the quality flags, and returns a structured set of patches it is confident about.
          </p>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4">
              <p className="text-xs font-semibold text-purple-900 uppercase tracking-wider mb-2">
                What it fixes
              </p>
              <ul className="space-y-1.5 text-sm text-gray-700 list-disc list-inside">
                {AI_FIXES.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Guardrails
              </p>
              <ul className="space-y-1.5 text-sm text-gray-700 list-disc list-inside">
                {AI_CONSTRAINTS.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* The message */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
              The message — what the model is told (summarized)
            </p>
            <p className="text-xs leading-relaxed text-gray-200 font-mono whitespace-pre-line">
{`You are a data-normalization assistant for Monnalisa…

CRITICAL: "country" is the STORE's location, NOT the customer's nationality.
Italian stores are full of foreign tourists — NEVER assume Italian from the store.

normalized.localeSource tells you how locale was chosen:
  phone       → reliable, override only with strong reason
  name-script → usually reliable
  store       → scrutinize
  fallback    → YOUR PRIMARY JOB: use the NAME'S SEMANTICS to do better
                (Schockaert→Flemish, Dupont→French, Rossi→Italian…)

Supported locales only; otherwise en_GB. Prefer a phone country code over the name.
Do NOT invent data. Explain any locale change. Flag "hopeless" only if there's no way forward.`}
            </p>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Structured output
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                'patches { firstName, lastName, email, phone, locale }',
                'confidence 0–1',
                'reasoning',
                'suggestedActions[]',
                'hopeless',
              ].map((p) => (
                <code key={p} className="bg-gray-100 border rounded px-2 py-1 text-gray-700">
                  {p}
                </code>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Patches are merged into the record; an unsupported locale is coerced to en_GB. The reasoning +
              suggested actions are stored as <strong>AI notes</strong> with a confidence badge.
            </p>
          </div>
        </div>

        {/* ----------------------------------- Stage 3: review queue */}
        <div className="bg-white rounded-lg border mb-6 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center">
              3
            </span>
            <h2 className="text-lg font-semibold text-gray-900">Manager review queue</h2>
            <span className="text-xs text-gray-400">/import/:importId</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Status lifecycle
              </p>
              <div className="space-y-1.5">
                {STATUSES.map((s) => (
                  <div key={s.status} className="flex items-start gap-3">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-medium capitalize shrink-0 w-20 text-center ${s.tint}`}
                    >
                      {s.status}
                    </span>
                    <p className="text-xs text-gray-600 flex-1">{s.meaning}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Actions on a record
              </p>
              <div className="space-y-1.5">
                {MANAGER_ACTIONS.map((a) => (
                  <div key={a.action} className="rounded-lg border border-gray-200 px-3 py-2">
                    <p className="text-sm font-medium text-gray-900">{a.action}</p>
                    <p className="text-xs text-gray-500">{a.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ----------------------------------- Stage 4: customer recovery */}
        <div className="bg-white rounded-lg border mb-6 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
              4
            </span>
            <h2 className="text-lg font-semibold text-gray-900">Customer self-validation page</h2>
            <span className="text-xs text-gray-400">public · /recover/:token · no login</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            A mobile-first page behind a single-use, 30-day token link. Fields Monnalisa already holds are
            shown <span className="text-green-700 font-medium">confirmed (green)</span>; only the genuine
            gaps are asked. Everything the customer saves is written back onto the staging record and the
            link is marked <code className="bg-gray-100 px-1 rounded">submitted</code>.
          </p>

          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">Step 1 · Contact &amp; consent</p>
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                <li>Confirm / add email + mobile (country-prefix picker)</li>
                <li>Join Monnalisa Fun (loyalty) — on by default</li>
                <li>Marketing updates — off by default</li>
                <li>Privacy policy — required to continue</li>
              </ul>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">Step 2 · Children</p>
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                <li>Add up to 4 children (name, day/month, year, boy/girl)</li>
                <li>Pre-filled from any birthdays we recovered</li>
                <li>Entirely optional — can be skipped</li>
              </ul>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">Done · Write-back</p>
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                <li>Sets <code className="bg-white px-1 rounded">consent</code> + <code className="bg-white px-1 rounded">customerSubmittedAt</code></li>
                <li>Phone normalized to E.164</li>
                <li>Manager sees “Customer updated info” and can approve</li>
              </ul>
            </div>
          </div>

          {/* The customer-facing message / copy */}
          <div className="rounded-xl border border-gray-200 bg-[#f5f5f7] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
              The customer-facing message &amp; copy
            </p>
            <div className="space-y-2 text-sm">
              <p className="text-gray-900">
                <span className="font-semibold">Greeting:</span> “Ciao {'{name}'} 👋 — We’re just missing one
                detail to keep your Monnalisa profile up to date.”
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Loyalty:</span> “Join Monnalisa Fun — earn rewards on
                every purchase, plus members-only perks for you and your children.”
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Marketing:</span> “Keep me updated on my event invitations
                &amp; loyalty opportunities… you can unsubscribe anytime.”
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Thank-you:</span> “Thank you, {'{name}'}! Your details are
                saved. Welcome to Monnalisa Fun — we’ll be in touch with rewards and news made for you.”
              </p>
              <p className="text-gray-500 text-xs pt-1">
                Expired / used links show: “This link is no longer valid — please contact your Monnalisa
                store for a new one.”
              </p>
            </div>
          </div>
        </div>

        {/* ----------------------------------- By the numbers */}
        <div className="bg-white rounded-lg border mb-6 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">By the numbers — the data behind this</h2>
          <p className="text-sm text-gray-600 mb-5">
            Why the pipeline is shaped the way it is, and how the first two store imports came out.
          </p>

          {/* Database scope */}
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            1 · Legacy database scope <span className="font-normal text-gray-400">(full export, deduped)</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {DB_HEADLINE.map((s) => (
              <div key={s.label} className="rounded-xl border border-gray-200 p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{s.label}</p>
                {s.sub && <p className="text-[11px] font-medium text-amber-600">{s.sub}</p>}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Of the <strong>12,087</strong> customers who bought in the last 12 months, the split by email —
            the with-email ones are already in the CRM, so the <strong>email-less</strong> ones are the migration scope:
          </p>
          <div className="space-y-1.5 mb-6 max-w-xl">
            {ACTIVE_EMAIL_SPLIT.map((s) => (
              <Bar key={s.label} label={s.label} n={s.n} total={12087} tint={s.tint} />
            ))}
          </div>

          {/* Country split */}
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            2 · Country split <span className="font-normal text-gray-400">(the 10,560 active, email-less customers, by store country)</span>
          </h3>
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-1.5 mb-3">
            {COUNTRY_SPLIT.map((c) => (
              <Bar key={c.country} label={c.country} n={c.n} total={sum(COUNTRY_SPLIT)}
                tint={c.country === 'Italy' || c.country === 'San Marino' ? 'bg-green-600' : 'bg-gray-400'} />
            ))}
          </div>
          <p className="text-xs text-gray-500 mb-5">
            ~54% are tied to Italian stores (green) — but ~46% shop in Italy yet are foreign, which is exactly
            why locale can’t be assumed from the store. The Italian-store share breaks down as:
          </p>
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-1.5 mb-6">
            {ITALY_STORE_SPLIT.map((s) => (
              <Bar key={s.store} label={s.store} n={s.n} total={sum(ITALY_STORE_SPLIT)} tint="bg-emerald-500" />
            ))}
          </div>

          {/* Import quality */}
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            3 · Import quality <span className="font-normal text-gray-400">(retail no-email export → Arezzo &amp; Milano, after deterministic + AI)</span>
          </h3>

          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Recovered phone numbers</p>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500">
                  <th className="text-left py-1.5 px-3 font-medium">Import</th>
                  <th className="text-left py-1.5 px-3 font-medium">Customers</th>
                  <th className="text-left py-1.5 px-3 font-medium">Has phone</th>
                  <th className="text-left py-1.5 px-3 font-medium">→ E.164 (+39)</th>
                  <th className="text-left py-1.5 px-3 font-medium">Reachable</th>
                  <th className="text-left py-1.5 px-3 font-medium">No phone</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {PHONE_STATS.map((r) => (
                  <tr key={r.store} className={`border-b ${r.store === 'Combined' ? 'font-semibold bg-gray-50/50' : ''}`}>
                    <td className="py-1.5 px-3">{r.store}</td>
                    <td className="py-1.5 px-3 tabular-nums">{r.total}</td>
                    <td className="py-1.5 px-3 tabular-nums">{r.hasPhone}</td>
                    <td className="py-1.5 px-3 tabular-nums text-green-700">{r.e164}</td>
                    <td className="py-1.5 px-3 tabular-nums">{r.reachable}</td>
                    <td className="py-1.5 px-3 tabular-nums text-gray-400">{r.noPhone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            <strong>4,884</strong> phones recovered into valid E.164. The handful left un-prefixed are foreign
            (non-it_IT) numbers we won’t stamp <code className="bg-gray-100 px-1 rounded">+39</code> on.
          </p>

          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Customers with children</p>
          <div className="overflow-x-auto mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500">
                  <th className="text-left py-1.5 px-3 font-medium">Import</th>
                  <th className="text-left py-1.5 px-3 font-medium">With ≥1 child</th>
                  <th className="text-left py-1.5 px-3 font-medium">Share</th>
                  <th className="text-left py-1.5 px-3 font-medium">2 children</th>
                  <th className="text-left py-1.5 px-3 font-medium">Total children</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {CHILDREN_STATS.map((r) => (
                  <tr key={r.store} className={`border-b ${r.store === 'Combined' ? 'font-semibold bg-gray-50/50' : ''}`}>
                    <td className="py-1.5 px-3">{r.store}</td>
                    <td className="py-1.5 px-3 tabular-nums">{r.withKids}</td>
                    <td className="py-1.5 px-3 tabular-nums text-pink-600">{r.pct}</td>
                    <td className="py-1.5 px-3 tabular-nums">{r.two}</td>
                    <td className="py-1.5 px-3 tabular-nums">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Final locale mix (both imports, 5,484)
              </p>
              <div className="space-y-1.5">
                {LOCALE_AFTER_AI.map((l) => (
                  <Bar key={l.code} label={l.code} n={l.n} total={sum(LOCALE_AFTER_AI)}
                    tint={l.code === 'it_IT' ? 'bg-gray-800' : 'bg-indigo-400'} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                AI rescued 505 fallbacks → reassigned to
              </p>
              <div className="space-y-1.5">
                {AI_REASSIGN.map((a) => (
                  <Bar key={a.to} label={a.to} n={a.n} total={sum(AI_REASSIGN)} tint="bg-purple-500" />
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                The AI pass ran on 1,011 uncertain records and changed 505 locales the rules had defaulted to
                English — mostly phone-less Italian names back to it_IT.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 mt-5">
            Sources: legacy export <code className="bg-gray-100 px-1 rounded">5c2d…csv</code> (scope/country
            splits) and the processed retail import
            <code className="bg-gray-100 px-1 rounded">processed/firebase-*.csv</code> (import quality). Children
            birthdays inherit the Excel day/month ambiguity — counts are reliable, exact dates confirmed on the recovery page.
          </p>
        </div>

        {/* ----------------------------------- Prototype note */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg mb-8 p-4">
          <h2 className="text-sm font-semibold text-amber-800 mb-2">Prototype scope &amp; Phase-2 notes</h2>
          <ul className="text-sm text-amber-900 list-disc list-inside space-y-1">
            <li>
              Staging data + recovery links live in the browser (IndexedDB). In Phase 2 they move 1:1 to
              Firestore / a backend KV so SMS links resolve cross-device.
            </li>
            <li>
              The AI pass currently calls OpenAI from the browser via{' '}
              <code className="bg-amber-100 px-1 rounded">VITE_OPENAI_API_KEY</code> — it must move
              server-side (a Vercel function) before any non-prototype use.
            </li>
            <li>
              The deterministic pass is intentionally conservative (phone + script only); Latin-script name
              semantics are left to the AI pass.
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="border-t pt-4 mt-8 text-xs text-gray-500">
          <p>
            Internal reference for the customer-import pipeline. Page accessible at{' '}
            <code className="bg-gray-100 px-1 rounded">/import-docs</code> (requires login).
          </p>
        </div>
      </div>
    </div>
  );
}
