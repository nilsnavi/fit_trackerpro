import type { SVGProps } from 'react'

export type SignatureIconName =
  | 'brand' | 'overview' | 'workout' | 'program' | 'progress'
  | 'clients' | 'schedule' | 'monitor' | 'shield' | 'flame'
  | 'clock' | 'chevron' | 'arrow'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: SignatureIconName
  size?: number
}

const shapes: Record<SignatureIconName, React.ReactNode> = {
  brand: <><path d="M5 19.5V8.5L11 4.5L17.2 8.5L25.5 5.5V18.5L19 24.5L13 20.5L5 25.5" /><path className="ftp-signature-icon__accent" d="M7.8 16.4H12L15 10.6L18.1 18L20.2 14.5H24" /></>,
  overview: <><path d="M4 15.5L16 4.5L28 15.5" /><path d="M7.3 14.1V27H24.7V14.1" /><path className="ftp-signature-icon__accent" d="M13 27V18.5H19V27" /></>,
  workout: <><path d="M4.5 10V22M8.3 7V25M23.7 7V25M27.5 10V22" /><path d="M8.3 16H23.7" /><path className="ftp-signature-icon__accent" d="M12.8 12.2L19.2 19.8M19.2 12.2L12.8 19.8" /></>,
  program: <><path d="M7 4.5H23.3L27 8.2V27H7Z" /><path d="M23 4.5V9H27" /><path className="ftp-signature-icon__accent" d="M11 14H22M11 19H18M11 24H20" /><path d="M4.5 8H7M4.5 16H7M4.5 24H7" /></>,
  progress: <><path d="M5 25H27M6.5 24V17M12.5 24V14M18.5 24V10M24.5 24V5.5" /><path className="ftp-signature-icon__accent" d="M6 15L13 10L18 12L26 4.5M20.9 4.5H26V9.5" /></>,
  clients: <><circle cx="12.5" cy="11" r="4.2"/><path d="M4.5 26V23.8C4.5 19.5 7.4 17 12.5 17S20.5 19.5 20.5 23.8V26Z" /><path className="ftp-signature-icon__accent" d="M22 8A3.5 3.5 0 0 1 22 15M22.5 18.5C26 19 28 21.2 28 24.8V26H24" /></>,
  schedule: <><rect x="4.5" y="7" width="23" height="20" rx="3"/><path d="M4.5 13H27.5M10 4V10M22 4V10" /><path className="ftp-signature-icon__accent" d="M11 19.5L14.6 23L21 16.5" /></>,
  monitor: <><path d="M7 6H25V27H7Z"/><path d="M12 4H20V8H12Z"/><path d="M11 14H21M11 19H15"/><path className="ftp-signature-icon__accent" d="M17 21L20 24L25.5 17.5" /></>,
  shield: <><path d="M16 3.5L27 8V16C27 22.5 22.8 26.5 16 29C9.2 26.5 5 22.5 5 16V8Z"/><path className="ftp-signature-icon__accent" d="M10.5 16.2L14.4 20.2L22 12.3" /></>,
  flame: <><path d="M16 3C18 9 12.5 11.3 14 16.5C10 15 10.5 11.3 10.5 9C2.2 17 8 28 16 28C23.3 28 27.5 19 21 12.5C21 17 19 18 17.5 17C19 11 18 7 16 3Z"/><path className="ftp-signature-icon__accent" d="M16 19C13.6 21.5 13.3 24.8 16 26.5C19.7 24.3 18.7 21.4 16 19Z" /></>,
  clock: <><circle cx="16" cy="16" r="12"/><path d="M16 8V16L21.5 19"/><path className="ftp-signature-icon__accent" d="M16 4V6M27 16H25" /></>,
  chevron: <path className="ftp-signature-icon__accent" d="M12 7L21 16L12 25"/>,
  arrow: <><path d="M4.5 16H27"/><path className="ftp-signature-icon__accent" d="M18.5 7.5L27 16L18.5 24.5" /></>,
}

export function SignatureIcon({ name, size = 24, className = '', ...props }: IconProps) {
  return <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    focusable="false" className={['ftp-signature-icon', className].filter(Boolean).join(' ')} {...props}>
    {shapes[name]}
  </svg>
}
