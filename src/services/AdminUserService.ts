import {
  collection,
  doc,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  setDoc,
  type Query,
} from 'firebase/firestore'
import { db } from '../firebase/firebase'
import type { UserProfile, UserRole, UserStatus } from '../firebase/types'

export type AdminUserFilters = {
  status?: UserStatus
}

const usersCollectionRef = collection(db, 'users')
const eventLogsCollectionRef = collection(db, 'event_logs')

function userDocRef(uid: string) {
  return doc(db, 'users', uid)
}

function createEventLog(eventType: string, actorUid: string, targetUid: string, payload: Record<string, unknown>) {
  const logRef = doc(eventLogsCollectionRef)
  return setDoc(logRef, {
    eventType,
    actorUid,
    targetUid,
    payload,
    timestamp: serverTimestamp(),
  })
}

export function getUsers(filters: AdminUserFilters = {}): Query<UserProfile> {
  const usersQuery = filters.status
    ? query(usersCollectionRef, where('status', '==', filters.status), orderBy('createdAt', 'desc'))
    : query(usersCollectionRef, orderBy('createdAt', 'desc'))

  return usersQuery as Query<UserProfile>
}

export async function approveUser(uid: string, actorUid: string): Promise<void> {
  await updateDoc(userDocRef(uid), {
    status: 'ACTIVE',
    approvedAt: serverTimestamp(),
    approvedBy: actorUid,
  })

  await createEventLog('USER_APPROVED', actorUid, uid, {})
}

export async function suspendUser(uid: string, actorUid: string): Promise<void> {
  await updateDoc(userDocRef(uid), {
    status: 'SUSPENDED',
  })

  await createEventLog('USER_SUSPENDED', actorUid, uid, {})
}

export async function activateUser(uid: string, actorUid: string): Promise<void> {
  await updateDoc(userDocRef(uid), {
    status: 'ACTIVE',
  })

  await createEventLog('USER_REACTIVATED', actorUid, uid, {})
}

export async function changeRole(uid: string, role: Exclude<UserRole, 'SUPER_ADMIN'>, actorUid: string): Promise<void> {
  await updateDoc(userDocRef(uid), {
    role,
  })

  await createEventLog('ROLE_CHANGED', actorUid, uid, { role })
}
