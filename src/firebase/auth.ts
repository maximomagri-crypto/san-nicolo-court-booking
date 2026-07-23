import { auth } from './firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { createUserProfile, getUserProfile, updateUserLastLogin } from './user'
import type { UserProfile } from './types'

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: unknown }

export type SignInResult = AuthResult<{ user: User; profile: UserProfile }>
export type SignUpResult = AuthResult<{ user: User; profile: UserProfile }>

export async function signIn(email: string, password: string): Promise<SignInResult> {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    const user = credential.user

    if (!user) {
      return { ok: false, error: new Error('Utente non disponibile dopo il login') }
    }

    const profile = await getUserProfile(user.uid)
    if (!profile) {
      return { ok: false, error: new Error('Profilo utente non trovato') }
    }

    await updateUserLastLogin(user.uid)
    return { ok: true, data: { user, profile } }
  } catch (err) {
    return { ok: false, error: err }
  }
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<SignUpResult> {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    const user = credential.user

    if (!user) {
      return { ok: false, error: new Error('Utente non disponibile dopo la registrazione') }
    }

    const profile = await createUserProfile(user, displayName)
    return { ok: true, data: { user, profile } }
  } catch (err) {
    return { ok: false, error: err }
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err }
  }
}

export default {
  signIn,
  signUp,
  signOut,
}

