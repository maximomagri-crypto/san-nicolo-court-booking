export default function SplashScreen() {
  return (
    <section
      className="splash-root screen screen--visible"
      aria-label="Caricamento autenticazione"
      aria-live="polite"
      role="status"
    >
      <div className="splash-container">
        <div className="splash-spinner" aria-hidden="true" />
        <h1 className="splash-title">Caricamento in corso</h1>
        <p className="splash-description">Verifica accesso e stato utente in corso...</p>
      </div>
    </section>
  )
}
