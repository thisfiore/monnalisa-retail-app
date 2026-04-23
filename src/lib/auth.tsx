import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Session } from './types';
import { firebaseSignIn, firebaseRefreshToken, extractStoreIdFromToken } from './firebase-auth';
import { storeApi } from './api-client';
import type { StoreRecord } from './api-types';

// Fallback Salesforce Store__c Id used only if the authenticated user has no
// store_id custom claim (pre-migration accounts, misconfigured users).
const FALLBACK_STORE_ID = 'a0W0E000004p9WdUAI';

function resolveStoreId(idToken: string): string {
  const fromClaim = extractStoreIdFromToken(idToken);
  if (fromClaim) return fromClaim;
  console.warn(
    '[auth] No store_id custom claim on Firebase user; using fallback. Ask BE to set the claim for this account.',
  );
  return FALLBACK_STORE_ID;
}

async function fetchStoreDetails(storeId: string, idToken: string): Promise<StoreRecord | null> {
  try {
    const stores = await storeApi.getStores(undefined, idToken);
    return stores.find((s) => s.Id === storeId) ?? null;
  } catch (error) {
    console.warn('[auth] Failed to fetch store details:', error);
    return null;
  }
}

function formatStoreAddress(store: StoreRecord): string {
  const parts: string[] = [];
  if (store.Store_No__c) parts.push(`Store #${store.Store_No__c}`);
  if (store.Country__c) parts.push(store.Country__c);
  return parts.join(' \u00B7 ');
}

type AuthContextType = {
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  getValidToken: () => Promise<string>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh when within 5 min of expiry

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedSession = localStorage.getItem('session');
    if (storedSession) {
      const parsed: Session = JSON.parse(storedSession);
      // Auto-logout if token is already expired
      if (parsed.tokenExpiresAt && Date.now() >= parsed.tokenExpiresAt) {
        localStorage.removeItem('session');
      } else {
        setSession(parsed);
      }
    }
    setIsLoading(false);
  }, []);

  const persistSession = (s: Session) => {
    setSession(s);
    localStorage.setItem('session', JSON.stringify(s));
  };

  const login = async (email: string, password: string) => {
    const firebaseResult = await firebaseSignIn(email, password);
    const storeId = resolveStoreId(firebaseResult.idToken);
    const store = await fetchStoreDetails(storeId, firebaseResult.idToken);

    const newSession: Session = {
      token: firebaseResult.idToken,
      refreshToken: firebaseResult.refreshToken,
      tokenExpiresAt: Date.now() + Number(firebaseResult.expiresIn) * 1000,
      email: firebaseResult.email,
      storeId,
      storeName: store?.Name ?? 'Store',
      storeAddress: store ? formatStoreAddress(store) : '',
      salesAssociateId: firebaseResult.localId,
      salesAssociateName: firebaseResult.email,
    };

    persistSession(newSession);
  };

  const logout = useCallback(() => {
    setSession(null);
    localStorage.removeItem('session');
  }, []);

  const getValidToken = useCallback(async (): Promise<string> => {
    if (!session) throw new Error('Not authenticated');

    const now = Date.now();
    if (now < session.tokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) {
      return session.token;
    }

    // Token is about to expire or already expired — refresh it
    try {
      const refreshResult = await firebaseRefreshToken(session.refreshToken);
      const updatedSession: Session = {
        ...session,
        token: refreshResult.id_token,
        refreshToken: refreshResult.refresh_token,
        tokenExpiresAt: Date.now() + Number(refreshResult.expires_in) * 1000,
        storeId: resolveStoreId(refreshResult.id_token),
      };
      persistSession(updatedSession);
      return updatedSession.token;
    } catch {
      // Refresh failed — force logout
      logout();
      throw new Error('Session expired. Please log in again.');
    }
  }, [session, logout]);

  return (
    <AuthContext.Provider value={{ session, login, logout, getValidToken, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
