import { useState } from 'react'
import './App.css'
import LoginForm from './components/LoginForm'
import RegisterForm from './components/RegisterForm'

/**
 * Homepage component
 *
 * This component replaces the Vite example page with a minimal,
 * responsive landing screen for "San Nicolò Court Booking".
 * It's intentionally simple and easy to extend.
 */
function App() {
  const [view, setView] = useState<'home' | 'login' | 'register'>('home')

  return (
    <div className="app-shell">
      {/* Home screen */}
      <main
        className={`home-root screen ${view === 'home' ? 'screen--visible' : 'screen--hidden'}`}
        role="main"
        aria-labelledby="home-title"
        aria-hidden={view !== 'home'}
      >
        <div className="home-container">
          {/* Temporary tennis icon — replace with SVG or component later */}
          <div className="home-icon" aria-hidden="true">
            🎾
          </div>

          {/* Main title */}
          <h1 id="home-title" className="home-title">
            San Nicolò Court Booking
          </h1>

          {/* Motto / subtitle */}
          <p className="home-motto">"Il campo di tutti, organizzato al meglio."</p>

          {/* Primary CTA — opens login */}
          <button
            className="home-cta"
            type="button"
            onClick={() => setView('login')}
            aria-controls="login-panel"
          >
            Inizia
          </button>
        </div>
      </main>

      {/* Login screen (initially hidden) */}
      <section
        id="login-panel"
        className={`login-root screen ${view === 'login' ? 'screen--visible' : 'screen--hidden'}`}
        aria-hidden={view !== 'login'}
      >
        <div className="login-container">
          <h1 className="login-title">Bentornato</h1>
          <p className="login-sub">Accedi al tuo account</p>

          <LoginForm
            onSubmit={async (data: { email: string; password: string }) => {
              // call real Firebase auth (implemented in src/firebase/auth.ts)
              try {
                const { signIn } = await import('./firebase/auth.js')
                const res = await signIn(data.email, data.password)
                if (res.ok) {
                  console.log('Signed in', res.user)
                  setView('home')
                } else {
                  console.error('Sign in error', res.error)
                  alert('Errore login: ' + String(res.error))
                }
              } catch (e) {
                console.error(e)
                alert('Errore imprevisto durante il login')
              }
            }}
            onSwitchToRegister={() => setView('register')}
          />
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

          <RegisterForm
            onSubmit={async (data: { name?: string; email: string; password: string }) => {
              try {
                const { signUp } = await import('./firebase/auth.js')
                const res = await signUp(data.email, data.password)
                if (res.ok) {
                  console.log('Registered', res.user)
                  setView('login')
                } else {
                  console.error('Register error', res.error)
                  alert('Errore registrazione: ' + String(res.error))
                }
              } catch (e) {
                console.error(e)
                alert('Errore imprevisto durante la registrazione')
              }
            }}
            onSwitchToLogin={() => setView('login')}
          />
        </div>
      </section>
    </div>
  )
}

export default App
