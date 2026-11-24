import type { Dict } from "@/lib/i18n";
import type { NavItem } from "@/components/app/NavLinks";

export const teacherNav = (t: Dict): NavItem[] => [
  { href: "/teach", label: t.teacher.title, icon: "📚" },
  { href: "/account", label: t.app.account, icon: "👤" },
];

export const centerNav = (t: Dict, id: string): NavItem[] => [
  { href: `/center/${id}`, label: t.center.dashboard, icon: "📊", exact: true },
  { href: `/center/${id}/students`, label: t.center.students, icon: "🎒" },
  { href: `/center/${id}/teachers`, label: t.center.teachers, icon: "👩🏾‍🏫" },
  { href: `/center/${id}/classes`, label: t.center.classes, icon: "🏫" },
  { href: `/center/${id}/programs`, label: t.center.programs, icon: "🗂️" },
  { href: `/center/${id}/team`, label: t.center.team, icon: "🤝" },
  { href: `/center/${id}/settings`, label: t.center.settings, icon: "⚙️" },
  { href: `/center/${id}/audit`, label: t.center.audit, icon: "🧾" },
];

export const adminNav = (t: Dict): NavItem[] => [
  { href: "/admin", label: t.admin.overview, icon: "📊", exact: true },
  { href: "/admin/users", label: t.admin.users, icon: "👥" },
  { href: "/admin/centers", label: t.admin.centers, icon: "🏫" },
  { href: "/admin/countries", label: t.admin.countries, icon: "🌍" },
  { href: "/admin/plans", label: t.admin.plans, icon: "💳" },
  { href: "/admin/leads", label: t.admin.leads, icon: "✉️" },
  { href: "/admin/admins", label: t.admin.admins, icon: "🛡️" },
  { href: "/admin/audit", label: t.admin.audit, icon: "🧾" },
];
