type Props = {
  onSubmit?: (data: { email: string; password: string }) => void
  onSwitchToRegister?: () => void
}

export default function LoginForm({ onSubmit, onSwitchToRegister }: Props) {
  return (
    <div>
      <form
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.currentTarget as HTMLFormElement
          const fd = new FormData(form)
          const email = String(fd.get('email') ?? '')
          const password = String(fd.get('password') ?? '')
          onSubmit?.({ email, password })
        }}
      >
        <label className="field">
          <span className="label-text">Email</span>
          <input className="input" name="email" type="email" autoComplete="email" required />
        </label>

        <label className="field">
          <span className="label-text">Password</span>
          <input className="input" name="password" type="password" autoComplete="current-password" required />
        </label>

        <button className="login-btn" type="submit">
          Accedi
        </button>
      </form>

      <button className="login-link" type="button">
        Password dimenticata?
      </button>

      <div className="signup-row">
        <span>Non hai un account?</span>
        <button
          className="signup-btn"
          type="button"
          onClick={() => onSwitchToRegister?.()}
        >
          Registrati
        </button>
      </div>
    </div>
  )
}
