import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuth } from '../../lib/auth';
import { getImport, listCustomers } from '../../lib/import/staging-db';
import { getRecoveryStore } from '../../lib/import/recovery-store';
import {
  computeFunnel,
  recoveryState,
  isReadyForCrm,
  type RecoveryState,
} from '../../lib/import/outreach-stats';
import { EMAIL_REGEX, E164_REGEX } from '../../lib/import/recovery';
import type { ImportRecord, RecoveryLink, StagingCustomer } from '../../lib/import/types';

const STATE_STYLE: Record<RecoveryState, { label: string; cls: string }> = {
  'not-sent': { label: 'Not sent', cls: 'bg-gray-100 text-gray-500' },
  sent: { label: 'Sent', cls: 'bg-blue-100 text-blue-700' },
  opened: { label: 'Opened', cls: 'bg-indigo-100 text-indigo-700' },
  step1: { label: 'Step 1 done', cls: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700' },
  expired: { label: 'Expired', cls: 'bg-red-100 text-red-600' },
};

const fmt = (ms?: number) => (ms ? new Date(ms).toLocaleDateString() : '—');

export function OutreachDashboard() {
  const { importId } = useParams<{ importId: string }>();
  const { session, getValidToken } = useAuth();

  const [importRec, setImportRec] = useState<ImportRecord | null>(null);
  const [links, setLinks] = useState<RecoveryLink[]>([]);
  const [byId, setById] = useState<Record<string, StagingCustomer>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session || !importId) return;
    (async () => {
      const store = getRecoveryStore({ getToken: getValidToken });
      const [rec, linkList, customers] = await Promise.all([
        getImport(importId),
        store.listLinksForImport(importId).catch((e) => {
          setError(e instanceof Error ? e.message : String(e));
          return [] as RecoveryLink[];
        }),
        listCustomers({ storeId: session.storeId, importId }),
      ]);
      setImportRec(rec ?? null);
      setLinks(linkList);
      setById(Object.fromEntries(customers.map((c) => [c.id, c])));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, importId]);

  const funnel = useMemo(() => computeFunnel(links), [links]);

  const rows = useMemo(
    () =>
      links
        .map((l) => ({ link: l, cust: byId[l.customerId], state: recoveryState(l) }))
        .sort((a, b) => (b.link.sentAt ?? b.link.createdAt) - (a.link.sentAt ?? a.link.createdAt)),
    [links, byId],
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
                <th className="text-right py-2.5 px-4" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ link, cust, state }) => {
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
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400 text-sm">
                    No recovery links yet. Select customers in the review queue and send an SMS.
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

function FunnelCard({ label, value, sub, tint }: { label: string; value: number; sub: string; tint: string }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <p className={`text-2xl font-bold ${tint}`}>{value.toLocaleString()}</p>
      <p className="text-xs font-medium text-gray-700 mt-0.5">{label}</p>
      <p className="text-[11px] text-gray-400">{sub}</p>
    </div>
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
