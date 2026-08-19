import { useEffect, useMemo, useRef, useState } from 'react';
import {
  countryForPrefix,
  flagEmoji,
  matchesPrefixQuery,
  phonePrefixOptions,
  type PhonePrefix,
} from '../lib/phone-prefixes';

interface PhonePrefixSelectProps {
  value: string;
  onChange: (code: string) => void;
  /** Placeholder for the search box — localized on the public recovery flow. */
  searchPlaceholder?: string;
  /** Extra classes for the trigger button (e.g. the amber "missing" state). */
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Country calling-code picker over the full E.164 table.
 *
 * A native `<select>` can't carry 240 entries usefully in a 7rem-wide control —
 * the closed state must stay compact ("🇮🇹 +39") while the open list needs
 * country names to be findable — so this is a small search-and-pick popover.
 */
export function PhonePrefixSelect({
  value,
  onChange,
  searchPlaceholder = 'Search country or code',
  className = '',
  disabled = false,
  id,
}: PhonePrefixSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = countryForPrefix(value);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery('');
  }, [open]);

  const { common, rest } = useMemo(() => phonePrefixOptions(), []);
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return { common, rest };
    return {
      common: common.filter((p) => matchesPrefixQuery(p, q)),
      rest: rest.filter((p) => matchesPrefixQuery(p, q)),
    };
  }, [query, common, rest]);
  const empty = filtered.common.length === 0 && filtered.rest.length === 0;

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  const renderOption = (p: PhonePrefix) => (
    <li key={p.iso}>
      <button
        type="button"
        onClick={() => pick(p.code)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
          p.code === value ? 'bg-gray-50 font-medium' : ''
        }`}
      >
        <span aria-hidden="true">{flagEmoji(p.iso)}</span>
        <span className="flex-1 truncate text-gray-900">{p.name}</span>
        <span className="text-gray-500 tabular-nums">{p.code}</span>
      </button>
    </li>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={selected ? `Country code ${selected.name} ${value}` : `Country code ${value}`}
        className={`w-28 px-2.5 py-2.5 border rounded-xl bg-white text-gray-900 text-left flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50 ${
          className || 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <span aria-hidden="true">{selected ? flagEmoji(selected.iso) : '🌐'}</span>
        <span className="flex-1 tabular-nums truncate">{value}</span>
        <span aria-hidden="true" className="text-gray-400 text-xs">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const first = filtered.common[0] ?? filtered.rest[0];
                  if (first) pick(first.code);
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.common.map(renderOption)}
            {filtered.common.length > 0 && filtered.rest.length > 0 && (
              <li aria-hidden="true" className="my-1 border-t border-gray-100" />
            )}
            {filtered.rest.map(renderOption)}
            {empty && <li className="px-3 py-3 text-sm text-gray-400">No match</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
