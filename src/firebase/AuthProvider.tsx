import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from './firebase'
import { onUserProfileSnapshot, updateUserLastLogin } from './user'
import type { UserProfile } from './types'

export type AuthContextValue = {
  initialized: boolean
  user: User | null
  profile: UserProfile | null
  error: unknown
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let unsyncProfile: (() => void) | null = null

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (currentUser: User | null) => {
        setUser(currentUser)
        setError(null)

        if (!currentUser) {
          if (unsyncProfile) {
            unsyncProfile()
            unsyncProfile = null
          }
          setProfile(null)
          setInitialized(true)
          return
        }

        if (unsyncProfile) {
          unsyncProfile()
          unsyncProfile = null
        }

        try {
          await updateUserLastLogin(currentUser.uid)
        } catch (reason) {
          console.error('Unable to update last login', reason)
        }

        unsyncProfile = onUserProfileSnapshot(currentUser.uid, (snapshotProfile) => {
          setProfile(snapshotProfile)
          setInitialized(true)
        })
      },
      (authError: unknown) => {
        setError(authError)
        setInitialized(true)
      },
    )

    return () => {
      unsubscribeAuth()
      if (unsyncProfile) {
        unsyncProfile()
      }
    }
  }, [])

  const value = useMemo(
    () => ({ initialized, user, profile, error }),
    [initialized, user, profile, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
