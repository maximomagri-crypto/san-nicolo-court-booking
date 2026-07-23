import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import type { UserProfile } from './types'
import { db } from './firebase'

const usersCollection = 'users'

function userDocRef(uid: string) {
  return doc(db, usersCollection, uid)
}

export async function createUserProfile(user: User, displayName: string): Promise<UserProfile> {
  const profile: UserProfile = {
    uid: user.uid,
    displayName,
    email: user.email ?? '',
    role: 'USER',
    status: 'PENDING_APPROVAL',
    isProfileComplete: false,
    createdAt: serverTimestamp(),
    approvedAt: null,
    approvedBy: null,
    lastLogin: serverTimestamp(),
  }

  await setDoc(userDocRef(user.uid), profile)
  return profile
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(userDocRef(uid))
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null
}

export async function updateUserLastLogin(uid: string): Promise<void> {
  await updateDoc(userDocRef(uid), {
    lastLogin: serverTimestamp(),
  })
}

export function onUserProfileSnapshot(uid: string, callback: (profile: UserProfile | null) => void): Unsubscribe {
  return onSnapshot(userDocRef(uid), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.data() as UserProfile) : null)
  })
}
