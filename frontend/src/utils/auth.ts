import { auth, provider } from '../lib/firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser // Import Firebase User type
} from 'firebase/auth';
import { useAuthStore } from '../store/auth-store'; // Removed unused User import
import { queryClient } from '../lib/client';



// Enhance mapFirebaseUserToAppUser to fetch backend user info directly
const mapFirebaseUserToAppUser = async (firebaseUser: FirebaseUser | null) => {
  if (!firebaseUser) return null;
  try {
    // Get token for backend API calls
    const token = await firebaseUser.getIdToken(true);
    useAuthStore.getState().setToken(token);

    let backendUser: any = null;
    try {
      const baseUrl = import.meta.env.VITE_BASE_URL;
      const response = await fetch(`${baseUrl}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        backendUser = await response.json();
      }
    } catch (profileError) {
      console.error('Failed to fetch backend profile:', profileError);
    }

    const resolvedFirstName = backendUser?.firstName || '';
    const resolvedLastName = backendUser?.lastName || '';
    const resolvedName = `${resolvedFirstName} ${resolvedLastName}`.trim();

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: resolvedName || firebaseUser.displayName || '',
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      role: useAuthStore.getState().user?.role || null,
      avatar: backendUser?.avatar || firebaseUser.photoURL || '',
      gender: backendUser?.gender || '',
      country: backendUser?.country || '',
      state: backendUser?.state || '',
      city: backendUser?.city || '',
    };
  } catch (error) {
    console.error('Error mapping Firebase user:', error);
    return null;
  }
};

export const refreshFirebaseToken = async (): Promise<void> => {
  if (localStorage.getItem('auth-provider') === 'local') {
    return;
  }
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) {
    throw new Error('No authenticated user found');
  }
  try {
    const token = await firebaseUser.getIdToken(true);
    useAuthStore.getState().setToken(token);
  } catch (error) {
    console.error('Error refreshing Firebase token:', error);
    throw error;
  }
};

// Login with Google in a popup
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    localStorage.setItem('auth-provider', 'google');
    const user = await mapFirebaseUserToAppUser(result.user);
    if (user) {
      useAuthStore.getState().setUser(user);
    }
    return result;
  } catch (error) {
    console.error('Google login error:', error);
    throw error;
  }
};

// Login with email/password
export const loginWithEmail = async (email: string, password: string) => {
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, recaptchaToken: "NO_CAPTCHA" }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Invalid email or password.');
  }

  const result = await response.json();
  const idToken = result.idToken || result.token;
  if (!idToken) {
    throw new Error('Login failed: No token received.');
  }

  localStorage.setItem('auth-provider', 'local');
  useAuthStore.getState().setToken(idToken);

  const userObj = result.user || {};
  const displayName = result.displayName || `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim();

  const appUser = {
    uid: result.localId || userObj._id || '',
    email: result.email || email,
    name: displayName,
    firstName: userObj.firstName || '',
    lastName: userObj.lastName || '',
    role: useAuthStore.getState().user?.role || 'student',
    avatar: userObj.profileImage || '',
  };
  useAuthStore.getState().setUser(appUser as any);

  return {
    user: {
      uid: result.localId || userObj._id || '',
      email: result.email || email,
      displayName: displayName,
      photoURL: userObj.profileImage || '',
      getIdToken: async () => idToken,
    },
    ...result,
  };
};

// Use a single implementation of logout and checkAuth
// Logout
export function logout() {
  localStorage.removeItem('isAuth');
  localStorage.removeItem('firebase-auth-token');
  localStorage.removeItem('auth-provider');
  firebaseSignOut(auth).catch(err => console.error('Firebase logout error:', err));
  useAuthStore.getState().clearUser();
  queryClient.clear();
}

// Check if user is authenticated
export function checkAuth() {
  const token = localStorage.getItem('firebase-auth-token');
  if (localStorage.getItem('auth-provider') === 'local') {
    return !!token;
  }
  const firebaseUser = auth.currentUser;
  return !!token && !!firebaseUser;
}

// API-specific functions
// Use openapi-react-query hooks from hooks.ts
export { useLogin } from '../hooks/hooks';
