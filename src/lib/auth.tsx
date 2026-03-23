import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Session } from './types';
import { firebaseSignIn, firebaseRefreshToken } from './firebase-auth';

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

    const newSession: Session = {
      token: firebaseResult.idToken,
      refreshToken: firebaseResult.refreshToken,
      tokenExpiresAt: Date.now() + Number(firebaseResult.expiresIn) * 1000,
      email: firebaseResult.email,
      // Hardcoded store info until a store config API exists
      storeId: 'ML-Milano-001',
      storeName: 'Milano Boutique',
      storeAddress: 'Via della Spiga',
      salesAssociateId: 'SA-8473',
      salesAssociateName: 'Store Manager',
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
