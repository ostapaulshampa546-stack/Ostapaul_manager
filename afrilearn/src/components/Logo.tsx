/** AFRILEARN logo: an "A" shaped like an open book under a rising golden sun — knowledge rising over Africa. */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="al-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2350e0" />
          <stop offset="1" stopColor="#071233" />
        </linearGradient>
        <linearGradient id="al-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd56b" />
          <stop offset="1" stopColor="#e09d0c" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#al-bg)" />
      <circle cx="32" cy="17" r="6" fill="url(#al-gold)" />
      <path d="M14 50 L29.5 22 h5 L50 50 h-7 l-3.2-6.2 H24.2 L21 50 Z M26.8 38.6 h10.4 L32 28.4 Z" fill="#fff" />
      <path d="M12 52 q10 -6 20 0 q10 -6 20 0" fill="none" stroke="url(#al-gold)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ dark = false, size = 36 }: { dark?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={`font-display text-xl font-bold tracking-tight ${dark ? "text-white" : "text-night-900"}`}>
        AFRI<span className="text-gold-500">LEARN</span>
      </span>
    </span>
  );
}
