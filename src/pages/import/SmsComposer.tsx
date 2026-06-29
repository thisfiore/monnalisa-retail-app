import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { recoveryUrl, E164_REGEX } from '../../lib/import/recovery';
import { getRecoveryStore } from '../../lib/import/recovery-store';
import {
  defaultSmsBody,
  renderSmsBody,
  smsLangForLocale,
  smsLength,
  SMS_LANGS,
  type SmsLang,
} from '../../lib/import/sms-message';
import { personaliseSmsBody } from '../../lib/import/openai-sms';
import {
  sendSmsBatch,
  smsDryRun,
  type SmsOutcome,
  type SmsRequest,
} from '../../lib/import/sms-send';
import type { RecoveryLink, StagingCustomer } from '../../lib/import/types';

const LANG_LABEL = Object.fromEntries(SMS_LANGS.map((l) => [l.code, l.label])) as Record<
  SmsLang,
  string
>;
const langLabel = (code: SmsLang): string => LANG_LABEL[code];

type SmsComposerProps = {
  open: boolean;
  recipients: StagingCustomer[];
  getToken: () => Promise<string>;
  onClose: () => void;
  onSent?: (outcomes: SmsOutcome[]) => void;
};

export function SmsComposer({ open, recipients, getToken, onClose, onSent }: SmsComposerProps) {
  const recipientKey = recipients.map((r) => r.id).join(',');
  const mode: 'single' | 'bulk' = recipients.length === 1 ? 'single' : 'bulk';
  const store = useMemo(() => getRecoveryStore({ getToken }), [getToken]);

  const eligible = useMemo(
    () => recipients.filter((r) => E164_REGEX.test(r.normalized.phone || '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipientKey],
  );
  const excludedCount = recipients.length - eligible.length;

  // Messages are auto-localized per recipient from their resolved locale — no
  // manual language choice. In bulk a single send can span several languages.
  const langBreakdown = useMemo(() => {
    const counts = new Map<SmsLang, number>();
    for (const r of eligible) {
      const l = smsLangForLocale(r.normalized.locale);
      counts.set(l, (counts.get(l) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientKey]);

  // One example recipient per distinct language, for the preview.
  const previews = useMemo(() => {
    const seen = new Set<SmsLang>();
    const out: { lang: SmsLang; rec: StagingCustomer }[] = [];
    for (const r of eligible) {
      const l = smsLangForLocale(r.normalized.locale);
      if (!seen.has(l)) {
        seen.add(l);
        out.push({ lang: l, rec: r });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientKey]);

  const [links, setLinks] = useState<Record<string, RecoveryLink>>({});
  const [linksLoading, setLinksLoading] = useState(true);
  const [singleBody, setSingleBody] = useState(''); // single body, name baked in
  const [overrides, setOverrides] = useState<Record<string, string>>({}); // AI per-recipient
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ done: number; total: number } | null>(null);
  const [aiError, setAiError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [outcomes, setOutcomes] = useState<SmsOutcome[] | null>(null);

  useEffect(() => {
    if (!open) return;
    const first = recipients[0]?.normalized;
    const firstLang = smsLangForLocale(first?.locale);
    setSingleBody(renderSmsBody(defaultSmsBody(firstLang), first?.firstName));
    setOverrides({});
    setOutcomes(null);
    setAiError('');
    setSendError('');
    setLinksLoading(true);
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        eligible.map(async (r) => [r.id, await store.ensureLink(r)] as const),
      );
      if (cancelled) return;
      setLinks(Object.fromEntries(entries));
      setLinksLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipientKey]);

  /** The standard brand body in the recipient's own language, name rendered. */
  function localizedStandardBody(rec: StagingCustomer): string {
    const body = defaultSmsBody(smsLangForLocale(rec.normalized.locale));
    return renderSmsBody(body, rec.normalized.firstName);
  }

  function bodyNoLink(rec: StagingCustomer): string {
    if (mode === 'single') return singleBody;
    return overrides[rec.id] ?? localizedStandardBody(rec);
  }

  function finalBody(rec: StagingCustomer): string {
    const link = links[rec.id];
    const url = link ? recoveryUrl(link.token) : '<recovery link>';
    return `${bodyNoLink(rec).trim()}\n${url}`;
  }

  async function personaliseSingle() {
    setAiBusy(true);
    setAiError('');
    try {
      setSingleBody(await personaliseSmsBody(recipients[0]));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  }

  async function personaliseEach() {
    setAiBusy(true);
    setAiError('');
    setAiProgress({ done: 0, total: eligible.length });
    const next: Record<string, string> = {};
    try {
      for (let i = 0; i < eligible.length; i++) {
        try {
          next[eligible[i].id] = await personaliseSmsBody(eligible[i]);
        } catch {
          // Leave this recipient on the shared template if its AI call fails.
        }
        setOverrides({ ...next });
        setAiProgress({ done: i + 1, total: eligible.length });
      }
    } finally {
      setAiBusy(false);
      setAiProgress(null);
    }
  }

  async function handleSend() {
    setSending(true);
    setSendError('');
    try {
      const reqs: SmsRequest[] = eligible.map((r) => ({
        customerId: r.id,
        to: r.normalized.phone,
        body: finalBody(r),
      }));
      const res = await sendSmsBatch(reqs, getToken);
      // Persist sent + publish each record so the link resolves on the
      // customer's phone (durable backend) or is marked sent locally.
      await Promise.all(
        res
          .filter((o) => o.status !== 'failed')
          .map(async (o) => {
            const link = links[o.customerId];
            const rec = eligible.find((r) => r.id === o.customerId);
            const req = reqs.find((q) => q.customerId === o.customerId);
            if (link && rec && req) await store.recordSent(rec, link, req.body);
          }),
      );
      setOutcomes(res);
      onSent?.(res);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const dry = smsDryRun();
  const singleLang = smsLangForLocale(recipients[0]?.normalized.locale);
  const sample = eligible[0] ? finalBody(eligible[0]) : '';
  const len = sample ? smsLength(sample) : null;

  const sentCount = outcomes?.filter((o) => o.status !== 'failed').length ?? 0;
  const failedCount = outcomes?.filter((o) => o.status === 'failed').length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Send recovery SMS</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {eligible.length} recipient{eligible.length === 1 ? '' : 's'}
              {excludedCount > 0 && (
                <span className="text-amber-600"> · {excludedCount} skipped (no valid phone)</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none cursor-pointer"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {dry && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            Dry run — messages are logged to the console and simulated, not actually sent. Set{' '}
            <code className="font-mono">VITE_SMS_DRYRUN=false</code> with a configured provider to
            send for real.
          </div>
        )}

        {outcomes ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm">
              <p className="font-medium text-gray-900">
                {dry ? 'Simulated' : 'Sent'} {sentCount} message{sentCount === 1 ? '' : 's'}
                {failedCount > 0 && <span className="text-red-600"> · {failedCount} failed</span>}
              </p>
              {failedCount > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-red-700">
                  {outcomes
                    .filter((o) => o.status === 'failed')
                    .map((o) => (
                      <li key={o.customerId}>
                        {o.to || o.customerId}: {o.error}
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : eligible.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              None of the selected records have a phone number in E.164 format (e.g. +39…), so there
              is no one to text. Add or fix a phone number first.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            {mode === 'single' ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-600">
                    Message
                    <span className="ml-1 font-normal text-gray-400">
                      ({langLabel(singleLang)} · from locale {recipients[0]?.normalized.locale || '—'})
                    </span>
                  </label>
                  <Button
                    variant="outline"
                    onClick={personaliseSingle}
                    isLoading={aiBusy}
                    className="text-xs py-1 px-2"
                  >
                    ✨ Personalise with AI
                  </Button>
                </div>
                <textarea
                  value={singleBody}
                  onChange={(e) => setSingleBody(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                {aiError && <p className="text-xs text-red-600 mt-1">AI failed: {aiError}</p>}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">
                    Each recipient receives the standard message in their own language.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {langBreakdown.map(([code, count]) => (
                      <span
                        key={code}
                        className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-xs text-gray-600"
                      >
                        {langLabel(code)} · {count}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-gray-400">
                    {Object.keys(overrides).length > 0
                      ? `${Object.keys(overrides).length} recipient(s) AI-personalised (overrides the standard text).`
                      : 'Optional: tailor each message with AI.'}
                  </p>
                  <Button
                    variant="outline"
                    onClick={personaliseEach}
                    isLoading={aiBusy}
                    className="text-xs py-1 px-2 shrink-0"
                  >
                    ✨ Personalise each with AI
                  </Button>
                </div>
                {aiError && <p className="text-xs text-red-600">AI failed: {aiError}</p>}
              </div>
            )}

            {aiProgress && (
              <p className="text-xs text-gray-500">
                Personalising… {aiProgress.done}/{aiProgress.total}
              </p>
            )}

            {len && (
              <p className="text-xs text-gray-400">
                {len.length} chars · {len.segments} SMS segment{len.segments === 1 ? '' : 's'} ·{' '}
                {len.encoding} (incl. link)
                {len.segments > 1 && <span className="text-amber-600"> · over one SMS</span>}
              </p>
            )}

            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                Preview
              </p>
              {linksLoading ? (
                <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-500">
                  Preparing link…
                </div>
              ) : mode === 'single' ? (
                <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-800 whitespace-pre-line break-words">
                  {sample}
                </div>
              ) : (
                <div className="space-y-2">
                  {previews.map(({ lang: pl, rec }) => (
                    <div key={pl}>
                      <p className="text-[11px] text-gray-400 mb-0.5">
                        {langLabel(pl)} · e.g. {rec.normalized.firstName || 'recipient'}
                      </p>
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-800 whitespace-pre-line break-words">
                        {finalBody(rec)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {sendError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 break-words">
                {sendError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                isLoading={sending}
                disabled={linksLoading || aiBusy}
              >
                {dry ? 'Simulate send' : 'Send SMS'} ({eligible.length})
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
