import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import { tokenStore } from "../lib/tokens";
import { authService, type RegisterPayload, type User } from "../services/auth";
import { AuthContext, type AuthContextType } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const login = useCallback(
    async (username: string, password: string) => {
      const { user: nextUser, access, refresh } = await authService.login(
        username,
        password,
      );
      tokenStore.setSession(access, refresh);
      setUser(nextUser);
      queryClient.clear();
    },
    [queryClient],
  );

  const adminLogin = useCallback(
    async (email: string, password: string) => {
      const { user: nextUser, access, refresh } = await authService.adminLogin(
        email,
        password,
      );
      tokenStore.setSession(access, refresh);
      setUser(nextUser);
      queryClient.clear();
    },
    [queryClient],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const { user: nextUser, access, refresh } = await authService.register(payload);
      tokenStore.setSession(access, refresh);
      setUser(nextUser);
      queryClient.clear();
    },
    [queryClient],
  );

  const updateProfile = useCallback(async (payload: FormData) => {
    const nextUser = await authService.updateProfile(payload);
    setUser(nextUser);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await authService.changePassword(currentPassword, newPassword);
    },
    [],
  );

  const logout = useCallback(async () => {
    const refresh = tokenStore.getRefresh();
    tokenStore.clear();
    try {
      if (refresh) await authService.logout(refresh);
    } catch {
      /* already invalid — clear locally either way */
    }
    setUser(null);
    queryClient.clear();
    navigate("/", { replace: true });
  }, [navigate, queryClient]);

  useEffect(() => {
    let cancelled = false;

    async function rehydrate() {
      const refresh = tokenStore.getRefresh();
      if (!refresh) {
        setIsReady(true);
        return;
      }

      try {
        const { data } = await api.post("/v1/auth/refresh/", { refresh });
        if (cancelled) return;
        tokenStore.setSession(data.access, data.refresh ?? refresh);
        const me = await authService.me();
        if (cancelled) return;
        setUser(me);
      } catch {
        tokenStore.clear();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    void rehydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isReady,
      login,
      adminLogin,
      updateProfile,
      changePassword,
      register,
      logout,
    }),
    [login, adminLogin, updateProfile, changePassword, logout, register, user, isReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
