import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserInfo } from '../api/auth';
import { getToken, getUser, setAuth, clearAuth } from '../utils/authStorage';
import * as authApi from '../api/auth';

type AuthState = {
  user: UserInfo | null;
  token: string | null;
  loading: boolean;
};

const GUEST_USER: UserInfo = { id: 0, email: 'guest@local', name: 'Guest', role: 'student' };

type AuthContextValue = AuthState & {
  signup: (name: string, email: string, password: string, role?: UserInfo['role']) => Promise<UserInfo>;
  login: (email: string, password: string) => Promise<UserInfo>;
  logout: () => Promise<void>;
  /** Use app without backend (dev only). Sign up will work once network is fixed. */
  skipAsGuest: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true });

  const loadStored = useCallback(async () => {
    const token = await getToken();
    const user = await getUser();
    if (token && user) {
      setState({ token, user, loading: false });
    } else {
      setState({ token: null, user: null, loading: false });
    }
  }, []);

  const skipAsGuest = useCallback(async () => {
    await setAuth('guest', GUEST_USER);
    setState({ token: 'guest', user: GUEST_USER, loading: false });
  }, []);

  useEffect(() => {
    loadStored();
  }, [loadStored]);

  const signup = useCallback(async (name: string, email: string, password: string, role?: UserInfo['role']) => {
    const res = await authApi.signup(name, email, password, role);
    await setAuth(res.access_token, res.user);
    setState({ token: res.access_token, user: res.user, loading: false });
    return res.user;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    await setAuth(res.access_token, res.user);
    setState({ token: res.access_token, user: res.user, loading: false });
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await clearAuth();
    setState({ token: null, user: null, loading: false });
  }, []);

  const value: AuthContextValue = { ...state, signup, login, logout, skipAsGuest };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
