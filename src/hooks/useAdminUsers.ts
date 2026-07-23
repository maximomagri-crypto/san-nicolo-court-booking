import { useEffect, useState } from 'react'
import { onSnapshot, type Unsubscribe } from 'firebase/firestore'
import type { UserProfile, UserStatus } from '../firebase/types'
import { getUsers } from '../services/AdminUserService'

export function useAdminUsers(status?: UserStatus) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const unsubscribe: Unsubscribe = onSnapshot(
      getUsers(status ? { status } : {}),
      (snapshot) => {
        const profiles = snapshot.docs.map((doc) => doc.data() as UserProfile)
        setUsers(profiles)
        setLoading(false)
      },
      (snapshotError) => {
        const error = snapshotError as unknown
        setError(error instanceof Error ? error : new Error(String(error)))
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [status])

  return { users, loading, error }
}
