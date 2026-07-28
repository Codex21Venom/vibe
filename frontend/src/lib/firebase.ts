// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  signOut, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode } from "firebase/auth";
import { useAuthStore } from "../store/auth-store";
import { useLoginWithGoogle } from "@/hooks/hooks";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let app: any = null;
let auth: any = null;
let provider: any = null;
let analytics: any = null;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "undefined") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    try {
      analytics = getAnalytics(app);
    } catch {
      analytics = null;
    }
  } else {
    console.warn('[Firebase] VITE_FIREBASE_API_KEY is missing. Operating in local auth mode.');
  }
} catch (error) {
  console.warn('[Firebase] Firebase initialization failed. Operating in local auth mode:', error);
  app = null;
  auth = null;
  provider = null;
  analytics = null;
}

export { auth, provider, analytics };

// Firebase authentication functions
export const loginWithGoogle = async () => {
  if (!auth || !auth.app) {
    throw new Error("Google Sign-In requires active Firebase credentials. Please sign in using Email & Password for local development.");
  }
  const result = await signInWithPopup(auth, provider);
  // Get ID token for backend authentication
  const idToken = await result.user.getIdToken();
  
  localStorage.setItem('auth-provider', 'google');
  // Store the token
  useAuthStore.getState().setToken(idToken);
  
  return result;
};

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

// Function to create a user with email and password without touching Firebase
export const createUserWithEmail = async (email: string, password: string, displayName?: string) => {
  // Pass directly to backend without creating account in Firebase
  return {
    user: {
      uid: 'local_' + Date.now(),
      email,
      displayName: displayName || '',
      getIdToken: async () => useAuthStore.getState().token || '',
    }
  };
};

/**
 * Sends a password reset email to the user
 * Firebase automatically handles email delivery
 */
export const sendPasswordResetEmail = async (email: string) => {
  const auth = getAuth(app);
  
  try {
    // This triggers Firebase to send password reset email
    await firebaseSendPasswordResetEmail(auth, email, {
      // URL where user will be redirected after clicking link
      url: `${window.location.origin}/reset-password`,
      handleCodeInApp: true,
    });
    
    return {
      success: true,
      message: 'Password reset email sent! Check your inbox.',
    };
  } catch (error: any) {
    console.error('Password reset error:', error);
    
    let message = 'Failed to send reset email. Please try again.';
    
    if (error.code === 'auth/user-not-found') {
      message = 'No account found with this email address.';
    } else if (error.code === 'auth/invalid-email') {
      message = 'Invalid email address.';
    } else if (error.code === 'auth/too-many-requests') {
      message = 'Too many requests. Please try again later.';
    }
    
    throw new Error(message);
  }
};

/**
 * Verifies a password reset code is valid
 */
export const verifyResetCode = async (code: string) => {
  const auth = getAuth(app);
  
  try {
    const email = await verifyPasswordResetCode(auth, code);
    return { valid: true, email };
  } catch (error: any) {
    console.error('Verify reset code error:', error);
    
    let message = 'Invalid or expired reset code.';
    
    if (error.code === 'auth/invalid-action-code') {
      message = 'This reset link has already been used or is invalid.';
    } else if (error.code === 'auth/expired-action-code') {
      message = 'This reset link has expired. Please request a new one.';
    }
    
    return { valid: false, message };
  }
};

/**
 * Resets password using the code from email
 */
export const resetPassword = async (code: string, newPassword: string) => {
  const auth = getAuth(app);
  
  try {
    await confirmPasswordReset(auth, code, newPassword);
    return {
      success: true,
      message: 'Password reset successfully!',
    };
  } catch (error: any) {
    console.error('Password reset error:', error);
    
    let message = 'Failed to reset password. Please try again.';
    
    if (error.code === 'auth/invalid-action-code') {
      message = 'This reset link has already been used or is invalid.';
    } else if (error.code === 'auth/expired-action-code') {
      message = 'This reset link has expired. Please request a new one.';
    } else if (error.code === 'auth/weak-password') {
      message = 'Password is too weak. Please choose a stronger password.';
    }
    
    throw new Error(message);
  }
};

export const logout = () => {
  localStorage.removeItem('auth-provider');
  if (auth && auth.app) {
    signOut(auth).catch(() => {});
  }
  useAuthStore.getState().clearUser();
};