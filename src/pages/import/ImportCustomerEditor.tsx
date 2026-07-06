import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../lib/auth';
import { getCustomer } from '../../lib/import/recovery-backend/staging-client';
import { persistCustomer } from '../../lib/import/staging-sync';
import type { NormalizedChild, RecoveryLink, RecoveryStage, StagingCustomer } from '../../lib/import/types';
import { managerStage } from '../../lib/import/outreach-stats';
import { repairRecord, applyRepairPatches } from '../../lib/import/openai-normalize';
import { refreshStaging } from '../../lib/import/normalize';
import { getRecoveryStore } from '../../lib/import/recovery-store';
import {
  mergeSubmission,
  type RecoverySubmission,
} from '../../lib/import/recovery-backend/firestore-shapes';
import { recoveryUrl, EMAIL_REGEX, E164_REGEX } from '../../lib/import/recovery';
import { SmsComposer } from './SmsComposer';
import { customerApi, ApiError } from '../../lib/api-client';
import { LOCALE_OPTIONS, isSupportedLocale } from '../../lib/api-transforms';
import { createOrUpdateCrmAccount, CrmValidationError } from '../../lib/import/crm-create';
import { badgeColor } from './badge';

export function ImportCustomerEditor() {
  const { importId, customerNo } = useParams<{ importId: string; customerNo: string }>();
  const { session, getValidToken } = useAuth();
  const navigate = useNavigate();

  const [rec, setRec] = useState<StagingCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiError, setAiError] = useState('');
  const [dupChecking, setDupChecking] = useState(false);
  const [dupNotice, setDupNotice] = useState<string>('');
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState('');
  const [link, setLink] = useState<RecoveryLink | null>(null);
  const [smsOpen, setSmsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [stageBusy, setStageBusy] = useState(false);
  const [stageError, setStageError] = useState('');

  const store = useMemo(() => getRecoveryStore({ getToken: getValidToken }), [getValidToken]);
  const id = session && customerNo ? `${session.storeId}:${customerNo}` : '';

  useEffect(() => {
    if (!id) return;
    (async () => {
      const token = await getValidToken();
      const c = await getCustomer(id, token);
      const lnk = (await store.getLinkForCustomer(id).catch(() => undefined)) ?? null;
      setLink(lnk);

      // The customer's recovery-page submission lives in the link doc, NOT on the
      // staging record we just read. Pull it live from Mongo and fold it in on
      // open, then persist so the recovered email/phone is durable and shows
      // everywhere — no manual "Sync from customer" needed.
      let rec = c ?? null;
      if (rec && lnk) {
        try {
          const sub = await store.pullSubmission(lnk.token);
          if (sub && submissionHasData(sub)) {
            const merged = mergeSubmission(rec, sub);
            if (JSON.stringify(merged.normalized) !== JSON.stringify(rec.normalized)) {
              rec = await persistCustomer(
                { ...merged, customerSubmittedAt: Date.now() },
                getValidToken,
              );
            }
          }
        } catch {
          // Network/submission read failure shouldn't block opening the record;
          // the manual "Sync from customer" button remains as a fallback.
        }
      }
      setRec(rec);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <p className="p-8 text-gray-400 text-sm">Loading…</p>;
  if (!rec) return <p className="p-8 text-gray-500">Record not found.</p>;

  // Local field state via direct mutation of `rec.normalized` would re-render
  // weirdly; instead we expose setters that build a new object.
  const N = rec.normalized;

  function setField<K extends keyof typeof N>(key: K, value: (typeof N)[K]) {
    setRec((prev) =>
      prev ? { ...prev, normalized: { ...prev.normalized, [key]: value } } : prev,
    );
  }
  function setChild(i: number, patch: Partial<NormalizedChild>) {
    setRec((prev) => {
      if (!prev) return prev;
      const children = [...prev.normalized.children];
      children[i] = { ...children[i], ...patch };
      return { ...prev, normalized: { ...prev.normalized, children } };
    });
  }
  function addChild() {
    setRec((prev) => {
      if (!prev) return prev;
      if (prev.normalized.children.length >= 4) return prev;
      return {
        ...prev,
        normalized: {
          ...prev.normalized,
          children: [
            ...prev.normalized.children,
            { dayMonth: '', yearKnown: false },
          ],
        },
      };
    });
  }
  function removeChild(i: number) {
    setRec((prev) => {
      if (!prev) return prev;
      const children = prev.normalized.children.filter((_, idx) => idx !== i);
      return { ...prev, normalized: { ...prev.normalized, children } };
    });
  }

  async function handleSave() {
    if (!rec) return;
    // Refresh derived flags/status so edits (e.g. fixing a phone to +39…) clear
    // stale badges like "not E.164".
    const refreshed = refreshStaging(rec);
    setRec(await persistCustomer(refreshed, getValidToken));
  }

  async function handleRunAi() {
    if (!rec) return;
    setAiRunning(true);
    setAiError('');
    try {
      const result = await repairRecord(rec);
      const patched = applyRepairPatches(rec, result);
      setRec(await persistCustomer(patched, getValidToken));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiRunning(false);
    }
  }

  async function handleCheckDuplicate() {
    if (!rec || !session) return;
    setDupChecking(true);
    setDupNotice('');
    try {
      const token = await getValidToken();
      const checks: string[] = [];
      if (rec.normalized.email && EMAIL_REGEX.test(rec.normalized.email)) {
        const r = await customerApi.checkEmailExists(rec.normalized.email, token);
        if (r.exists) checks.push(`email "${rec.normalized.email}" already exists in CRM`);
      }
      if (rec.normalized.phone && E164_REGEX.test(rec.normalized.phone)) {
        const r = await customerApi.checkPhoneExists(rec.normalized.phone, token);
        if (r.exists) checks.push(`phone "${rec.normalized.phone}" already exists in CRM`);
      }
      if (checks.length > 0) {
        setDupNotice(checks.join('; '));
        const patched: StagingCustomer = {
          ...rec,
          status: 'duplicate',
          flags: { ...rec.flags, alreadyInCrm: true },
        };
        setRec(await persistCustomer(patched, getValidToken));
      } else {
        setDupNotice('No existing CRM record found.');
      }
    } catch (e) {
      setDupNotice(`Check failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDupChecking(false);
    }
  }

  async function handleApprove() {
    if (!rec || !session) return;
    setApproveError('');
    setApproving(true);
    try {
      const token = await getValidToken();
      // Same create/update path the recovery→CRM queue uses.
      const { accountId } = await createOrUpdateCrmAccount(rec, token, session.storeId);
      const patched: StagingCustomer = {
        ...rec,
        status: 'created',
        createdAccountId: accountId,
        lastError: undefined,
      };
      setRec(await persistCustomer(patched, getValidToken));
      // Reflect the conversion in the outreach funnel (best-effort).
      if (link) void store.setStage(link.token, 'converted').catch(() => {});
      // Bounce back to the list after success.
      setTimeout(() => navigate(`/import/${importId}`), 800);
    } catch (e) {
      const msg =
        e instanceof CrmValidationError
          ? e.message
          : e instanceof ApiError
            ? `${e.status}: ${e.message}`
            : e instanceof Error
              ? e.message
              : String(e);
      setApproveError(msg);
      const patched: StagingCustomer = {
        ...rec,
        status: 'failed',
        lastError: msg,
      };
      setRec(await persistCustomer(patched, getValidToken));
    } finally {
      setApproving(false);
    }
  }

  async function handleContacted() {
    if (!rec) return;
    const patched: StagingCustomer = { ...rec, contactedAt: Date.now() };
    setRec(await persistCustomer(patched, getValidToken));
  }

  async function handleSkip() {
    if (!rec) return;
    const patched: StagingCustomer = { ...rec, status: 'skipped' };
    setRec(await persistCustomer(patched, getValidToken));
    navigate(`/import/${importId}`);
  }

  async function handlePreviewRecovery() {
    if (!rec || !session) return;
    const fresh = await store.ensureLink(rec);
    // Publish so the link resolves even on a durable backend / another device.
    await store.publish(rec, fresh);
    setLink(fresh);
    window.open(recoveryUrl(fresh.token), '_blank', 'noopener');
  }

  async function handleSmsSent() {
    if (!rec) return;
    // Reflect the new send state + treat an SMS as having contacted the customer.
    const fresh = (await store.getLinkForCustomer(rec.id).catch(() => undefined)) ?? null;
    setLink(fresh);
    // Advance the outreach funnel to `sent` without downgrading a manual stage.
    if (fresh && (!fresh.stage || fresh.stage === 'new')) {
      void store.setStage(fresh.token, 'sent').catch(() => {});
    }
    if (!rec.contactedAt) {
      const patched: StagingCustomer = { ...rec, contactedAt: Date.now() };
      setRec(await persistCustomer(patched, getValidToken));
    }
  }

  /** Advance the recovery outreach funnel stage for this customer. */
  async function changeStage(stage: RecoveryStage) {
    if (!rec) return;
    setStageBusy(true);
    setStageError('');
    try {
      // The stage lives on the recovery link doc — mint/publish one if the
      // customer never had a link yet, so the controls always work.
      let l = link;
      if (!l) {
        l = await store.ensureLink(rec);
        await store.publish(rec, l);
      }
      await store.setStage(l.token, stage);
      setLink({ ...l, stage });
    } catch (e) {
      setStageError(e instanceof Error ? e.message : String(e));
    } finally {
      setStageBusy(false);
    }
  }

  /** Pull what the customer submitted on the durable backend into the local record. */
  async function handleSyncSubmission() {
    if (!rec || !link) return;
    setSyncing(true);
    setSyncNotice('');
    try {
      const sub = await store.pullSubmission(link.token);
      if (!sub || (!sub.email && !sub.phone && !sub.consent && !sub.children?.length)) {
        setSyncNotice('No customer submission yet.');
        return;
      }
      const merged = { ...mergeSubmission(rec, sub), customerSubmittedAt: Date.now() };
      setRec(await persistCustomer(merged, getValidToken));
      setSyncNotice('Synced the customer’s submitted details.');
    } catch (e) {
      setSyncNotice(`Sync failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link
          to={`/import/${importId}`}
          className="text-xs text-gray-500 hover:text-gray-900"
        >
          ← Back to review queue
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1">
          {rec.normalized.firstName || '(no first name)'}{' '}
          {rec.normalized.lastName || '(no last name)'}
        </h1>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded-md text-xs font-medium ${badgeColor(rec.status)}`}
          >
            {rec.status}
          </span>
          <span className="text-xs text-gray-400">CSV ID {rec.customerId}</span>
          {rec.contactedAt && (
            <span className="text-xs text-blue-700">
              Contacted {new Date(rec.contactedAt).toLocaleDateString()}
            </span>
          )}
          {rec.customerSubmittedAt && (
            <span className="text-xs text-emerald-700">
              Customer updated info {new Date(rec.customerSubmittedAt).toLocaleDateString()}
            </span>
          )}
          {link?.sentAt && (
            <span className="text-xs text-indigo-700">
              SMS sent {new Date(link.sentAt).toLocaleDateString()}
              {link.sendCount && link.sendCount > 1 ? ` (${link.sendCount}×)` : ''}
            </span>
          )}
        </div>
      </div>

      <RecoveryFunnelPanel
        stage={link ? managerStage(link) : 'new'}
        busy={stageBusy}
        error={stageError}
        onChange={changeStage}
      />

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="min-w-0">
      {rec.aiNotes && (
        <Card className="mb-4 !p-4 bg-purple-50/50 border-purple-200">
          <p className="text-xs font-semibold text-purple-900 uppercase tracking-wider mb-1">
            AI Notes
            {rec.aiConfidence !== undefined && (
              <span className="ml-2 font-normal text-purple-600">
                confidence {(rec.aiConfidence * 100).toFixed(0)}%
              </span>
            )}
          </p>
          <p className="text-sm text-purple-900 whitespace-pre-line">{rec.aiNotes}</p>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Identity">
          <div className="space-y-3">
            <Input
              label="First name"
              value={N.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
            />
            <Input
              label="Last name"
              value={N.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={N.email}
              onChange={(e) => setField('email', e.target.value)}
              error={
                N.email && !EMAIL_REGEX.test(N.email)
                  ? 'Looks malformed'
                  : undefined
              }
            />
            <Input
              label="Phone (E.164, e.g. +39…)"
              value={N.phone}
              onChange={(e) => setField('phone', e.target.value)}
              error={
                N.phone && !E164_REGEX.test(N.phone)
                  ? 'Must start with + and country code'
                  : undefined
              }
            />
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Locale</label>
              <select
                value={N.locale}
                onChange={(e) => setField('locale', e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {N.locale && !isSupportedLocale(N.locale) && (
                  <option value={N.locale}>{N.locale} (unsupported)</option>
                )}
                {LOCALE_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label} ({o.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Store country: {N.country || '—'}
                {N.localeSource && (
                  <>
                    {' · '}
                    <span className={N.localeSource === 'fallback' ? 'text-amber-600' : ''}>
                      auto: {N.localeSource}
                      {typeof N.localeConfidence === 'number' &&
                        ` (${(N.localeConfidence * 100).toFixed(0)}%)`}
                    </span>
                  </>
                )}
              </p>
              {N.localeReason && (
                <p className="text-xs text-gray-400 mt-0.5 italic">{N.localeReason}</p>
              )}
            </div>
          </div>
        </Card>

        <Card title="Source record">
          <dl className="text-sm divide-y divide-gray-100">
            {sourceFields(rec).map((f) => (
              <Field key={f.k} k={f.k} v={f.v} />
            ))}
          </dl>
        </Card>
      </div>

      <Card title="Children" className="mt-4">
        {rec.normalized.children.length === 0 ? (
          <p className="text-sm text-gray-400">No children data on this record.</p>
        ) : (
          <div className="space-y-4">
            {rec.normalized.children.map((c, i) => (
              <div key={i} className="grid md:grid-cols-6 gap-3 items-end border-b pb-3 last:border-b-0">
                <Input
                  label="Name"
                  value={c.name ?? ''}
                  onChange={(e) => setChild(i, { name: e.target.value })}
                />
                <Input
                  label="Day/Month (DD/MM)"
                  value={c.dayMonth}
                  onChange={(e) => setChild(i, { dayMonth: e.target.value })}
                />
                <Input
                  label="Year"
                  type="number"
                  value={c.year ?? ''}
                  onChange={(e) => {
                    const y = e.target.value ? Number(e.target.value) : undefined;
                    setChild(i, { year: y, yearKnown: y !== undefined });
                  }}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Gender</label>
                  <select
                    value={c.gender ?? ''}
                    onChange={(e) =>
                      setChild(i, { gender: (e.target.value || undefined) as 'Male' | 'Female' | undefined })
                    }
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="">—</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <Input
                  label="Height (cm)"
                  type="number"
                  value={c.height ?? ''}
                  onChange={(e) =>
                    setChild(i, { height: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
                <div className="flex items-end gap-2">
                  <Input
                    label="Shoe size"
                    type="number"
                    value={c.shoeSize ?? ''}
                    onChange={(e) =>
                      setChild(i, { shoeSize: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeChild(i)}
                    className="text-xs text-red-500 hover:text-red-700 pb-3 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {rec.normalized.children.length < 4 && (
          <Button variant="outline" onClick={addChild} className="text-sm mt-3">
            + Add child
          </Button>
        )}
      </Card>

      <Card title="Notes" className="mt-4">
        <textarea
          value={rec.reviewNotes ?? ''}
          onChange={(e) =>
            setRec((p) => (p ? { ...p, reviewNotes: e.target.value } : p))
          }
          rows={3}
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="What did the customer say? What's still missing?"
        />
      </Card>

        </div>

        <aside className="lg:sticky lg:top-[68px] self-start space-y-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</p>

            <Button onClick={handleApprove} isLoading={approving} className="w-full">
              Approve &amp; create
            </Button>

            <div className="space-y-2 border-t border-gray-100 pt-3">
              <Button
                variant="outline"
                onClick={handleRunAi}
                isLoading={aiRunning}
                className="w-full text-sm"
              >
                Run AI repair
              </Button>
              <Button
                variant="outline"
                onClick={handleCheckDuplicate}
                isLoading={dupChecking}
                className="w-full text-sm"
              >
                Check CRM duplicate
              </Button>
              <Button
                variant="outline"
                onClick={handlePreviewRecovery}
                className="w-full text-sm"
              >
                Preview recovery page ↗
              </Button>
              <Button
                variant="outline"
                onClick={() => setSmsOpen(true)}
                className="w-full text-sm"
              >
                Compose &amp; send SMS
              </Button>
              <Button
                variant="outline"
                onClick={handleSyncSubmission}
                isLoading={syncing}
                disabled={!link}
                className="w-full text-sm"
              >
                Sync from customer ⤓
              </Button>
              <Button variant="outline" onClick={handleSave} className="w-full text-sm">
                Save draft
              </Button>
            </div>
            {syncNotice && (
              <p className="text-xs text-gray-500 border-t border-gray-100 pt-2">{syncNotice}</p>
            )}

            <div className="space-y-2 border-t border-gray-100 pt-3">
              <Button variant="outline" onClick={handleContacted} className="w-full text-sm">
                {rec.contactedAt ? 'Re-mark contacted' : 'Mark contacted'}
              </Button>
              <Button variant="outline" onClick={handleSkip} className="w-full text-sm">
                Skip
              </Button>
            </div>
          </div>

          {dupNotice && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 break-words">
              {dupNotice}
            </div>
          )}
          {aiError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 break-words">
              AI repair failed: {aiError}
            </div>
          )}
          {approveError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 break-words">
              {approveError}
            </div>
          )}
          {rec.lastError && rec.status === 'failed' && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 break-words">
              Last attempt failed: {rec.lastError}
            </div>
          )}
        </aside>
      </div>

      <SmsComposer
        open={smsOpen}
        recipients={[rec]}
        getToken={getValidToken}
        onClose={() => setSmsOpen(false)}
        onSent={handleSmsSent}
      />
    </div>
  );
}

/** Does a pulled submission carry anything worth folding into the record? */
function submissionHasData(sub: RecoverySubmission): boolean {
  return Boolean(sub.email || sub.phone || sub.consent || sub.children?.length);
}

/** Build the Source-record rows for whichever export this record came from. */
function sourceFields(rec: StagingCustomer): Array<{ k: string; v: string | undefined }> {
  if (rec.sourceSchema === 'retail') {
    const s = rec.source as import('../../lib/import/types').RawRetailRow;
    const m = rec.metrics;
    return [
      { k: 'Store Name', v: s.storeName },
      { k: 'Store group', v: s.sub },
      { k: 'Cust SID', v: s.custSid },
      { k: 'Cust ID', v: s.custId },
      { k: 'Country code', v: `${s.countryCode || '—'} (store default — not used for locale)` },
      { k: 'Phone 1', v: s.phone1 },
      { k: 'Phone 2', v: s.phone2 },
      { k: 'Compleanno 1', v: s.compl1 },
      { k: 'Compleanno 2', v: s.compl2 },
      { k: 'Last sale', v: s.lastSaleDate + (s.dateExcelSerial === '1' ? ' (date may be day/month-swapped)' : '') },
      { k: 'Total sales', v: m?.totalSales !== undefined ? String(m.totalSales) : s.totalSales },
      { k: 'Store credit', v: m?.storeCredit !== undefined ? String(m.storeCredit) : s.storeCredit },
    ];
  }
  const s = rec.source as import('../../lib/import/types').RawCsvRow;
  return [
    { k: 'CSV Store', v: s.store },
    { k: 'Country', v: s.country },
    { k: 'Type', v: s.type },
    { k: 'Customer ID', v: s.customerId },
    { k: 'Email', v: s.email },
    { k: 'Phone 1', v: s.phone1 },
    { k: 'Phone 2', v: s.phone2 },
    { k: 'Compleanno 1', v: s.compleanno1 },
    { k: 'Compleanno 2', v: s.compleanno2 },
    { k: 'Added', v: s.customerAdded },
    { k: 'Last sale', v: s.customerLastSaleDate },
  ];
}

function Field({ k, v }: { k: string; v: string | undefined }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-1.5">
      <dt className="text-xs text-gray-400 uppercase tracking-wider">{k}</dt>
      <dd className="text-gray-700 text-sm">{v || <span className="text-gray-300">—</span>}</dd>
    </div>
  );
}

/** Order used to decide which funnel steps are done/active/todo. */
const STAGE_ORDER: Record<RecoveryStage, number> = {
  new: 0,
  sent: 1,
  manual1: 2,
  manual2: 3,
  dormant: 4,
  converted: 5,
};

const FUNNEL_STEPS: { key: RecoveryStage; label: string; hint: string }[] = [
  { key: 'sent', label: 'SMS sent', hint: 'Recovery link sent' },
  { key: 'manual1', label: 'Manual contact 1', hint: 'Store phoned them' },
  { key: 'manual2', label: 'Manual contact 2', hint: 'Second call' },
  { key: 'dormant', label: 'Dormant', hint: 'Sleeping / paused' },
];

/**
 * Prominent, top-of-page recovery funnel for a single customer: a horizontal
 * stepper showing where they are, plus the manager's next-action buttons.
 */
function RecoveryFunnelPanel({
  stage,
  busy,
  error,
  onChange,
}: {
  stage: RecoveryStage;
  busy: boolean;
  error: string;
  onChange: (s: RecoveryStage) => void;
}) {
  const reached = STAGE_ORDER[stage];
  const converted = stage === 'converted';

  return (
    <Card className="mb-6 !p-5 border-2 border-gray-900/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Recovery funnel
          </p>
          <p className="text-sm text-gray-500">
            Where this customer is — tap any step to set it, or use the buttons below.
          </p>
        </div>
        {converted && (
          <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
            ✓ Converted — in CRM
          </span>
        )}
      </div>

      {/* Horizontal stepper */}
      <div className="flex items-start overflow-x-auto pb-1">
        {FUNNEL_STEPS.map((step, i) => {
          const pos = STAGE_ORDER[step.key];
          const done = converted || reached > pos;
          const active = !converted && reached === pos;
          const isDormant = step.key === 'dormant';
          const circle = done
            ? 'bg-emerald-500 text-white border-emerald-500'
            : active
              ? isDormant
                ? 'bg-slate-500 text-white border-slate-500'
                : 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-400 border-gray-300';
          return (
            <div key={step.key} className="flex items-start shrink-0">
              <button
                type="button"
                onClick={() => onChange(step.key)}
                disabled={busy || converted || active}
                title={active ? `Current stage: ${step.label}` : `Set stage to “${step.label}”`}
                className="flex flex-col items-center w-28 text-center group disabled:cursor-default enabled:cursor-pointer"
              >
                <div
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold transition ${circle} ${
                    !busy && !converted && !active
                      ? 'group-hover:ring-2 group-hover:ring-gray-900/20 group-hover:border-gray-400'
                      : ''
                  }`}
                >
                  {done ? '✓' : i + 1}
                </div>
                <span
                  className={`text-xs font-medium mt-1.5 ${active ? 'text-gray-900' : done ? 'text-emerald-700' : 'text-gray-500 group-hover:text-gray-900'}`}
                >
                  {step.label}
                </span>
                <span className="text-[10px] text-gray-400 leading-tight mt-0.5">{step.hint}</span>
              </button>
              {i < FUNNEL_STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-8 mt-4 ${converted || reached > pos ? 'bg-emerald-400' : 'bg-gray-200'}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Next-action buttons */}
      {!converted && (
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-gray-100">
          <span className="text-xs text-gray-400 uppercase tracking-wider mr-1">Actions</span>
          {(stage === 'new' || stage === 'sent') && (
            <Button onClick={() => onChange('manual1')} disabled={busy} className="text-sm py-1.5 px-3">
              📞 Log 1st manual contact
            </Button>
          )}
          {stage === 'manual1' && (
            <Button onClick={() => onChange('manual2')} disabled={busy} className="text-sm py-1.5 px-3">
              📞 Log 2nd manual contact
            </Button>
          )}
          {stage === 'manual2' && (
            <span className="text-sm text-gray-500">Both manual contacts logged.</span>
          )}
          {stage !== 'dormant' ? (
            <Button
              variant="outline"
              onClick={() => onChange('dormant')}
              disabled={busy}
              className="text-sm py-1.5 px-3"
            >
              😴 Mark as dormant
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => onChange('sent')}
              disabled={busy}
              className="text-sm py-1.5 px-3"
            >
              ↻ Reactivate
            </Button>
          )}
          {busy && <span className="text-xs text-gray-400">Saving…</span>}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </Card>
  );
}
