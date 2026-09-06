import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore, onUnauthorized } from '../api/client';

const AuthContext = createContext(null);
const USER_KEY = 'evigilance.user';

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

  const signOut = useCallback(() => {
    tokenStore.clear();
    cacheUser(null);
    setUser(null);
  }, []);

  // Revalidate the stored token once on load.
  useEffect(() => {
    let alive = true;
    if (!tokenStore.get()) { setUser(null); cacheUser(null); setLoading(false); return; }

    api.me()
      .then(({ user: fresh }) => { if (alive) { setUser(fresh); cacheUser(fresh); } })
      .catch((err) => {
        // Only drop the session on a real auth failure - stay signed in when offline.
        if (alive && err.status === 401) signOut();
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [signOut]);

  // The API client tells us when any request came back 401.
  useEffect(() => onUnauthorized(signOut), [signOut]);

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
  }), [user, loading, applySession, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
