import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Salarie } from '@/types';

interface AuthState {
  user: Salarie | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: Salarie, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<Salarie>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        }),
      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
    }),
    {
      name: 'chronova-auth',
    }
  )
);
