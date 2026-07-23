import type { Timestamp, FieldValue } from 'firebase/firestore'

export type UserRole = 'USER' | 'SUB_ADMIN' | 'SUPER_ADMIN'
export type UserStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED'
export type TimestampValue = Timestamp | FieldValue | null

export interface UserProfile {
  uid: string
  displayName: string
  email: string
  role: UserRole
  status: UserStatus
  isProfileComplete: boolean
  createdAt: TimestampValue
  approvedAt: Timestamp | null
  approvedBy: string | null
  lastLogin: TimestampValue
}
