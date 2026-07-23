import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../firebase/AuthProvider'
import type { UserRole, UserStatus } from '../firebase/types'
import { useAdminUsers } from '../hooks/useAdminUsers'
import { approveUser, activateUser, changeRole, suspendUser } from '../services/AdminUserService'
import Toast from './Toast'
import { formatTimestamp, getNameParts } from '../utils/format'

type RoleChangeSelection = Exclude<UserRole, 'SUPER_ADMIN'>

type ToastState = {
  message: string
  type: 'success' | 'error'
}

const filterOptions = [
  { value: 'all', label: 'Tutti' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
] as const

function getUserStatusLabel(status: UserStatus) {
  return status === 'PENDING_APPROVAL'
    ? '🟡 PENDING_APPROVAL'
    : status === 'ACTIVE'
    ? '🟢 ACTIVE'
    : '🔴 SUSPENDED'
}

function getBadgeClass(status: UserStatus) {
  return `badge badge--${status.toLowerCase()}`
}

export default function AdminUsersPage() {
  const { user, profile } = useAuth()
  const [filter, setFilter] = useState<(typeof filterOptions)[number]['value']>('all')
  const [search, setSearch] = useState('')
  const [pendingActionUid, setPendingActionUid] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [roleSelection, setRoleSelection] = useState<Record<string, RoleChangeSelection>>({})

  const statusFilter = filter === 'all' ? undefined : (filter === 'pending' ? 'PENDING_APPROVAL' : filter.toUpperCase() as UserStatus)
  const { users, loading, error } = useAdminUsers(statusFilter)

  const currentUid = user?.uid ?? ''
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN'

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) {
      return users
    }

    return users.filter((profile) => {
      const { firstName, lastName } = getNameParts(profile.displayName)
      const subject = [firstName, lastName, profile.displayName, profile.email].join(' ').toLowerCase()
      return subject.includes(term)
    })
  }, [search, users])

  const showToast = (message: string, type: ToastState['type']) => {
    setToast({ message, type })
  }

  const closeToast = () => setToast(null)

  const handleAction = async (uid: string, action: () => Promise<void>, successMessage: string) => {
    if (uid === currentUid) {
      showToast('Non puoi modificare il tuo account.', 'error')
      return
    }

    setPendingActionUid(uid)
    try {
      await action()
      showToast(successMessage, 'success')
    } catch (err) {
      showToast(String(err ?? 'Errore durante l’operazione'), 'error')
    } finally {
      setPendingActionUid(null)
    }
  }

  const handleApprove = async (uid: string) => {
    await handleAction(uid, () => approveUser(uid, currentUid), 'Utente approvato con successo.')
  }

  const handleSuspend = async (uid: string) => {
    await handleAction(uid, () => suspendUser(uid, currentUid), 'Utente sospeso con successo.')
  }

  const handleActivate = async (uid: string) => {
    await handleAction(uid, () => activateUser(uid, currentUid), 'Utente riattivato con successo.')
  }

  const handleChangeRole = async (uid: string, role: RoleChangeSelection) => {
    if (uid === currentUid) {
      showToast('Non puoi modificare il tuo ruolo.', 'error')
      return
    }

    await handleAction(uid, () => changeRole(uid, role, currentUid), 'Ruolo aggiornato con successo.')
  }

  return (
    <section className="admin-users-root">
      <div className="admin-users-header">
        <div>
          <p className="admin-context">Amministrazione utenti</p>
          <h1 className="admin-title">Gestione utenti</h1>
          <p className="admin-subtitle">Filtro realtime, ricerca immediata e azioni amministrative centralizzate.</p>
        </div>
        <Link className="admin-back-link" to="/">
          Torna alla dashboard
        </Link>
      </div>

      <div className="admin-toolbar">
        <div className="admin-filter-group" role="group" aria-label="Filtri utenti">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`admin-filter ${filter === option.value ? 'admin-filter--active' : ''}`}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <input
          className="admin-search"
          type="search"
          placeholder="Cerca nome, cognome, display name o email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Ricerca utenti"
        />
      </div>

      <div className="admin-users-meta">
        <span>{filteredUsers.length} utenti</span>
        <span>{loading ? 'Aggiornamento in corso...' : 'Aggiornamento realtime attivo'}</span>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Cognome</th>
              <th>Display Name</th>
              <th>Email</th>
              <th>Ruolo</th>
              <th>Stato</th>
              <th>Registrazione</th>
              <th>Ultimo accesso</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((item) => {
              const { firstName, lastName } = getNameParts(item.displayName)
              const canManageUser = item.uid !== currentUid
              const isProcessing = pendingActionUid === item.uid
              const shouldShowRoleChange = isSuperAdmin && item.uid !== currentUid && item.role !== 'SUPER_ADMIN'
              const selectedRole = roleSelection[item.uid] ?? (item.role === 'SUB_ADMIN' ? 'SUB_ADMIN' : 'USER')

              return (
                <tr key={item.uid}>
                  <td>{firstName}</td>
                  <td>{lastName}</td>
                  <td>{item.displayName}</td>
                  <td>{item.email}</td>
                  <td>{item.role}</td>
                  <td>
                    <span className={getBadgeClass(item.status)}>{getUserStatusLabel(item.status)}</span>
                  </td>
                  <td>{formatTimestamp(item.createdAt)}</td>
                  <td>{formatTimestamp(item.lastLogin)}</td>
                  <td>
                    <div className="admin-actions">
                      {item.status === 'PENDING_APPROVAL' && (
                        <button
                          className="admin-action-btn"
                          type="button"
                          onClick={() => handleApprove(item.uid)}
                          disabled={!canManageUser || isProcessing}
                        >
                          Approva
                        </button>
                      )}
                      {item.status === 'ACTIVE' && (
                        <button
                          className="admin-action-btn admin-action-btn--warning"
                          type="button"
                          onClick={() => handleSuspend(item.uid)}
                          disabled={!canManageUser || isProcessing}
                        >
                          Sospendi
                        </button>
                      )}
                      {item.status === 'SUSPENDED' && (
                        <button
                          className="admin-action-btn admin-action-btn--success"
                          type="button"
                          onClick={() => handleActivate(item.uid)}
                          disabled={!canManageUser || isProcessing}
                        >
                          Riattiva
                        </button>
                      )}
                      {shouldShowRoleChange && (
                        <div className="role-change-group">
                          <select
                            className="role-change-select"
                            value={selectedRole}
                            onChange={(event) =>
                              setRoleSelection((prev) => ({
                                ...prev,
                                [item.uid]: event.target.value as RoleChangeSelection,
                              }))
                            }
                            disabled={isProcessing}
                          >
                            <option value="USER">USER</option>
                            <option value="SUB_ADMIN">SUB_ADMIN</option>
                          </select>
                          <button
                            className="admin-action-btn admin-action-btn--secondary"
                            type="button"
                            onClick={() => handleChangeRole(item.uid, selectedRole)}
                            disabled={isProcessing || selectedRole === item.role}
                          >
                            Salva
                          </button>
                        </div>
                      )}
                    </div>
                    {!canManageUser && <p className="admin-note">Non puoi modificare te stesso.</p>}
                  </td>
                </tr>
              )
            })}
            {!loading && filteredUsers.length === 0 && (
              <tr>
                <td colSpan={9} className="admin-empty-row">
                  Nessun utente trovato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <p className="admin-error">Errore: {String(error.message)}</p>}
      {loading && <p className="admin-loading">Caricamento utenti...</p>}

      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </section>
  )
}
