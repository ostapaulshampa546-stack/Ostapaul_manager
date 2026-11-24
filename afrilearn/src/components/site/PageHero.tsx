import type { ReactNode } from "react";
import { AfricaPoster } from "@/components/three/Hero3D";

export function PageHero({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <section className="bg-night-grid relative overflow-hidden pb-16 pt-32 text-white sm:pt-36">
      <div className="pointer-events-none absolute -right-24 top-10 hidden h-[420px] w-[420px] opacity-25 md:block">
        <AfricaPoster className="h-full w-full" />
      </div>
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {eyebrow && <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-gold-400">{eyebrow}</p>}
        <h1 className="font-display max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-5 max-w-2xl text-lg text-white/75">{subtitle}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

export function Section({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 ${className}`}>{children}</section>;
}

export function SectionTitle({ title, subtitle, light = false, center = false }: { title: string; subtitle?: string; light?: boolean; center?: boolean }) {
  return (
    <div className={`mb-10 ${center ? "mx-auto text-center" : ""} max-w-3xl`}>
      <h2 className={`font-display text-3xl font-bold sm:text-4xl ${light ? "text-white" : "text-night-900"}`}>{title}</h2>
      {subtitle && <p className={`mt-3 text-lg ${light ? "text-white/70" : "text-muted"}`}>{subtitle}</p>}
    </div>
  );
}
