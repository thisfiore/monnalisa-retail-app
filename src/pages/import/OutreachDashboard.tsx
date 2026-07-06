import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuth } from '../../lib/auth';
import { getImport, pullCustomers } from '../../lib/import/recovery-backend/staging-client';
import { getRecoveryStore } from '../../lib/import/recovery-store';
import {
  computeFunnel,
  computeManagerFunnel,
  managerStage,
  recoveryState,
  isReadyForCrm,
  type RecoveryState,
} from '../../lib/import/outreach-stats';
import { processCrmQueue } from '../../lib/import/crm-queue';
import { EMAIL_REGEX, E164_REGEX } from '../../lib/import/recovery';
import type {
  ImportRecord,
  RecoveryLink,
  RecoveryStage,
  StagingCustomer,
} from '../../lib/import/types';

const STATE_STYLE: Record<RecoveryState, { label: string; cls: string }> = {
  'not-sent': { label: 'Not sent', cls: 'bg-gray-100 text-gray-500' },
  sent: { label: 'Sent', cls: 'bg-blue-100 text-blue-700' },
  opened: { label: 'Opened', cls: 'bg-indigo-100 text-indigo-700' },
  step1: { label: 'Step 1 done', cls: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700' },
  expired: { label: 'Expired', cls: 'bg-red-100 text-red-600' },
};

const STAGE_STYLE: Record<RecoveryStage, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-gray-100 text-gray-500' },
  sent: { label: 'SMS sent', cls: 'bg-blue-100 text-blue-700' },
  manual1: { label: 'Contacted 1×', cls: 'bg-amber-100 text-amber-800' },
  manual2: { label: 'Contacted 2×', cls: 'bg-orange-100 text-orange-800' },
  dormant: { label: 'Dormant', cls: 'bg-slate-200 text-slate-600' },
  converted: { label: 'Converted', cls: 'bg-green-100 text-green-700' },
};

const STAGE_FILTER_CARDS: { key: RecoveryStage; label: string; sub: string; tint: string }[] = [
  { key: 'new', label: 'New', sub: 'not yet sent', tint: 'text-gray-600' },
  { key: 'sent', label: 'SMS sent', sub: 'awaiting reply', tint: 'text-blue-700' },
  { key: 'manual1', label: 'Contacted 1×', sub: 'manual call', tint: 'text-amber-700' },
  { key: 'manual2', label: 'Contacted 2×', sub: 'second call', tint: 'text-orange-700' },
  { key: 'dormant', label: 'Dormant', sub: 'sleeping', tint: 'text-slate-600' },
  { key: 'converted', label: 'Converted', sub: 'in CRM', tint: 'text-green-700' },
];

const fmt = (ms?: number) => (ms ? new Date(ms).toLocaleDateString() : '—');

