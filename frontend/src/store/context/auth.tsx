import React, { createContext, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth-store';
import { logout, loginWithGoogle, loginWithEmail, refreshFirebaseToken } from '@/utils/auth';
import { setTokenRefreshFunction } from '@/lib/openapi';

import type { Role, AuthContextType } from '@/types/auth.types';


// Create a context with default values
export const AuthContext = createContext<AuthContextType>({
  role: null,
  isAuthenticated: false,
  login: () => { },
  loginWithGoogle: async () => { },
  loginWithEmail: async () => { },
  logout: () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, setUser, clearUser, setToken, setAuthReady } = useAuthStore();
  const tokenRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Logout function that clears the user from the store
  const handleLogout = useCallback(() => {
    if (tokenRefreshIntervalRef.current) {
      clearInterval(tokenRefreshIntervalRef.current);
      tokenRefreshIntervalRef.current = null;
    }
    logout();
    clearUser();
  }, [clearUser]);

  // Firebase auth state listener and token management
  useEffect(() => {
    // Register the token refresh function with the API client
    setTokenRefreshFunction(refreshFirebaseToken);

    let unsubscribe = () => {};

    if (auth && auth.app) {
      try {
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          console.log('[Auth] onAuthStateChanged fired, user:', firebaseUser ? 'exists' : 'null');
          if (firebaseUser) {
            try {
              console.log('[Auth] Getting fresh token...');
              const token = await firebaseUser.getIdToken(true);
              console.log('[Auth] Fresh token obtained, setting token and authReady');
              setToken(token);
              setAuthReady(true);

              if (tokenRefreshIntervalRef.current) {
                clearInterval(tokenRefreshIntervalRef.current);
              }

              tokenRefreshIntervalRef.current = setInterval(async () => {
                try {
                  await refreshFirebaseToken();
                } catch (error) {
                  console.error('Failed to refresh token:', error);
                  try {
                    console.log('Retrying token refresh...');
                    const firebaseUser = auth?.currentUser;
                    if (firebaseUser) {
                      const newToken = await firebaseUser.getIdToken(true);
                      setToken(newToken);
                    }
                  } catch (retryError) {
                    console.error('Token refresh retry failed:', retryError);
                  }
                }
              }, 50 * 60 * 1000);
            } catch (error) {
              console.error('Error getting initial token:', error);
              try {
                const retryToken = await firebaseUser.getIdToken(true);
                setToken(retryToken);
              } catch (retryError) {
                console.error('Token refresh on page load failed:', retryError);
              }
            }
          } else {
            if (localStorage.getItem('auth-provider') === 'local' && localStorage.getItem('firebase-auth-token')) {
              setAuthReady(true);
              return;
            }
            if (tokenRefreshIntervalRef.current) {
              clearInterval(tokenRefreshIntervalRef.current);
              tokenRefreshIntervalRef.current = null;
            }
            clearUser();
            setAuthReady(true);
          }
        });
      } catch (err) {
        console.warn('[Auth] Firebase listener failed (local auth fallback):', err);
        setAuthReady(true);
      }
    } else {
      console.log('[Auth] Operating in local auth mode (Firebase bypassed)');
      setAuthReady(true);
    }

    // Cleanup function
    return () => {
      if (unsubscribe) unsubscribe();
      if (tokenRefreshIntervalRef.current) {
        clearInterval(tokenRefreshIntervalRef.current);
      }
    };
  }, [setToken, clearUser, handleLogout]);

  // Login function that sets the user in the store
  const login = (selectedRole: Role, uid: string, email: string, name?: string) => {
    if (selectedRole) {
      setUser({
        uid,
        email,
        name,
        role: selectedRole,
      });
    }
  };

  return (
    <AuthContext.Provider value={{
      role: user?.role || null,
      isAuthenticated,
      login,
      loginWithGoogle,
      loginWithEmail,
      logout: handleLogout
    }}>
      {children}
    </AuthContext.Provider>
  );
}
