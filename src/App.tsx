import { Suspense, lazy, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute'
import SplashScreen from './components/SplashScreen'
import { signIn, signUp, signOut } from './firebase/auth'
import { useAuth } from './firebase/AuthProvider'

const LoginForm = lazy(() => import('./components/LoginForm'))
const RegisterForm = lazy(() => import('./components/RegisterForm'))
const Dashboard = lazy(() => import('./components/Dashboard'))
const StatusPage = lazy(() => import('./components/StatusPage'))
const AdminUsersPage = lazy(() => import('./components/AdminUsersPage'))
const EventsPage = lazy(() => import('./components/EventsPage'))

type AuthView = 'home' | 'login' | 'register'

type ProfileStatusView = 'dashboard' | 'pending' | 'suspended'

type AuthFeedback = {
  type: 'error'
  message: string
}

function AppLoader() {
  return (
    <div className="app-shell">
      <section className="status-root screen screen--visible" aria-label="Caricamento pagina">
        <div className="status-container">
          <h1 className="status-title">Caricamento in corso</h1>
          <p className="status-description">Stiamo preparando la pagina richiesta.</p>
        </div>
      </section>
    </div>
  )
}

function App() {
  const { initialized, user, profile, error } = useAuth()
  const [view, setView] = useState<AuthView>('home')
  const [authFeedback, setAuthFeedback] = useState<AuthFeedback | null>(null)

  const navigateHome = () => {
    setView('home')
    setAuthFeedback(null)
  }

  const handleSignOut = async () => {
    await signOut()
    navigateHome()
  }

  const handleLogin = async (data: { email: string; password: string }) => {
    setAuthFeedback(null)
    const result = await signIn(data.email, data.password)

    if (!result.ok) {
      console.error('Sign in error', result.error)
      setAuthFeedback({ type: 'error', message: 'Errore login: ' + String(result.error) })
      return
    }

    if (result.data.profile.status === 'ACTIVE') {
      setView('login')
    }
  }

  const handleRegister = async (data: { email: string; password: string; name?: string }) => {
    setAuthFeedback(null)
    const displayName = data.name?.trim() ?? ''
    const result = await signUp(data.email, data.password, displayName)

    if (!result.ok) {
      console.error('Register error', result.error)
      setAuthFeedback({ type: 'error', message: 'Errore registrazione: ' + String(result.error) })
      return
    }

    setView('register')
  }

  if (!initialized) {
    return <SplashScreen />
  }

  if (error) {
    return (
      <div className="app-shell">
        <section className="status-root screen screen--visible" aria-label="Errore autenticazione">
          <div className="status-container">
            <h1 className="status-title">Errore di autenticazione</h1>
            <p className="status-description">{String(error)}</p>
            <button className="status-action" type="button" onClick={navigateHome}>
              Riprova
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app-shell">
        <a className="skip-link" href="#main-content">
          Salta al contenuto principale
        </a>
        <main
          id="main-content"
          className={`home-root screen ${view === 'home' ? 'screen--visible' : 'screen--hidden'}`}
          role="main"
          aria-labelledby="home-title"
          aria-hidden={view !== 'home'}
        >
          <div className="home-container">
            <div className="home-icon" aria-hidden="true">
              🎾
            </div>

            <h1 id="home-title" className="home-title">
              San Nicolò Court Booking
            </h1>

            <p className="home-motto">"Il campo di tutti, organizzato al meglio."</p>

            {authFeedback && (
              <p className="inline-feedback inline-feedback--error" role="alert" aria-live="assertive">
                {authFeedback.message}
              </p>
            )}

            <button
              className="home-cta"
              type="button"
              onClick={() => setView('login')}
              aria-controls="login-panel"
            >
              Accedi
            </button>

            <button className="home-cta" type="button" onClick={() => setView('register')}>
              Registrati
            </button>
          </div>
        </main>

        <section
          id="login-panel"
          className={`login-root screen ${view === 'login' ? 'screen--visible' : 'screen--hidden'}`}
          aria-hidden={view !== 'login'}
        >
          <div className="login-container">
            <h1 className="login-title">Bentornato</h1>
            <p className="login-sub">Accedi al tuo account</p>

            <Suspense fallback={<p className="login-sub">Caricamento modulo...</p>}>
              <LoginForm onSubmit={handleLogin} onSwitchToRegister={() => setView('register')} />
            </Suspense>
          </div>
        </section>

        <section
          id="register-panel"
          className={`login-root screen ${view === 'register' ? 'screen--visible' : 'screen--hidden'}`}
          aria-hidden={view !== 'register'}
        >
          <div className="login-container">
            <h1 className="login-title">Registrati</h1>
            <p className="login-sub">Crea il tuo account</p>

            <Suspense fallback={<p className="login-sub">Caricamento modulo...</p>}>
              <RegisterForm onSubmit={handleRegister} onSwitchToLogin={() => setView('login')} />
            </Suspense>
          </div>
        </section>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="app-shell">
        <section className="status-root screen screen--visible" aria-label="Profilo utente non trovato">
          <div className="status-container">
            <h1 className="status-title">Profilo utente mancante</h1>
            <p className="status-description">Non è stato possibile recuperare il tuo profilo. Riprova più tardi.</p>
            <button className="status-action" type="button" onClick={handleSignOut}>
              Esci
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (profile.status !== 'ACTIVE') {
    const statusView: ProfileStatusView = profile.status === 'PENDING_APPROVAL' ? 'pending' : 'suspended'
    const statusConfig =
      statusView === 'pending'
        ? {
            title: 'In attesa di approvazione',
            description:
              "Il tuo account è stato creato. Riceverai una notifica non appena l'amministratore approverà il tuo profilo.",
          }
        : {
            title: 'Account sospeso',
            description: "Il tuo account è sospeso. Se pensi che ci sia un errore, contatta l'assistenza o riprova più tardi.",
          }

    return (
      <div className="app-shell">
        <Suspense fallback={<AppLoader />}>
          <StatusPage
            title={statusConfig.title}
            description={statusConfig.description}
            actionLabel="Torna alla home"
            onAction={handleSignOut}
          />
        </Suspense>
      </div>
    )
  }

  return (
    <Suspense fallback={<AppLoader />}>
      <a className="skip-link" href="#main-content">
        Salta al contenuto principale
      </a>
      <Routes>
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['SUB_ADMIN', 'SUPER_ADMIN']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events"
          element={
            <div className="app-shell" id="main-content">
              <EventsPage />
            </div>
          }
        />
        <Route
          path="/*"
          element={
            <div className="app-shell" id="main-content">
              <Dashboard profile={profile} onSignOut={handleSignOut} />
            </div>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
