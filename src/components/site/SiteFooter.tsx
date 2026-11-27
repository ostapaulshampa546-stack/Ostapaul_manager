import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getPlatformInfo } from "@/lib/site";

export async function SiteFooter() {
  const info = await getPlatformInfo();
  return (
    <footer className="bg-navy-950 text-white/70">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo dark />
          <p className="mt-3 text-sm">Un seul logiciel. Trois secteurs. Une gestion intelligente.</p>
          <p className="mt-1 text-sm">Kinshasa, République démocratique du Congo.</p>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-gold-400">Solutions</div>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li><Link href="/restaurant" className="hover:text-white">Restaurant Manager</Link></li>
            <li><Link href="/ecole" className="hover:text-white">School Manager</Link></li>
            <li><Link href="/pme" className="hover:text-white">PME Manager</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-gold-400">Ressources</div>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li><Link href="/pricing" className="hover:text-white">Tarifs</Link></li>
            <li><Link href="/faq" className="hover:text-white">Questions fréquentes</Link></li>
            <li><Link href="/inscription" className="hover:text-white">Comment s&apos;inscrire</Link></li>
            <li><Link href="/signup" className="hover:text-white">Essai gratuit{info.trialLabel ? ` de ${info.trialLabel}` : ""}</Link></li>
            <li><Link href="/login" className="hover:text-white">Connexion</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-gold-400">Contact</div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {info.phone && <li><a href={`tel:${info.phone.replace(/\s/g, "")}`} className="hover:text-white">📞 {info.phone}</a></li>}
            {info.whatsapp && <li><a href={info.whatsapp} className="hover:text-white" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a></li>}
            {info.email && <li><a href={`mailto:${info.email}`} className="hover:text-white">✉️ {info.email}</a></li>}
            <li><Link href="/contact" className="hover:text-white">Demander une démonstration</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} OSTAPAUL MANAGER</span><span>Français · Lingala (en cours)</span>
        </div>
      </div>
    </footer>
  );
}
