type Props = {
  onSubmit?: (data: { email: string; password: string; name?: string }) => void
  onSwitchToLogin?: () => void
}

export default function RegisterForm({ onSubmit, onSwitchToLogin }: Props) {
  return (
    <div>
      <form
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.currentTarget as HTMLFormElement
          const fd = new FormData(form)
          const name = String(fd.get('name') ?? '')
          const email = String(fd.get('email') ?? '')
          const password = String(fd.get('password') ?? '')
          onSubmit?.({ name, email, password })
        }}
      >
        <label className="field">
          <span className="label-text">Nome</span>
          <input className="input" name="name" type="text" />
        </label>

        <label className="field">
          <span className="label-text">Email</span>
          <input className="input" name="email" type="email" required />
        </label>

        <label className="field">
          <span className="label-text">Password</span>
          <input className="input" name="password" type="password" required />
        </label>

        <button className="login-btn" type="submit">
          Registrati
        </button>
      </form>

      <div className="signup-row">
        <span>Hai già un account?</span>
        <button
          className="signup-btn"
          type="button"
          onClick={() => onSwitchToLogin?.()}
        >
          Accedi
        </button>
      </div>
    </div>
  )
}
