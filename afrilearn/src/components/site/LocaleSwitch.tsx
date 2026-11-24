"use client";
import { useRouter } from "next/navigation";

export function LocaleSwitch({ locale, dark = false }: { locale: "fr" | "en"; dark?: boolean }) {
  const router = useRouter();
  const set = (l: "fr" | "en") => {
    document.cookie = `al_locale=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  const base = dark ? "text-white/70 hover:text-white" : "text-muted hover:text-ink";
  return (
    <div className={`inline-flex rounded-lg p-0.5 text-xs font-bold ${dark ? "bg-white/10" : "bg-slate-100"}`} role="group" aria-label="Language">
      {(["fr", "en"] as const).map((l) => (
        <button key={l} type="button" onClick={() => set(l)} aria-pressed={locale === l}
          className={`rounded-md px-2.5 py-1 uppercase ${locale === l ? (dark ? "bg-white text-night-900" : "bg-white text-ink shadow-sm") : base}`}>
          {l}
        </button>
      ))}
    </div>
  );
}
