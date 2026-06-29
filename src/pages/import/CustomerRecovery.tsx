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

const PHONE_PREFIXES = ['+39', '+1', '+44', '+33', '+49', '+34', '+41', '+86', '+81'];

function splitPhone(phone: string): { prefix: string; rest: string } {
  const match = PHONE_PREFIXES.find((p) => phone.startsWith(p));
  if (match) return { prefix: match, rest: phone.slice(match.length).replace(/\D/g, '') };
  return { prefix: '+39', rest: phone.replace(/\D/g, '') };
}

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
        <p className="text-center text-gray-400 text-sm py-16">Loading…</p>
      </Shell>
    );
  }

  if (stage === 'invalid' || !ctrl) {
    return (
      <Shell>
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10S6.477 1 12 1s10 4.477 10 10c0 1.61-.38 3.13-1.057 4.475M12 9v4m0 4h.01" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">This link is no longer valid</h1>
          <p className="text-sm text-gray-500 mt-2">
            It may have expired or already been used. Please contact your Monnalisa store for a new
            link.
          </p>
        </div>
      </Shell>
    );
  }

  const name = ctrl.view.firstName.trim();

  if (stage === 'done') {
    return (
      <Shell>
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Thank you{name ? `, ${name}` : ''}!</h1>
          <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
            Your details are saved. Welcome to the Monnalisa Family — we'll be in touch with rewards
            and news made for you.
          </p>
        </div>
      </Shell>
    );
  }

  if (stage === 'intro') {
    return <Intro name={name} onStart={() => setStage('step1')} />;
  }

  return stage === 'step1' ? (
    <Step1
      view={ctrl.view}
      onSubmit={async (input) => {
        await ctrl.submitStep1(input);
        setStage('step2');
      }}
    />
  ) : (
    <Step2
      view={ctrl.view}
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
function Intro({ name, onStart }: { name: string; onStart: () => void }) {
  return (
    <Shell>
      <div className="text-center mb-6">
        <p className="text-xs font-medium tracking-[0.18em] text-gray-400 uppercase">
          Monnalisa Family
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          {name ? `Ciao ${name}` : 'Welcome'} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
          A little world made for you and your children. Take a moment to discover it.
        </p>
      </div>

      <VideoPlaceholder />

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        {(
          [
            {
              icon: '🎁',
              title: 'Rewards on every purchase',
              text: 'Earn points in-store and online, plus members-only perks.',
            },
            {
              icon: '✨',
              title: 'Made for your little ones',
              text: 'Tailored sizes, early access to new collections and birthday surprises.',
            },
            {
              icon: '💌',
              title: 'Personal invitations',
              text: 'In-store events and previews, sent only to the Monnalisa Family.',
            },
          ] as const
        ).map((b) => (
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
        It only takes a minute — we'll just confirm a couple of details.
      </p>

      <StickyCta>
        <Button onClick={onStart} className="w-full">
          Get started
        </Button>
      </StickyCta>
    </Shell>
  );
}

/**
 * 16:9 placeholder for the welcome video. Swap the inner content for a real
 * <video>/embed once the asset is ready — keep the aspect ratio wrapper.
 */
function VideoPlaceholder() {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-900 to-gray-700 aspect-video shadow-sm">
      {/* TODO: replace with the Monnalisa Family welcome video */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-md">
          <svg className="w-6 h-6 text-gray-900 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="text-xs font-medium tracking-wide text-white/80 uppercase">
          Video coming soon
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Step 1 */

function Step1({
  view,
  onSubmit,
}: {
  view: RecoveryView;
  onSubmit: (input: { email?: string; phone?: string; consent: Consent }) => Promise<void>;
}) {
  const needsEmail = view.needsEmail;
  const needsPhone = view.needsPhone;
  const initialPhone = useMemo(() => splitPhone(view.phonePrefill || ''), [view.phonePrefill]);

  const [email, setEmail] = useState(view.emailPrefill || '');
  const [phonePrefix, setPhonePrefix] = useState(initialPhone.prefix);
  const [phone, setPhone] = useState(initialPhone.rest);
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
      return setError('Please enter a valid email address.');
    }
    if (emailToSend && !EMAIL_REGEX.test(emailToSend)) {
      return setError('That email address looks incorrect.');
    }
    if (needsPhone && !phoneToSend) {
      return setError('Please enter your mobile number.');
    }
    if (!consent.privacy) {
      return setError('Please accept the privacy policy to continue.');
    }
    setSaving(true);
    try {
      await onSubmit({ email: emailToSend, phone: phoneToSend, consent });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <Greeting
        name={view.firstName.trim()}
        subtitle={
          allConfirmed
            ? 'Please confirm your details below — it only takes a moment.'
            : "We're just missing one detail to keep your Monnalisa profile up to date."
        }
      />

      <div className="space-y-5">
        <div className="space-y-3">
          {emailConfirmed ? (
            <ConfirmedRow
              label="Email"
              value={view.emailHint ?? ''}
              onEdit={() => setEditingEmail(true)}
            />
          ) : (
            <FieldGroup>
              <Input
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required={needsEmail}
                error={
                  email.trim() && !EMAIL_REGEX.test(email.trim()) ? 'Check this email' : undefined
                }
              />
              {needsEmail && (
                <p className="text-xs text-amber-600 mt-1">
                  We don't have your email yet — please add it.
                </p>
              )}
            </FieldGroup>
          )}

          {phoneConfirmed ? (
            <ConfirmedRow
              label="Mobile number"
              value={view.phoneHint ?? ''}
              onEdit={() => setEditingPhone(true)}
            />
          ) : (
            <FieldGroup>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Mobile number{needsPhone && <span className="text-red-500 ml-1">*</span>}
              </label>
              <div className="flex gap-2">
                <select
                  className="w-24 px-2 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  value={phonePrefix}
                  onChange={(e) => setPhonePrefix(e.target.value)}
                >
                  {PHONE_PREFIXES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="123 456 7890"
                />
              </div>
              {needsPhone && (
                <p className="text-xs text-amber-600 mt-1">
                  We don't have your number yet — please add it.
                </p>
              )}
            </FieldGroup>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 divide-y divide-gray-100">
          <div className="pb-4">
            <Toggle
              label="Join the Monnalisa Family"
              description="Earn rewards on every purchase, plus members-only perks for you and your children."
              checked={consent.loyalty}
              onChange={(v) => setConsent({ ...consent, loyalty: v })}
            />
          </div>

          <div className="py-4">
            <Toggle
              label="Keep me updated on my event invitations & loyalty opportunities"
              description="Personal invitations to in-store events, early access to new collections, and birthday surprises for your little ones."
              checked={consent.marketing}
              onChange={(v) => setConsent({ ...consent, marketing: v })}
            />
            <p className="text-xs text-gray-400 mt-2 ml-14">
              Includes occasional commercial communications — you can unsubscribe anytime. See our{' '}
              <a
                href="https://www.monnalisa.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                communications policy
              </a>
              .
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
              I have read and accept the{' '}
              <a href="https://www.monnalisa.com/privacy" target="_blank" rel="noreferrer" className="underline text-gray-900">
                privacy policy
              </a>
              . <span className="text-red-500">*</span>
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
          Save & continue
        </Button>
      </StickyCta>
    </Shell>
  );
}

/* ---------------------------------------------------------------- Step 2 */

function Step2({
  view,
  onSave,
  onSkip,
}: {
  view: RecoveryView;
  onSave: (children: NormalizedChild[]) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
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
      <Greeting
        name={view.firstName.trim()}
        subtitle="Tell us about your little ones so we can tailor sizes and birthday surprises."
      />

      <div className="space-y-4">
        {children.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-2">
            No children added yet. Add one below — it's optional.
          </p>
        )}

        {children.map((child, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Child {i + 1}</h3>
              <button
                type="button"
                onClick={() => removeChild(i)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
            <Input
              label="Name (optional)"
              value={child.name ?? ''}
              onChange={(e) => setChild(i, { name: e.target.value || undefined })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Day / Month"
                value={child.dayMonth}
                onChange={(e) => setChild(i, { dayMonth: e.target.value })}
                placeholder="DD/MM"
              />
              <Input
                label="Year"
                type="number"
                inputMode="numeric"
                value={child.year ?? ''}
                onChange={(e) => {
                  const y = e.target.value ? Number(e.target.value) : undefined;
                  setChild(i, { year: y, yearKnown: y !== undefined });
                }}
                placeholder="e.g. 2018"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Boy or girl?</label>
              <div className="flex gap-2">
                {(
                  [
                    { value: 'Male', label: 'Boy', icon: '♂', bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
                    { value: 'Female', label: 'Girl', icon: '♀', bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700' },
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
            + Add a child
          </Button>
        )}
      </div>

      <StickyCta>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSkip} isLoading={skipping} disabled={saving} className="flex-1">
            Skip
          </Button>
          <Button onClick={handleSave} isLoading={saving} disabled={skipping} className="flex-1">
            Save
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

function Greeting({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {name ? `Ciao ${name}` : 'Welcome'} 👋
      </h1>
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
  onEdit,
}: {
  label: string;
  value: string;
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
        Edit
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
