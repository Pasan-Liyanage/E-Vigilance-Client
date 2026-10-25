import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore, onUnauthorized } from '../api/client';

const AuthContext = createContext(null);
const USER_KEY = 'evigilance.user';
/** The report wizard's saved draft (pages/ReportWizard.jsx). */
export const DRAFT_KEY = 'evigilance.draft';

const readCachedUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
};
const cacheUser = (u) => {
  try { u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY); }
  catch { /* private mode */ }
};

export function AuthProvider({ children }) {
  // Start from the cached user so a reload does not flash the login screen.
  const [user, setUser] = useState(readCachedUser);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  /**
   * Ends the session. Signing out on purpose also drops the unsent report
   * draft, which belongs to this person and not the next one to sign in; an
   * expired session keeps it for when they sign in again.
   */
  const signOut = useCallback(({ keepDraft = false } = {}) => {
    tokenStore.clear();
    cacheUser(null);
    if (!keepDraft) {
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* private mode */ }
    }
    setUser(null);
  }, []);
  const sessionExpired = useCallback(() => signOut({ keepDraft: true }), [signOut]);

  // Revalidate the stored token once on load.
  useEffect(() => {
    let alive = true;
    if (!tokenStore.get()) { setUser(null); cacheUser(null); setLoading(false); return; }

    api.me()
      .then(({ user: fresh }) => { if (alive) { setUser(fresh); cacheUser(fresh); } })
      .catch((err) => {
        // Only drop the session on a real auth failure - stay signed in when offline.
        if (alive && err.status === 401) sessionExpired();
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [sessionExpired]);

  // The API client tells us when any request came back 401.
  useEffect(() => onUnauthorized(sessionExpired), [sessionExpired]);

  const applySession = useCallback(({ token, user: u }) => {
    tokenStore.set(token);
    cacheUser(u);
    setUser(u);
    return u;
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    signIn: async (email, password) => applySession(await api.login({ email, password })),
    signUp: async (payload) => applySession(await api.register(payload)),
    signOut,
    updateProfile: async (payload) => {
      const { user: u } = await api.updateProfile(payload);
      cacheUser(u);
      setUser(u);
      return u;
    },
    verifyPhone: async (code) => {
      const { user: u } = await api.verifyPhone(code);
      cacheUser(u);
      setUser(u);
      return u;
    },
    // The server keeps no session to end; the token is simply refused from now on.
    deleteAccount: async (password) => {
      await api.deleteAccount(password);
      signOut();
    },
  }), [user, loading, applySession, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
