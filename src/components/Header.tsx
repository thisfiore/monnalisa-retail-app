import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { customerApi } from '../lib/api-client';
import { fromSearchRecord, type SearchResult } from '../lib/api-transforms';
import { Button } from './Button';

function highlightMatch(text: string, query: string): ReactNode {
  if (!query.trim()) return text;
  const escaped = query.trim().split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-pink-200 text-inherit rounded-sm px-0.5">{part}</mark> : part
  );
}

export function Header() {
  const { session, logout, getValidToken } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const token = await getValidToken();
        const records = await customerApi.search(searchQuery.trim(), token, 10);
        setSearchResults(records.map(fromSearchRecord));
      } catch (error) {
        console.error('Search failed:', error);
        setSearchError('Search failed. Please try again.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, getValidToken]);

  const handleSelectCustomer = (email: string) => {
    navigate(`/customers/${encodeURIComponent(email)}`);
    setSearchQuery('');
    setShowResults(false);
  };

  const handleCreateCustomer = () => {
    navigate('/customers/new');
    setSearchQuery('');
    setShowResults(false);
  };

  const SearchIcon = () => (
    <svg className="w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );

  const SpinnerIcon = ({ size = 'w-4 h-4' }: { size?: string }) => (
    <svg className={`${size} animate-spin text-gray-400`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  const SearchDropdown = () => {
    if (!showResults || !searchQuery.trim()) return null;
    return (
      <div className="absolute top-full mt-2 w-full min-w-[300px] bg-white border border-gray-200 rounded-2xl shadow-xl max-h-96 overflow-y-auto z-50">
        {isSearching ? (
          <div className="flex items-center justify-center gap-2 p-5 text-gray-500 text-sm">
            <SpinnerIcon />
            Searching...
          </div>
        ) : searchError ? (
          <div className="p-4 text-center text-red-500 text-sm">{searchError}</div>
        ) : searchResults.length > 0 ? (
          <>
            <div className="px-4 py-2.5 text-xs font-medium text-gray-400 border-b border-gray-100 uppercase tracking-wider">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </div>
            {searchResults.map((result) => (
              <button
                key={result.email}
                type="button"
                onClick={() => handleSelectCustomer(result.email)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 transition-colors cursor-pointer"
              >
                <p className="font-medium text-gray-900 text-sm">
                  {highlightMatch(result.name || `${result.firstName} ${result.lastName}`.trim(), searchQuery)}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span>{highlightMatch(result.email, searchQuery)}</span>
                  {result.phone && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span>{highlightMatch(result.phone, searchQuery)}</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </>
        ) : (
          <div className="p-5">
            <p className="text-sm text-gray-500 mb-3">No customers found for "{searchQuery}"</p>
            <Button onClick={handleCreateCustomer} className="w-full text-sm">
              + Create New Customer
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <header className="bg-black sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 lg:py-3.5">
        {session ? (
          <>
            {/* Mobile Layout */}
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 items-center lg:hidden">
              <button
                onClick={() => navigate('/')}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                type="button"
              >
                <img
                  src="/logo-white.png"
                  alt="Monnalisa"
                  className="h-6 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </button>

              <div className="text-right text-xs">
                <p className="font-medium text-white/90">{session.salesAssociateName}</p>
              </div>

              <div ref={searchRef} className="relative z-10">
                <div className="relative">
                  <input
                    type="search"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (searchQuery.trim() && (searchResults.length > 0 || isSearching)) {
                        setShowResults(true);
                      }
                    }}
                    className="w-full px-3 py-2 pl-9 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 text-xs text-white placeholder:text-white/40"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    data-dashlane-ignore="true"
                    data-form-type="other"
                  />
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                    {isSearching ? <SpinnerIcon size="w-3.5 h-3.5" /> : <SearchIcon />}
                  </div>
                </div>
                <SearchDropdown />
              </div>

              <div className="text-right">
                <button
                  onClick={logout}
                  className="text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden lg:flex items-center justify-between gap-6">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
                type="button"
              >
                <img
                  src="/logo-white.png"
                  alt="Monnalisa"
                  className="h-7 object-contain "
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <h1 className="hidden text-xl font-bold text-white tracking-wide">MONNALISA</h1>
              </button>

              <div ref={searchRef} className="flex-1 max-w-lg relative z-10">
                <div className="relative">
                  <input
                    type="search"
                    placeholder="Search customers by name, phone or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (searchQuery.trim() && (searchResults.length > 0 || isSearching)) {
                        setShowResults(true);
                      }
                    }}
                    className="w-full px-4 py-2.5 pl-10 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 text-sm text-white placeholder:text-white/40 transition-colors"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    data-dashlane-ignore="true"
                    data-form-type="other"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    {isSearching ? <SpinnerIcon /> : <SearchIcon />}
                  </div>
                </div>
                <SearchDropdown />
              </div>

              <div className="flex items-center gap-5">
                <div className="text-right text-sm">
                  <p className="font-medium text-white/90">{session.storeName}</p>
                  {session.salesAssociateName && (
                    <p className="text-xs text-white/50 mt-0.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5"></span>
                      {session.salesAssociateName}
                    </p>
                  )}
                </div>
                <button
                  onClick={logout}
                  className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-white/10"
                >
                  Logout
                </button>
              </div>
            </div>
          </>
        ) : (
          <button
            onClick={() => navigate('/')}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            type="button"
          >
            <img
              src="/logo-white.png"
              alt="Monnalisa"
              className="h-6 lg:h-7 object-contain "
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </button>
        )}
      </div>
    </header>
  );
}
