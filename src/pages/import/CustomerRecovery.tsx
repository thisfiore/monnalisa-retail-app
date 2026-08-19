import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Toggle } from '../../components/Toggle';
import type { NormalizedChild } from '../../lib/import/types';
import { defaultConsent, EMAIL_REGEX, type Consent } from '../../lib/import/recovery';
import {
  loadRecovery,
  type RecoveryController,
  type RecoveryView,
} from '../../lib/import/recovery-controller';
import {
  recoveryCopy,
  RECOVERY_COPY,
  PRIVACY_URL,
  type RecoveryCopy,
} from '../../lib/import/recovery-copy';
import { PhonePrefixSelect } from '../../components/PhonePrefixSelect';
import { splitPhoneNumber } from '../../lib/phone-prefixes';

type Stage = 'loading' | 'invalid' | 'intro' | 'step1' | 'step2' | 'done';

export function CustomerRecovery() {
  const { token } = useParams<{ token: string }>();

  const [stage, setStage] = useState<Stage>('loading');
  const [ctrl, setCtrl] = useState<RecoveryController | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return setStage('invalid');
      try {
        const res = await loadRecovery(token);
        if (res === 'invalid' || res === 'expired') return setStage('invalid');
        setCtrl(res);
        setStage('intro');
      } catch {
        setStage('invalid');
      }
    })();
  }, [token]);

  if (stage === 'loading') {
    return (
      <Shell>
        <p className="text-center text-gray-400 text-sm py-16">{RECOVERY_COPY.en.loading}</p>
      </Shell>
    );
  }

  if (stage === 'invalid' || !ctrl) {
    // Locale is unknown without a record — fall back to English.
    const c = RECOVERY_COPY.en;
    return (
      <Shell>
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10S6.477 1 12 1s10 4.477 10 10c0 1.61-.38 3.13-1.057 4.475M12 9v4m0 4h.01" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">{c.invalid.title}</h1>
          <p className="text-sm text-gray-500 mt-2">{c.invalid.body}</p>
        </div>
      </Shell>
    );
  }

  const name = ctrl.view.firstName.trim();
  const copy = recoveryCopy(ctrl.view.locale);

  if (stage === 'done') {
    return (
      <Shell>
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{copy.doneTitle(name)}</h1>
          <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">{copy.doneBody}</p>
        </div>
      </Shell>
    );
  }

  if (stage === 'intro') {
    return <Intro name={name} copy={copy} onStart={() => setStage('step1')} />;
  }

  return stage === 'step1' ? (
    <Step1
      view={ctrl.view}
      copy={copy}
      onSubmit={async (input) => {
        await ctrl.submitStep1(input);
        setStage('step2');
      }}
    />
  ) : (
    <Step2
      view={ctrl.view}
      copy={copy}
      onSave={async (children) => {
        await ctrl.submitChildren(children);
        setStage('done');
      }}
      onSkip={async () => {
        await ctrl.finish();
        setStage('done');
      }}
    />
  );
}

/* ---------------------------------------------------------------- Intro */

/**
 * Welcome landing the customer sees first. Sets the tone before the form:
 * a short video placeholder, the value of joining, then a single CTA into Step 1.
 */
