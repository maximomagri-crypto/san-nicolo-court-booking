type ToastProps = {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
}

const typeClasses: Record<NonNullable<ToastProps['type']>, string> = {
  success: 'toast-card--success',
  error: 'toast-card--error',
  info: 'toast-card--info',
}

export default function Toast({ message, type = 'info', onClose }: ToastProps) {
  return (
    <div className="toast-root" role="status" aria-live="polite">
      <div className={`toast-card ${typeClasses[type]}`}>
        <span>{message}</span>
        <button className="toast-close" type="button" onClick={onClose} aria-label="Chiudi notifica">
          ×
        </button>
      </div>
    </div>
  )
}
