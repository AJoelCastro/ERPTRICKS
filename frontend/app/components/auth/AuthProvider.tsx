"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AuthUser,
  clearSession,
  getSavedUser,
  getToken,
  hasPermission,
  loginRequest,
  meRequest,
} from "../../../lib/auth-client";

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  authenticated: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  can: (...permissions: string[]) => boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const token = getToken();

      if (!token) {
        setUser(null);
        return;
      }

      const me = await meRequest(token);
      setUser(me);
    } catch {
      clearSession();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const saved = getSavedUser();
        if (saved) {
          setUser(saved);
        }
        await refreshMe();
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [refreshMe]);

  const login = useCallback(async (login: string, password: string) => {
    const result = await loginRequest(login, password);
    setUser(result.data || null);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      authenticated: !!user,
      login,
      logout,
      refreshMe,
      can: (...permissions: string[]) => hasPermission(user, ...permissions),
    }),
    [user, loading, login, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}