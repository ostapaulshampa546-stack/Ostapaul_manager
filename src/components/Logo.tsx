import Link from "next/link";

export function Logo({ dark = false, href = "/" }: { dark?: boolean; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2">
      <svg viewBox="0 0 512 512" className="h-8 w-8" aria-hidden>
        <rect width="512" height="512" rx="112" fill="#0B1F4B" />
        <circle cx="256" cy="256" r="150" fill="none" stroke="#1E6BFF" strokeWidth="44" />
        <path d="M256 106a150 150 0 0 1 150 150" fill="none" stroke="#D4A72C" strokeWidth="44" strokeLinecap="round" />
      </svg>
      <span className={`text-lg font-extrabold tracking-tight ${dark ? "text-white" : "text-navy-900"}`}>
        OSTAPAUL <span className="text-gold-500">MANAGER</span>
      </span>
    </Link>
  );
}
