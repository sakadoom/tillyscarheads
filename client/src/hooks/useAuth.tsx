import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UserDto } from 'shared';

import { api, getToken, setToken } from '../lib/api';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: UserDto | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.me(),
    enabled: Boolean(token),
    retry: false,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.login({ email, password });
      setToken(result.token);
      setTokenState(result.token);
      queryClient.setQueryData(['auth', 'me'], { user: result.user });
    },
    [queryClient],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const result = await api.register({ name, email, password });
      setToken(result.token);
      setTokenState(result.token);
      queryClient.setQueryData(['auth', 'me'], { user: result.user });
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    queryClient.clear();
  }, [queryClient]);

  const status: AuthStatus = !token
    ? 'anonymous'
    : meQuery.isPending
      ? 'loading'
      : meQuery.data
        ? 'authenticated'
        : 'anonymous';

  const value = useMemo<AuthContextValue>(
    () => ({ user: meQuery.data?.user ?? null, status, login, register, logout }),
    [meQuery.data?.user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus dipakai di dalam AuthProvider');
  }
  return context;
}
