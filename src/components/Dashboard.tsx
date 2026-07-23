import { Link } from 'react-router-dom'
import type { UserProfile } from '../firebase/types'

type Props = {
  profile: UserProfile
  onSignOut: () => void
}

export default function Dashboard({ profile, onSignOut }: Props) {
  const isAdmin = profile.role === 'SUB_ADMIN' || profile.role === 'SUPER_ADMIN'

  return (
    <section className="dashboard-root screen screen--visible" aria-label="Dashboard">
      <div className="dashboard-container">
        <h1 className="dashboard-title">Benvenuto, {profile.displayName}</h1>
        <p className="dashboard-subtitle">Il tuo account è attivo e puoi accedere alla dashboard.</p>

        <div className="dashboard-meta">
          <dl>
            <dt>Ruolo</dt>
            <dd>{profile.role}</dd>
            <dt>Email</dt>
            <dd>{profile.email}</dd>
            <dt>Stato</dt>
            <dd>{profile.status}</dd>
          </dl>
        </div>

        <Link className="admin-panel-link" to="/events">
          Vai al calendario eventi
        </Link>

        {isAdmin && (
          <Link className="admin-panel-link" to="/admin/users">
            Vai alla gestione utenti
          </Link>
        )}

        <button className="logout-btn" type="button" onClick={onSignOut}>
          Esci
        </button>
      </div>
    </section>
  )
}
