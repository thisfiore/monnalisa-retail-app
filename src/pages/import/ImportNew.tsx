import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuth } from '../../lib/auth';
import type { ParseError } from 'papaparse';
import { parseLegacyCsv, readFileAsText } from '../../lib/import/csv-parse';
import { parseRetailCsv, isRetailCsv } from '../../lib/import/retail-parse';
import {
  parseProcessedCsv,
  isProcessedCsv,
  normalizeProcessedRows,
  type ProcessedRow,
} from '../../lib/import/processed-parse';
import { dedupAndNormalize } from '../../lib/import/normalize';
import { normalizeRetailRows } from '../../lib/import/retail-normalize';
import { saveImport, saveCustomers } from '../../lib/import/staging-sync';
import type {
  ImportRecord,
  ImportSummary,
  RawCsvRow,
  RawRetailRow,
} from '../../lib/import/types';

type ImportSchema = 'legacy' | 'retail' | 'processed';
type AnyRow = RawCsvRow | RawRetailRow | ProcessedRow;
type UnifiedParse = { rows: AnyRow[]; summary: ImportSummary; parseErrors: ParseError[] };

const storeNameOf = (r: AnyRow): string =>
  'storeName' in r ? (r.storeName ?? '') : 'store' in r ? r.store : '';

export function ImportNew() {
  const { session, getValidToken } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filename, setFilename] = useState<string>('');
  const [schema, setSchema] = useState<ImportSchema>('legacy');
  const [parseResult, setParseResult] = useState<UnifiedParse | null>(null);
  const [ownedStores, setOwnedStores] = useState<Set<string>>(new Set());
  const [isParsing, setIsParsing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  async function handleFile(file: File) {
    setError('');
    setIsParsing(true);
    setFilename(file.name);
    try {
      const text = await readFileAsText(file);
      const detected: ImportSchema = isProcessedCsv(text)
        ? 'processed'
        : isRetailCsv(text)
          ? 'retail'
          : 'legacy';
      setSchema(detected);
      const result: UnifiedParse =
        detected === 'processed'
          ? parseProcessedCsv(text)
          : detected === 'retail'
            ? parseRetailCsv(text)
            : parseLegacyCsv(text);
      setParseResult(result);
      // Pre-select all stores by default if there's just one or a few.
      if (result.summary.csvStoresFound.length <= 5) {
        setOwnedStores(new Set(result.summary.csvStoresFound.map((s) => s.name)));
      } else {
        setOwnedStores(new Set());
      }
    } catch (e) {
      setError(`Failed to parse: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsParsing(false);
    }
  }

  function toggleStore(name: string) {
    setOwnedStores((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleCommit() {
    if (!session || !parseResult) return;
    if (ownedStores.size === 0) {
      setError('Select at least one CSV store to import.');
      return;
    }
    setIsCommitting(true);
    setError('');
    try {
      const importId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();

      const filteredRows = parseResult.rows.filter((r) => ownedStores.has(storeNameOf(r)));
      const batchCtx = { storeId: session.storeId, importId, now };
      const customers =
        schema === 'processed'
          ? normalizeProcessedRows(filteredRows as ProcessedRow[], batchCtx)
          : schema === 'retail'
            ? normalizeRetailRows(filteredRows as RawRetailRow[], batchCtx)
            : dedupAndNormalize(filteredRows as RawCsvRow[], batchCtx);

      const rec: ImportRecord = {
        id: importId,
        filename,
        storeId: session.storeId,
        uploadedAt: now,
        totalRows: parseResult.summary.totalRows,
        parsedRows: customers.length,
        skippedRows: parseResult.rows.length - filteredRows.length,
        csvStoresFound: parseResult.summary.csvStoresFound,
        ownedCsvStores: Array.from(ownedStores),
      };

      await saveImport(rec, getValidToken);
      await saveCustomers(customers, getValidToken);
      navigate(`/import/${importId}`);
    } catch (e) {
      setError(`Commit failed: ${e instanceof Error ? e.message : String(e)}`);
      setIsCommitting(false);
    }
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">New Import</h1>
        <p className="text-sm text-gray-500 mt-1">
          Drop a Retail Pro export, the retail-account CSV, or an already-normalized{' '}
          <code className="bg-gray-100 px-1 rounded">processed/firebase-*.csv</code>. We auto-detect the
          format, dedup by customer, and stage records for review.
        </p>
      </div>

      {!parseResult && (
        <Card>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
              isDragging ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <p className="text-gray-700 font-medium">Drop CSV here or click to browse</p>
            <p className="text-xs text-gray-400 mt-2">UTF-8 with BOM, semicolon-delimited</p>
          </div>
          {isParsing && <p className="text-center text-gray-500 text-sm mt-4">Parsing…</p>}
        </Card>
      )}

      {parseResult && (
        <div className="space-y-4">
          {schema === 'processed' && (
            <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3 text-sm text-purple-800">
              <strong>Already-normalized file detected.</strong> These records load with their
              deterministic + AI normalization (locale, E.164 phone, AI notes) already applied — no
              further processing needed.
            </div>
          )}
          <Card title="Parse summary">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wider">Filename</dt>
                <dd className="text-sm font-medium text-gray-900 truncate">{filename}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wider">Total rows</dt>
                <dd className="text-sm font-medium text-gray-900">{parseResult.summary.totalRows}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wider">Parsed</dt>
                <dd className="text-sm font-medium text-gray-900">{parseResult.summary.parsedRows}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wider">Corrupted</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {parseResult.summary.corruptedRows}
                  {parseResult.summary.totalRowDropped && (
                    <span className="ml-2 text-xs text-gray-400">+ 1 summary row dropped</span>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card title="Which CSV stores belong to your store?">
            <p className="text-sm text-gray-500 mb-4">
              You're signed in as <strong>{session?.storeName}</strong>. Pick the CSV store names whose rows
              should be imported under this store. Other rows will be skipped.
            </p>
            <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
              {parseResult.summary.csvStoresFound.map(({ name, rowCount }) => (
                <label
                  key={name}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={ownedStores.has(name)}
                    onChange={() => toggleStore(name)}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="flex-1 text-sm text-gray-700">{name || '(empty)'}</span>
                  <span className="text-xs text-gray-400">{rowCount} rows</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Selected: {ownedStores.size} stores ·{' '}
              {parseResult.rows.filter((r) => ownedStores.has(storeNameOf(r))).length} rows
            </p>
          </Card>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setParseResult(null);
                setFilename('');
                setOwnedStores(new Set());
              }}
            >
              Reset
            </Button>
            <Button onClick={handleCommit} isLoading={isCommitting} disabled={ownedStores.size === 0}>
              Import {ownedStores.size > 0 ? `(${parseResult.rows.filter((r) => ownedStores.has(storeNameOf(r))).length} rows)` : ''}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
