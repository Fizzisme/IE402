import { create } from 'zustand';
import {
  loginRequest,
  registerRequest,
  type AuthUser,
} from '@/services/auth.service';
import { setAuthToken } from '@/services/api-client';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isSubmitting: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  register: (p: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

function messageFromError(e: any): string {
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string') return msg;
  if (e?.message === 'Network Error') return 'Không kết nối được máy chủ';
  return 'Đã có lỗi xảy ra, thử lại sau';
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isSubmitting: false,
  error: null,

  login: async (email, password) => {
    set({ isSubmitting: true, error: null });
    try {
      const { accessToken, user } = await loginRequest({ email, password });
      setAuthToken(accessToken);
      set({ token: accessToken, user, isSubmitting: false });
      return true;
    } catch (e) {
      set({ isSubmitting: false, error: messageFromError(e) });
      return false;
    }
  },

  register: async (p) => {
    set({ isSubmitting: true, error: null });
    try {
      const { accessToken, user } = await registerRequest(p);
      setAuthToken(accessToken);
      set({ token: accessToken, user, isSubmitting: false });
      return true;
    } catch (e) {
      set({ isSubmitting: false, error: messageFromError(e) });
      return false;
    }
  },

  logout: () => {
    setAuthToken(null);
    set({ token: null, user: null, error: null });
  },
  clearError: () => set({ error: null }),
}));
