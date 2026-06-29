import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuth } from '../../lib/auth';
import { listImportsForStore, countByStatus } from '../../lib/import/staging-db';
import { ensureHydrated } from '../../lib/import/hydrate';
import type { ImportRecord, StagingStatus } from '../../lib/import/types';
import { badgeColor } from './badge';

const STATUS_LABEL: Record<StagingStatus, string> = {
  ready: 'Ready',
  review: 'Review',
  blocked: 'Blocked',
  duplicate: 'Duplicate',
  created: 'Created',
  failed: 'Failed',
  skipped: 'Skipped',
};

type ImportRow = {
  rec: ImportRecord;
  counts: Record<StagingStatus, number>;
};

export function ImportList() {
  const { session, getValidToken } = useAuth();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hydrateError, setHydrateError] = useState('');

  useEffect(() => {
    if (!session) return;
    (async () => {
      // Pull the customers system from Mongo into the local cache (http mode).
      try {
        await ensureHydrated(getValidToken);
      } catch (e) {
        setHydrateError(e instanceof Error ? e.message : String(e));
      }
      const imports = await listImportsForStore(session.storeId);
      const withCounts = await Promise.all(
        imports.map(async (rec) => ({
          rec,
          counts: await countByStatus(session.storeId, rec.id),
        })),
      );
      setRows(withCounts);
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Import</h1>
          <p className="text-sm text-gray-500 mt-1">
            Normalize and review the legacy customer database before migrating into the loyalty CRM.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/import-docs">
            <Button variant="outline">How it works</Button>
          </Link>
          <Link to="/import/new">
            <Button>+ New Import</Button>
          </Link>
        </div>
      </div>

      {hydrateError && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Couldn’t load customers from the backend: {hydrateError}
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading customers…</p>
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-gray-500 text-sm">
            No imports yet. Click <strong>New Import</strong> to drop a CSV file.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map(({ rec, counts }) => (
            <Card key={rec.id} className="!p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <h3 className="font-semibold text-gray-900 truncate">{rec.filename}</h3>
                    <p className="text-xs text-gray-400">
                      {new Date(rec.uploadedAt).toLocaleString()} · {rec.parsedRows} rows
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(Object.keys(STATUS_LABEL) as StagingStatus[]).map((s) =>
                      counts[s] > 0 ? (
                        <span
                          key={s}
                          className={`px-2 py-0.5 rounded-md text-xs font-medium ${badgeColor(s)}`}
                        >
                          {STATUS_LABEL[s]}: {counts[s]}
                        </span>
                      ) : null,
                    )}
                  </div>
                </div>
                <Link to={`/import/${rec.id}`}>
                  <Button variant="outline" className="text-sm py-1.5 px-3">
                    Open
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