export function OutreachDashboard() {
  const { importId } = useParams<{ importId: string }>();
  const { session, getValidToken } = useAuth();

  const store = useMemo(() => getRecoveryStore({ getToken: getValidToken }), [getValidToken]);

  const [importRec, setImportRec] = useState<ImportRecord | null>(null);
  const [links, setLinks] = useState<RecoveryLink[]>([]);
  const [byId, setById] = useState<Record<string, StagingCustomer>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [queueMsg, setQueueMsg] = useState('');
  const autoRan = useRef(false);

  const refreshLinks = useCallback(async () => {
    if (!importId) return;
    const list = await store
      .listLinksForImport(importId)
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        return [] as RecoveryLink[];
      });
    setLinks(list);
  }, [importId, store]);

  useEffect(() => {
    if (!session || !importId) return;
    (async () => {
      const token = await getValidToken();
      const [rec, linkList, customers] = await Promise.all([
        getImport(importId, token),
        store.listLinksForImport(importId).catch((e) => {
          setError(e instanceof Error ? e.message : String(e));
          return [] as RecoveryLink[];
        }),
        pullCustomers(importId, token),
      ]);
      setImportRec(rec ?? null);
      setLinks(linkList);
      setById(Object.fromEntries(customers.map((c) => [c.id, c])));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, importId]);

  const funnel = useMemo(() => computeFunnel(links), [links]);
  const mfunnel = useMemo(() => computeManagerFunnel(links), [links]);

  const runQueue = useCallback(async () => {
    if (!session || processing) return;
    setProcessing(true);
    setQueueMsg('');
    try {
      const summary = await processCrmQueue({
        storeId: session.storeId,
        getToken: getValidToken,
        store,
        importId,
      });
      const parts = [
        summary.created ? `${summary.created} created` : '',
        summary.updated ? `${summary.updated} updated` : '',
        summary.failed ? `${summary.failed} failed` : '',
        summary.skipped ? `${summary.skipped} skipped` : '',
      ].filter(Boolean);
      setQueueMsg(
        summary.total === 0 ? 'Queue empty — nothing to sync.' : `Processed ${summary.total}: ${parts.join(', ')}.`,
      );
      await refreshLinks();
    } catch (e) {
      setQueueMsg(`Queue failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProcessing(false);
    }
  }, [session, processing, getValidToken, store, importId, refreshLinks]);

  // Auto-drain the CRM queue once on open when there's work pending.
  useEffect(() => {
    if (loading || autoRan.current) return;
    if (mfunnel.crmQueue > 0) {
      autoRan.current = true;
      void runQueue();
    }
  }, [loading, mfunnel.crmQueue, runQueue]);

  const changeStage = useCallback(
    async (token: string, stage: RecoveryStage) => {
      setLinks((prev) => prev.map((l) => (l.token === token ? { ...l, stage } : l)));
      try {
        await store.setStage(token, stage);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        await refreshLinks(); // revert optimistic change on failure
      }
    },
    [store, refreshLinks],
  );

  const rows = useMemo(
    () =>
      links
        .map((l) => ({ link: l, cust: byId[l.customerId], state: recoveryState(l) }))
        .sort((a, b) => (b.link.sentAt ?? b.link.createdAt) - (a.link.sentAt ?? a.link.createdAt)),
    [links, byId],
  );

  // Funnel-stage filter for the recipients table.
  const [stageFilter, setStageFilter] = useState<RecoveryStage | 'all'>('all');
  const filteredRows = useMemo(
    () => (stageFilter === 'all' ? rows : rows.filter(({ link }) => managerStage(link) === stageFilter)),
    [rows, stageFilter],
  );

  // Customers who finished step 1 with a CRM-pushable contact + consent.
  const readyForCrm = useMemo(
    () =>
      rows.filter(({ link, cust }) => {
        if (!isReadyForCrm(link) || !cust) return false;
        const n = cust.normalized;
        return (
          EMAIL_REGEX.test(n.email || '') &&
          E164_REGEX.test(n.phone || '') &&
          cust.consent?.privacy === true &&
          cust.status !== 'created'
        );
      }).length,
    [rows],
  );

  if (loading) return <p className="p-8 text-gray-400 text-sm">Loading…</p>;
  if (!importRec) return <p className="p-8 text-gray-500">Import not found.</p>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Recovery outreach</p>
          <h1 className="text-xl font-bold text-gray-900">{importRec.filename}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {funnel.minted} link{funnel.minted === 1 ? '' : 's'} minted · {funnel.sent} SMS sent
          </p>
        </div>
        <Link to={`/import/${importId}`}>
          <Button variant="outline" className="text-sm py-1.5 px-3">
            ← Review queue
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          Couldn’t load tracking from the recovery backend: {error}
        </div>
      )}

      {/* CRM sync queue — customers who recovered their email get created/updated in the CRM. */}
      {(mfunnel.crmQueue > 0 || mfunnel.crmFailed > 0 || queueMsg) && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 mb-4 flex items-center justify-between gap-4">
          <div className="text-sm text-emerald-900">
            <span className="font-semibold">
              {mfunnel.crmQueue} to create/update in CRM
            </span>
            {mfunnel.crmFailed > 0 && (
              <span className="text-red-600"> · {mfunnel.crmFailed} failed (will retry)</span>
            )}
            {queueMsg && <p className="text-xs text-emerald-700 mt-0.5">{queueMsg}</p>}
          </div>
          <Button
            onClick={runQueue}
            disabled={processing || (mfunnel.crmQueue === 0 && mfunnel.crmFailed === 0)}
            className="text-sm py-1.5 px-3 shrink-0"
          >
            {processing ? 'Syncing…' : `Create/Update in CRM (${mfunnel.crmQueue + mfunnel.crmFailed})`}
          </Button>
        </div>
      )}

      {/* Manager outreach funnel (single-enum stages) — click a card to filter the list. */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-2">
        {STAGE_FILTER_CARDS.map((c) => (
          <FunnelCard
            key={c.key}
            label={c.label}
            value={mfunnel.byStage[c.key]}
            sub={c.sub}
            tint={c.tint}
            active={stageFilter === c.key}
            onClick={() => setStageFilter((prev) => (prev === c.key ? 'all' : c.key))}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 mb-6 text-xs text-gray-500">
        {stageFilter === 'all' ? (
          <span>Showing all {rows.length} recipient{rows.length === 1 ? '' : 's'}. Tap a card to filter.</span>
        ) : (
          <>
            <span>
              Filtered to <strong className="text-gray-700">{STAGE_STYLE[stageFilter].label}</strong> —{' '}
              {filteredRows.length} of {rows.length}.
            </span>
            <button
              type="button"
              onClick={() => setStageFilter('all')}
              className="px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium"
            >
              Clear filter
            </button>
          </>
        )}
      </div>

      {/* Funnel cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <FunnelCard label="SMS sent" value={funnel.sent} sub={`of ${funnel.minted} minted`} tint="text-blue-700" />
        <FunnelCard label="Opened" value={funnel.opened} sub={`${(funnel.openRate * 100).toFixed(0)}% open rate`} tint="text-indigo-700" />
        <FunnelCard label="Step 1 filled" value={funnel.step1} sub={`${(funnel.step1Rate * 100).toFixed(0)}% of sent`} tint="text-amber-700" />
        <FunnelCard label="Completed" value={funnel.completed} sub={`${(funnel.completedRate * 100).toFixed(0)}% of sent`} tint="text-green-700" />
        <FunnelCard label="Ready for CRM" value={readyForCrm} sub="consent + valid contact" tint="text-emerald-700" />
      </div>

      {/* Funnel bars */}
      <Card className="!p-4 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Conversion funnel</p>
        <div className="space-y-2">
          <FunnelBar label="SMS sent" n={funnel.sent} total={funnel.sent} tint="bg-blue-500" />
          <FunnelBar label="Opened" n={funnel.opened} total={funnel.sent} tint="bg-indigo-500" />
          <FunnelBar label="Step 1 · contact + consent" n={funnel.step1} total={funnel.sent} tint="bg-amber-500" />
          <FunnelBar label="Step 2 · completed" n={funnel.completed} total={funnel.sent} tint="bg-green-500" />
        </div>
        {funnel.expired > 0 && (
          <p className="text-xs text-red-600 mt-3">{funnel.expired} link(s) expired without completing.</p>
        )}
      </Card>

      {/* Recipients */}
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                <th className="text-left py-2.5 px-4">Customer</th>
                <th className="text-left py-2.5 px-4">Phone</th>
                <th className="text-left py-2.5 px-4">State</th>
                <th className="text-left py-2.5 px-4">Sent</th>
                <th className="text-left py-2.5 px-4">Opened</th>
                <th className="text-left py-2.5 px-4">Step 1</th>
                <th className="text-left py-2.5 px-4">Completed</th>
                <th className="text-left py-2.5 px-4">Consents</th>
                <th className="text-left py-2.5 px-4">Outreach</th>
                <th className="text-right py-2.5 px-4" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ link, cust, state }) => {
                const st = STATE_STYLE[state];
                const consent = cust?.consent;
                return (
                  <tr key={link.token} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-2.5 px-4">
                      <p className="font-medium text-gray-900">
                        {cust ? `${cust.normalized.firstName} ${cust.normalized.lastName}` : link.customerId}
                      </p>
                      {link.openCount ? (
                        <p className="text-xs text-gray-400">{link.openCount} open{link.openCount === 1 ? '' : 's'}</p>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600">{cust?.normalized.phone || '—'}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs">{fmt(link.sentAt)}</td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs">{fmt(link.openedAt)}</td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs">{fmt(link.step1SubmittedAt)}</td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs">{fmt(link.completedAt)}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex gap-1">
                        {consent?.loyalty && <Chip>loyalty</Chip>}
                        {consent?.marketing && <Chip>marketing</Chip>}
                        {consent?.privacy && <Chip>privacy</Chip>}
                        {!consent && <span className="text-gray-300 text-xs">—</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <StageActions
                        stage={managerStage(link)}
                        onChange={(s) => changeStage(link.token, s)}
                      />
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {cust && (
                        <Link to={`/import/${importId}/customer/${encodeURIComponent(cust.customerId)}`}>
                          <Button variant="outline" className="text-xs py-1 px-2">Open</Button>
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-400 text-sm">
                    {rows.length === 0
                      ? 'No recovery links yet. Select customers in the review queue and send an SMS.'
                      : `No customers in “${STAGE_STYLE[stageFilter as RecoveryStage].label}”.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FunnelCard({
  label,
  value,
  sub,
  tint,
  onClick,
  active,
}: {
  label: string;
  value: number;
  sub: string;
  tint: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <>
      <p className={`text-2xl font-bold ${tint}`}>{value.toLocaleString()}</p>
      <p className="text-xs font-medium text-gray-700 mt-0.5">{label}</p>
      <p className="text-[11px] text-gray-400">{sub}</p>
    </>
  );
  if (!onClick) {
    return <div className="bg-white rounded-lg border p-4">{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-white rounded-lg border p-4 text-left transition hover:border-gray-400 hover:shadow-sm ${
        active ? 'ring-2 ring-gray-900 border-gray-900' : ''
      }`}
    >
      {body}
    </button>
  );
}

function FunnelBar({ label, n, total, tint }: { label: string; n: number; total: number; tint: string }) {
  const pct = total > 0 ? (n / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-44 shrink-0 text-gray-600">{label}</span>
      <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
        <div className={`h-full ${tint} rounded`} style={{ width: `${Math.max(pct, n > 0 ? 2 : 0)}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right tabular-nums text-gray-700">
        {n.toLocaleString()} <span className="text-gray-400">({pct.toFixed(0)}%)</span>
      </span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium">{children}</span>
  );
}

/**
 * Stage badge + the manager's manual-contact funnel actions. `converted` is
 * terminal (set automatically when the CRM account is created), so it shows no
 * actions. The two manual-contact steps advance in order; dormant is reversible.
 */
function StageActions({
  stage,
  onChange,
}: {
  stage: RecoveryStage;
  onChange: (s: RecoveryStage) => void;
}) {
  const badge = STAGE_STYLE[stage];
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${badge.cls}`}>{badge.label}</span>
      {stage !== 'converted' && (
        <div className="flex flex-wrap gap-1">
          {(stage === 'new' || stage === 'sent') && (
            <StageBtn onClick={() => onChange('manual1')}>Called 1×</StageBtn>
          )}
          {stage === 'manual1' && <StageBtn onClick={() => onChange('manual2')}>Called 2×</StageBtn>}
          {stage !== 'dormant' && (
            <StageBtn onClick={() => onChange('dormant')} tone="muted">
              Dormant
            </StageBtn>
          )}
          {stage === 'dormant' && (
            <StageBtn onClick={() => onChange('sent')} tone="muted">
              Reactivate
            </StageBtn>
          )}
        </div>
      )}
    </div>
  );
}

function StageBtn({
  children,
  onClick,
  tone = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'default' | 'muted';
}) {
  const cls =
    tone === 'muted'
      ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
      : 'border-amber-300 text-amber-800 hover:bg-amber-50';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-1.5 py-0.5 rounded border text-[11px] font-medium ${cls}`}
    >
      {children}
    </button>
  );
}
