import { auth } from './firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'

export async function signIn(email: string, password: string) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    const user: User | null = credential.user ?? null
    return { ok: true, user }
  } catch (err) {
    return { ok: false, error: err }
  }
}

export async function signUp(email: string, password: string) {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    const user: User | null = credential.user ?? null
    return { ok: true, user }
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

