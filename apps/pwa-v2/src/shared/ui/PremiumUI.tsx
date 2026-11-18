import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary' | 'ghost'
  icon?: ReactNode
}
export function Button({ tone = 'primary', icon, children, className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={['ftp-button', 'ftp-button--' + tone, className].filter(Boolean).join(' ')} {...props}>
    {icon}{children}
  </button>
}
type CardProps = HTMLAttributes<HTMLElement> & { eyebrow?: string; title?: string; action?: ReactNode }
export function Card({ eyebrow, title, action, children, className = '', ...props }: CardProps) {
  return <section className={['ftp-card', className].filter(Boolean).join(' ')} {...props}>
    {(eyebrow || title || action) && <header className="ftp-card__header">
      <div>{eyebrow && <div className="ftp-eyebrow">{eyebrow}</div>}{title && <h2>{title}</h2>}</div>
      {action}
    </header>}
    {children}
  </section>
}
export function EmptyState({ title, description, icon, action }: { title: string; description: string; icon?: ReactNode; action?: ReactNode }) {
  return <div className="ftp-empty" role="status">{icon && <span className="ftp-empty__icon" aria-hidden="true">{icon}</span>}
    <h3>{title}</h3><p>{description}</p>{action}
  </div>
}
export function StatusPill({ children, variant = 'neutral' }: { children: ReactNode; variant?: 'neutral'|'lime'|'info' }) {
  return <span className={`ftp-pill ftp-pill--${variant}`}>{children}</span>
}
