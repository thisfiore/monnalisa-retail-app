import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

export type MockCall = {
  id: number;
  path: string;
  timestamp: number;
};

type MockToastContextType = {
  mockCalls: MockCall[];
  addMockCall: (path: string) => void;
  removeMockCall: (id: number) => void;
};

const MockToastContext = createContext<MockToastContextType | null>(null);

let nextId = 0;

export function MockToastProvider({ children }: { children: ReactNode }) {
  const [mockCalls, setMockCalls] = useState<MockCall[]>([]);

  const addMockCall = useCallback((path: string) => {
    const id = ++nextId;
    setMockCalls(prev => [...prev, { id, path, timestamp: Date.now() }]);

    setTimeout(() => {
      setMockCalls(prev => prev.filter(c => c.id !== id));
    }, 3000);
  }, []);

  const removeMockCall = useCallback((id: number) => {
    setMockCalls(prev => prev.filter(c => c.id !== id));
  }, []);

  // Listen for MSW mocked response events dispatched from main.tsx
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      addMockCall(detail.path);
    };
    window.addEventListener('msw:mocked', handler);
    return () => window.removeEventListener('msw:mocked', handler);
  }, [addMockCall]);

  return (
    <MockToastContext.Provider value={{ mockCalls, addMockCall, removeMockCall }}>
      {children}
    </MockToastContext.Provider>
  );
}

export function useMockToast() {
  const context = useContext(MockToastContext);
  if (!context) {
    throw new Error('useMockToast must be used within MockToastProvider');
  }
  return context;
}
