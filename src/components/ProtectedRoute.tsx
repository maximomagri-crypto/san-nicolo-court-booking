import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../firebase/AuthProvider'
import type { UserRole } from '../firebase/types'
import SplashScreen from './SplashScreen'

type Props = {
  allowedRoles: UserRole[]
  children: ReactNode
}

export default function ProtectedRoute({ allowedRoles, children }: Props) {
  const { initialized, user, profile } = useAuth()
  const location = useLocation()

  if (!initialized) {
    return <SplashScreen />
  }

  if (!user || !profile) {
    return <Navigate to="/" state={{ from: location }} replace />
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
