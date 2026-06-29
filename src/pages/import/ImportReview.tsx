import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuth } from '../../lib/auth';
import { getImport, listCustomers } from '../../lib/import/staging-db';
import type { ImportRecord, StagingCustomer, StagingStatus } from '../../lib/import/types';
import { E164_REGEX } from '../../lib/import/recovery';
import { SmsComposer } from './SmsComposer';
import { badgeColor } from './badge';

const STATUSES: StagingStatus[] = ['review', 'ready', 'blocked', 'duplicate', 'created', 'failed', 'skipped'];

export function ImportReview() {
  const { importId } = useParams<{ importId: string }>();
  const { session, getValidToken } = useAuth();

  const [importRec, setImportRec] = useState<ImportRecord | null>(null);
  const [customers, setCustomers] = useState<StagingCustomer[]>([]);
  const [filter, setFilter] = useState<StagingStatus | 'all'>('review');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [smsOpen, setSmsOpen] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (!session || !importId) return;
    (async () => {
      const rec = await getImport(importId);
      setImportRec(rec ?? null);
      const list = await listCustomers({ storeId: session.storeId, importId });
      setCustomers(list);
      setIsLoading(false);
    })();
  }, [session, importId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: customers.length };
    for (const cust of customers) c[cust.status] = (c[cust.status] ?? 0) + 1;
    return c;
  }, [customers]);

  const filtered = useMemo(() => {
    let rows = customers;
    if (filter !== 'all') rows = rows.filter((r) => r.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => {
        const haystack = [
          r.normalized.firstName,
          r.normalized.lastName,
          r.normalized.email,
          r.normalized.phone,
          r.customerId,
          r.normalized.csvStore,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    return rows.slice(0, 500); // cap render for prototype
  }, [customers, filter, search]);

  // Only records with a sendable phone can be texted.
  const selectableInView = useMemo(
    () => filtered.filter((r) => E164_REGEX.test(r.normalized.phone || '')),
    [filtered],
  );
  const allSelectedInView =
    selectableInView.length > 0 && selectableInView.every((r) => selected.has(r.id));
  const smsRecipients = useMemo(
    () => customers.filter((c) => selected.has(c.id)),
    [customers, selected],
  );

  function toggleAllInView() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectedInView) selectableInView.forEach((r) => next.delete(r.id));
      else selectableInView.forEach((r) => next.add(r.id));
      return next;
    });
  }

  if (isLoading) {
    return <p className="p-8 text-gray-400 text-sm">Loading…</p>;
  }
  if (!importRec) {
    return <p className="p-8 text-gray-500">Import not found.</p>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Import</p>
          <h1 className="text-xl font-bold text-gray-900">{importRec.filename}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {importRec.parsedRows} customers · {new Date(importRec.uploadedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/import/${importId}/outreach`}>
            <Button variant="outline" className="text-sm py-1.5 px-3">
              📊 Outreach tracking
            </Button>
          </Link>
          <Link to="/import">
            <Button variant="outline" className="text-sm py-1.5 px-3">
              ← All imports
            </Button>
          </Link>
        </div>
      </div>

      <Card className="!p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={filter === 'all'}
            count={counts.all ?? 0}
            label="All"
            onClick={() => setFilter('all')}
          />
          {STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={filter === s}
              count={counts[s] ?? 0}
              label={s}
              status={s}
              onClick={() => setFilter(s)}
            />
          ))}
          <div className="flex-1" />
          <input
            type="search"
            placeholder="Search name / email / phone / id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="py-2.5 px-4 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all textable rows"
                    checked={allSelectedInView}
                    onChange={toggleAllInView}
                    disabled={selectableInView.length === 0}
                    className="cursor-pointer accent-gray-900"
                  />
                </th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Phone
                </th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  CSV Store
                </th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-2.5 px-4">
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.normalized.firstName} ${c.normalized.lastName}`}
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      disabled={!E164_REGEX.test(c.normalized.phone || '')}
                      title={
                        E164_REGEX.test(c.normalized.phone || '')
                          ? undefined
                          : 'No phone in E.164 format — cannot SMS'
                      }
                      className="cursor-pointer accent-gray-900 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-2.5 px-4">
                    <p className="font-medium text-gray-900">
                      {c.normalized.firstName} {c.normalized.lastName}
                    </p>
                    <p className="text-xs text-gray-400">ID {c.customerId}</p>
                  </td>
                  <td className="py-2.5 px-4 text-gray-700">
                    {c.normalized.email || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 px-4 text-gray-700">
                    {c.normalized.phone || <span className="text-gray-300">—</span>}
                    {c.flags.phoneNotE164 && (
                      <span className="ml-1 text-xs text-amber-600">not E.164</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-gray-500 text-xs">{c.normalized.csvStore}</td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-medium ${badgeColor(c.status)}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <Link
                      to={`/import/${importId}/customer/${encodeURIComponent(c.customerId)}`}
                    >
                      <Button variant="outline" className="text-xs py-1 px-2">
                        Open
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">
                    No rows match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {customers.length > 500 && filtered.length >= 500 && (
          <p className="px-4 py-2 text-xs text-gray-400 text-right">
            Showing first 500 — refine filters or search.
          </p>
        )}
      </Card>

      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900 text-white rounded-full shadow-lg px-5 py-2.5">
          <span className="text-sm">
            {selected.size} selected for SMS
          </span>
          <Button
            onClick={() => setSmsOpen(true)}
            className="!bg-white !text-gray-900 hover:!bg-gray-100 text-sm py-1.5 px-3"
          >
            Send SMS
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-gray-300 hover:text-white cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      <SmsComposer
        open={smsOpen}
        recipients={smsRecipients}
        getToken={getValidToken}
        onClose={() => setSmsOpen(false)}
        onSent={() => setSelected(new Set())}
      />
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  status,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  status?: StagingStatus;
  onClick: () => void;
}) {
  const base =
    'px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors capitalize';
  const inactiveColor = status ? badgeColor(status) : 'bg-gray-100 text-gray-600';
  const activeColor = 'bg-gray-900 text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${active ? activeColor : `${inactiveColor} hover:opacity-80`}`}
    >
      {label} <span className="opacity-70 ml-1">{count}</span>
    </button>
  );
}
