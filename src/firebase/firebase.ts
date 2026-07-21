// Firebase initialization helper
// Reads configuration from Vite environment variables (VITE_FIREBASE_*)
// Replace values in `.env.local` or set them in your hosting environment.

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'REPLACE_WITH_YOUR_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'REPLACE_WITH_YOUR_AUTH_DOMAIN',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'REPLACE_WITH_YOUR_PROJECT_ID',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'REPLACE_WITH_YOUR_STORAGE_BUCKET',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? 'REPLACE_WITH_YOUR_MESSAGING_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? 'REPLACE_WITH_YOUR_APP_ID',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? undefined,
}

// Initialize Firebase app
export const app = initializeApp(firebaseConfig)

// Exports auth and firestore instances for use in the app
export const auth = getAuth(app)
export const db = getFirestore(app)

// Note: Authentication and Firestore usage are not implemented yet.