function Intro({
  name,
  copy,
  onStart,
}: {
  name: string;
  copy: RecoveryCopy;
  onStart: () => void;
}) {
  const t = copy.intro;
  return (
    <Shell>
      <div className="text-center mb-6">
        <p className="text-xs font-medium tracking-[0.18em] text-gray-400 uppercase">{t.eyebrow}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{t.greeting(name)} 💖</h1>
        <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">{t.tagline}</p>
      </div>

      <HeroImage />

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        {t.benefits.map((b) => (
          <div key={b.title} className="flex items-start gap-3">
            <span className="text-xl leading-none mt-0.5">{b.icon}</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{b.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{b.text}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-gray-400 mt-5">
        <a href={t.discoverMoreHref} target="_blank" rel="noreferrer" className="underline">
          {t.discoverMore}
        </a>
      </p>

      <StickyCta>
        <Button onClick={onStart} className="w-full">
          {t.cta}
        </Button>
      </StickyCta>
    </Shell>
  );
}

/**
 * Welcome hero. Shows the Monnalisa Fun campaign image for now; swap this for a
 * <video>/embed once the welcome video is ready — keep the rounded wrapper.
 */
function HeroImage() {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-[#f0eeec] aspect-[4/3] shadow-sm">
      <img
        src="/recovery-hero.jpg"
        alt="Monnalisa Fun"
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
      />
    </div>
  );
}

/* ---------------------------------------------------------------- Step 1 */

function Step1({
  view,
  copy,
  onSubmit,
}: {
  view: RecoveryView;
  copy: RecoveryCopy;
  onSubmit: (input: { email?: string; phone?: string; consent: Consent }) => Promise<void>;
}) {
  const t = copy.step1;
  const needsEmail = view.needsEmail;
  const needsPhone = view.needsPhone;
  // The record is PII-minimised — we only hold masked hints, never the raw
  // value — so the editable inputs start empty and default to the +39 prefix.
  const initialPhone = useMemo(() => splitPhoneNumber(''), []);

  const [email, setEmail] = useState('');
  const [phonePrefix, setPhonePrefix] = useState(initialPhone.prefix);
  const [phone, setPhone] = useState(initialPhone.national);
  // We already hold these → start confirmed (green); only the gaps are asked.
  const [editingEmail, setEditingEmail] = useState(needsEmail);
  const [editingPhone, setEditingPhone] = useState(needsPhone);
  const [consent, setConsent] = useState<Consent>(defaultConsent());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const emailConfirmed = !editingEmail && !!view.emailHint;
  const phoneConfirmed = !editingPhone && !!view.phoneHint;
  const allConfirmed = emailConfirmed && phoneConfirmed;

  async function handleContinue() {
    setError('');
    // Only submit a field the customer actually entered/edited; an untouched,
    // already-known field stays as the manager already has it.
    const emailToSend = editingEmail ? email.trim() || undefined : undefined;
    const phoneToSend = editingPhone && phone.trim() ? `${phonePrefix} ${phone.trim()}` : undefined;

    if (needsEmail && !emailToSend) {
      return setError(t.errEmailRequired);
    }
    if (emailToSend && !EMAIL_REGEX.test(emailToSend)) {
      return setError(t.errEmailInvalid);
    }
    if (needsPhone && !phoneToSend) {
      return setError(t.errPhoneRequired);
    }
    if (!consent.privacy) {
      return setError(t.errPrivacy);
    }
    setSaving(true);
    try {
      await onSubmit({ email: emailToSend, phone: phoneToSend, consent });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <Greeting
        name={view.firstName.trim()}
        greeting={copy.greeting}
        subtitle={allConfirmed ? t.subtitleConfirm : t.subtitleMissing}
      />

      <div className="space-y-5">
        <div className="space-y-3">
          {emailConfirmed ? (
            <ConfirmedRow
              label={t.emailLabel}
              value={view.emailHint ?? ''}
              editLabel={t.editLabel}
              onEdit={() => setEditingEmail(true)}
            />
          ) : (
            <FieldGroup>
              <Input
                label={t.emailLabel}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                required={needsEmail}
                error={
                  email.trim() && !EMAIL_REGEX.test(email.trim()) ? t.emailCheckInline : undefined
                }
              />
              {needsEmail && <p className="text-xs text-amber-600 mt-1">{t.emailMissingHint}</p>}
            </FieldGroup>
          )}

          {phoneConfirmed ? (
            <ConfirmedRow
              label={t.phoneLabel}
              value={view.phoneHint ?? ''}
              editLabel={t.editLabel}
              onEdit={() => setEditingPhone(true)}
            />
          ) : (
            <FieldGroup>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                {t.phoneLabel}
                {needsPhone && <span className="text-red-500 ml-1">*</span>}
              </label>
              <div className="flex gap-2">
                <PhonePrefixSelect
                  value={phonePrefix}
                  onChange={setPhonePrefix}
                  searchPlaceholder={t.phoneCountrySearch}
                />
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder={t.phonePlaceholder}
                />
              </div>
              {needsPhone && <p className="text-xs text-amber-600 mt-1">{t.phoneMissingHint}</p>}
            </FieldGroup>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 divide-y divide-gray-100">
          <div className="pb-4">
            <Toggle
              label={t.joinTitle}
              description={t.joinDesc}
              checked={consent.loyalty}
              onChange={(v) => setConsent({ ...consent, loyalty: v })}
            />
          </div>

          <div className="py-4">
            <Toggle
              label={t.marketingTitle}
              description={t.marketingDesc}
              checked={consent.marketing}
              onChange={(v) => setConsent({ ...consent, marketing: v })}
            />
            <p className="text-xs text-gray-400 mt-2 ml-14">
              {t.marketingNote.before}
              <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="underline">
                {t.marketingNote.link}
              </a>
              {t.marketingNote.after}
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer pt-4">
            <input
              type="checkbox"
              checked={consent.privacy}
              onChange={(e) => setConsent({ ...consent, privacy: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            <span className="text-sm text-gray-700">
              {t.privacyConsent.before}
              <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="underline text-gray-900">
                {t.privacyConsent.link}
              </a>
              {t.privacyConsent.after} <span className="text-red-500">*</span>
            </span>
          </label>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <StickyCta>
        <Button onClick={handleContinue} isLoading={saving} className="w-full">
          {t.saveContinue}
        </Button>
      </StickyCta>
    </Shell>
  );
}

/* ---------------------------------------------------------------- Step 2 */

function Step2({
  view,
  copy,
  onSave,
  onSkip,
}: {
  view: RecoveryView;
  copy: RecoveryCopy;
  onSave: (children: NormalizedChild[]) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const t = copy.step2;
  const [children, setChildren] = useState<NormalizedChild[]>(view.children);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);

  function setChild(i: number, patch: Partial<NormalizedChild>) {
    setChildren((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addChild() {
    setChildren((prev) => (prev.length >= 4 ? prev : [...prev, { dayMonth: '', yearKnown: false }]));
  }
  function removeChild(i: number) {
    setChildren((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (children.length) await onSave(children);
      else await onSkip();
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSkipping(true);
    try {
      await onSkip();
    } finally {
      setSkipping(false);
    }
  }

  return (
    <Shell>
      <Greeting name={view.firstName.trim()} greeting={copy.greeting} subtitle={t.subtitle} />

      <div className="space-y-4">
        {children.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-2">{t.noChildren}</p>
        )}

        {children.map((child, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{t.childTitle(i + 1)}</h3>
              <button
                type="button"
                onClick={() => removeChild(i)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                {t.remove}
              </button>
            </div>
            <Input
              label={t.nameLabel}
              value={child.name ?? ''}
              onChange={(e) => setChild(i, { name: e.target.value || undefined })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t.dayMonthLabel}
                value={child.dayMonth}
                onChange={(e) => setChild(i, { dayMonth: e.target.value })}
                placeholder="DD/MM"
              />
              <Input
                label={t.yearLabel}
                type="number"
                inputMode="numeric"
                value={child.year ?? ''}
                onChange={(e) => {
                  const y = e.target.value ? Number(e.target.value) : undefined;
                  setChild(i, { year: y, yearKnown: y !== undefined });
                }}
                placeholder={t.yearPlaceholder}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">{t.genderLabel}</label>
              <div className="flex gap-2">
                {(
                  [
                    { value: 'Male', label: t.boy, icon: '♂', bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
                    { value: 'Female', label: t.girl, icon: '♀', bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700' },
                  ] as const
                ).map((opt) => {
                  const active = child.gender === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setChild(i, { gender: active ? undefined : opt.value })}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        active
                          ? `${opt.bg} ${opt.border} ${opt.text}`
                          : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      <span className="leading-none text-base">{opt.icon}</span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {children.length < 4 && (
          <Button variant="outline" onClick={addChild} className="w-full">
            {t.addChild}
          </Button>
        )}
      </div>

      <StickyCta>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSkip} isLoading={skipping} disabled={saving} className="flex-1">
            {t.skip}
          </Button>
          <Button onClick={handleSave} isLoading={saving} disabled={skipping} className="flex-1">
            {t.save}
          </Button>
        </div>
      </StickyCta>
    </Shell>
  );
}

/* ---------------------------------------------------------------- Layout */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-md mx-auto px-5 py-4 text-center">
          <span className="text-lg font-semibold tracking-[0.2em] text-gray-900 uppercase">
            Monnalisa
          </span>
        </div>
      </header>
      <main className="max-w-md mx-auto px-5 py-6 pb-28">{children}</main>
    </div>
  );
}

function Greeting({
  name,
  greeting,
  subtitle,
}: {
  name: string;
  greeting: (name: string) => string;
  subtitle: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">{greeting(name)} 👋</h1>
      <p className="text-sm text-gray-500 mt-1.5">{subtitle}</p>
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

/** A field we already hold — shown confirmed (green) with an option to edit. */
function ConfirmedRow({
  label,
  value,
  editLabel,
  onEdit,
}: {
  label: string;
  value: string;
  editLabel: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-green-300 bg-green-50/60 px-4 py-3">
      <svg
        className="w-5 h-5 text-green-600 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-green-700">{label}</p>
        <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-xs font-medium text-gray-500 underline shrink-0"
      >
        {editLabel}
      </button>
    </div>
  );
}

function StickyCta({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-gray-200">
      <div className="max-w-md mx-auto px-5 py-3">{children}</div>
    </div>
  );
}
