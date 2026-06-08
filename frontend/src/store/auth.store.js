import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      
      logout: () => {
        // Hapus token dari localStorage
        localStorage.removeItem('auth-storage');
        set({ user: null, token: null, isAuthenticated: false });
        // Redirect ke login diproses di level router/komponen
        window.location.href = '/login';
      },
      
      updateUser: (userData) => set((state) => ({ user: { ...state.user, ...userData } })),
    }),
    {
      name: 'auth-storage', // Key di localStorage
    }
  )
);

export default useAuthStore;
