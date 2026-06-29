import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuth } from '../../lib/auth';
import { listImportsForStore, countByStatus } from '../../lib/import/staging-db';
import { activeRecoveryBackend } from '../../lib/import/recovery-store';
import { moveToBackend, recoverFromBackend, type SyncProgress } from '../../lib/import/staging-sync';
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
  const [syncing, setSyncing] = useState<'push' | 'pull' | null>(null);
  const [syncMsg, setSyncMsg] = useState('');
  const durable = activeRecoveryBackend() !== 'local';

  async function reload() {
    if (!session) return;
    const imports = await listImportsForStore(session.storeId);
    const withCounts = await Promise.all(
      imports.map(async (rec) => ({ rec, counts: await countByStatus(session.storeId, rec.id) })),
    );
    setRows(withCounts);
  }

  useEffect(() => {
    if (!session) return;
    (async () => {
      await reload();
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function handleMoveToMongo() {
    if (!session) return;
    setSyncing('push');
    setSyncMsg('Pushing…');
    try {
      const r = await moveToBackend(session.storeId, getValidToken, (p: SyncProgress) =>
        setSyncMsg(`Pushing ${p.phase}: ${p.done}/${p.total}`),
      );
      setSyncMsg(`✓ Moved ${r.imports} import(s) and ${r.customers} customers to Mongo.`);
    } catch (e) {
      setSyncMsg(`Push failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(null);
    }
  }

  async function handleRecover() {
    setSyncing('pull');
    setSyncMsg('Recovering…');
    try {
      const r = await recoverFromBackend(getValidToken, (p: SyncProgress) =>
        setSyncMsg(`Recovering ${p.phase}: ${p.done}/${p.total}`),
      );
      await reload();
      setSyncMsg(`✓ Recovered ${r.imports} import(s) and ${r.customers} customers from Mongo.`);
    } catch (e) {
      setSyncMsg(`Recover failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(null);
    }
  }

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
          {durable && (
            <>
              <Button variant="outline" onClick={handleMoveToMongo} isLoading={syncing === 'push'} disabled={!!syncing}>
                ⤴ Move to Mongo
              </Button>
              <Button variant="outline" onClick={handleRecover} isLoading={syncing === 'pull'} disabled={!!syncing}>
                ⤓ Recover from Mongo
              </Button>
            </>
          )}
          <Link to="/import-docs">
            <Button variant="outline">How it works</Button>
          </Link>
          <Link to="/import/new">
            <Button>+ New Import</Button>
          </Link>
        </div>
      </div>

      {durable && syncMsg && (
        <div className="mb-4 rounded-xl bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm text-gray-700">
          {syncMsg}
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
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

