import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from './Button';

type SearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

export function Header() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/customers/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const results = await response.json();
          setSearchResults(results);
          setShowResults(true);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectCustomer = (customerId: string) => {
    navigate(`/customers/${customerId}`);
    setSearchQuery('');
    setShowResults(false);
  };

  const handleCreateCustomer = () => {
    navigate('/customers/new');
    setSearchQuery('');
    setShowResults(false);
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 lg:py-4">
        {session ? (
          <>
            {/* Mobile Layout: Grid with 2 rows */}
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 items-center lg:hidden">
              {/* Row 1: Logo */}
              <button
                onClick={() => navigate('/')}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                type="button"
              >
                <img
                  src="/monnalisa-logo.jpg"
                  alt="Monnalisa"
                  className="h-6 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </button>

              {/* Row 1: User Info */}
              <div className="text-right text-xs">
                <p className="font-medium text-gray-900">{session.salesAssociateName}</p>
              </div>

              {/* Row 2: Search Bar */}
              <div ref={searchRef} className="relative z-10">
                <div className="relative">
                  <input
                    type="search"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (searchQuery.trim() && searchResults.length === 0) {
                        setShowResults(false);
                        const timer = setTimeout(() => setShowResults(true), 100);
                        return () => clearTimeout(timer);
                      }
                    }}
                    className="w-full px-3 py-1.5 pl-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs bg-white"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    data-dashlane-ignore="true"
                    data-form-type="other"
                  />
                  <svg
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>

                {/* Search Results Dropdown */}
                {showResults && searchQuery.trim() && (
                  <div className="absolute top-full mt-2 w-full min-w-[280px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                    {isSearching ? (
                      <div className="p-4 text-center text-gray-500 text-sm">Searching...</div>
                    ) : searchResults.length > 0 ? (
                      <>
                        <div className="p-2 text-xs text-gray-500 border-b bg-gray-50">
                          {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                        </div>
                        {searchResults.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            onClick={() => handleSelectCustomer(result.id)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 transition-colors cursor-pointer"
                          >
                            <p className="font-medium text-gray-900 text-sm">
                              {result.firstName} {result.lastName}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                              <span>{result.email}</span>
                              {result.phone && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <span>{result.phone}</span>
                                </>
                              )}
                            </div>
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="p-4">
                        <p className="text-sm text-gray-600 mb-3">No customers found matching "{searchQuery}"</p>
                        <Button onClick={handleCreateCustomer} className="w-full text-sm">
                          + Create New Customer
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Row 2: Logout */}
              <div className="text-right">
                <Button variant="outline" onClick={logout} className="text-xs px-3 py-1.5">
                  Logout
                </Button>
              </div>
            </div>

            {/* Desktop Layout: Original horizontal layout */}
            <div className="hidden lg:flex items-center justify-between gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
                type="button"
              >
                <img
                  src="/monnalisa-logo.jpg"
                  alt="Monnalisa"
                  className="h-7 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <h1 className="hidden text-2xl font-bold text-gray-900">MONNALISA</h1>
              </button>

              {/* Search Bar */}
              <div ref={searchRef} className="flex-1 max-w-md relative z-10">
                <div className="relative">
                  <input
                    type="search"
                    placeholder="Search customers by name, phone or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (searchQuery.trim() && searchResults.length === 0) {
                        setShowResults(false);
                        const timer = setTimeout(() => setShowResults(true), 100);
                        return () => clearTimeout(timer);
                      }
                    }}
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    data-dashlane-ignore="true"
                    data-form-type="other"
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>

                {/* Search Results Dropdown */}
                {showResults && searchQuery.trim() && (
                  <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                    {isSearching ? (
                      <div className="p-4 text-center text-gray-500 text-sm">Searching...</div>
                    ) : searchResults.length > 0 ? (
                      <>
                        <div className="p-2 text-xs text-gray-500 border-b bg-gray-50">
                          {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                        </div>
                        {searchResults.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            onClick={() => handleSelectCustomer(result.id)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 transition-colors cursor-pointer"
                          >
                            <p className="font-medium text-gray-900">
                              {result.firstName} {result.lastName}
                            </p>
                            <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                              <span>{result.email}</span>
                              {result.phone && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <span>{result.phone}</span>
                                </>
                              )}
                            </div>
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="p-4">
                        <p className="text-sm text-gray-600 mb-3">No customers found matching "{searchQuery}"</p>
                        <Button onClick={handleCreateCustomer} className="w-full text-sm">
                          + Create New Customer
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right text-sm">
                  <p className="font-medium text-gray-900">{session.storeName}</p>
                  {session.salesAssociateName && (
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></span>
                      Manager: <span className="font-medium">{session.salesAssociateName}</span>
                    </p>
                  )}
                </div>
                <Button variant="outline" onClick={logout} className="text-sm">
                  Logout
                </Button>
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
              src="/monnalisa-logo.jpg"
              alt="Monnalisa"
              className="h-6 lg:h-7 object-contain"
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
