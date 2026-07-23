type Props = {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

export default function StatusPage({ title, description, actionLabel, onAction }: Props) {
  return (
    <section className="status-root screen screen--visible" aria-label={title}>
      <div className="status-container">
        <h1 className="status-title">{title}</h1>
        <p className="status-description">{description}</p>

        <button className="status-action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      </div>
    </section>
  )
}
