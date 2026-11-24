import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="bg-night-grid flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center text-white">
      <Logo dark />
      <p className="font-display text-7xl font-bold text-gold-400">404</p>
      <p className="text-white/70">Page introuvable · Page not found</p>
      <Link href="/" className="btn btn-gold">AFRILEARN</Link>
    </div>
  );
}
