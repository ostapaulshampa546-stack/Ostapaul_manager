"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; icon: string; exact?: boolean };

export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((n) => {
        const active = n.exact ? path === n.href : path === n.href || path.startsWith(n.href + "/");
        return (
          <li key={n.href}>
            <Link href={n.href} aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-white/12 text-white ring-1 ring-white/15" : "text-white/70 hover:bg-white/8 hover:text-white"}`}>
              <span aria-hidden="true" className="w-5 text-center">{n.icon}</span>{n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
