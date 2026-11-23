"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Item = { id: string; name: string; description: string | null; price: number; currency: string };
export type MenuData = { establishment: string; table: string; phone: string | null; ordering_enabled: boolean; categories: { id: string; name: string; items: Item[] }[]; uncategorized: Item[] };

const fmt = (n: number, c: string) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: c === "CDF" ? 0 : 2 }).format(n)} ${c === "USD" ? "$" : "FC"}`;

export function PublicMenu({ token, menu }: { token: string; menu: MenuData }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [state, setState] = useState<{ ok?: string; error?: string; sending?: boolean }>({});
  const all = useMemo(() => [...menu.categories.flatMap((c) => c.items), ...menu.uncategorized], [menu]);
  const lines = Object.entries(cart).filter(([, q]) => q > 0).map(([id, q]) => ({ item: all.find((i) => i.id === id)!, q }));
  const total = lines.reduce((a, l) => a + l.item.price * l.q, 0);
  const cur = lines[0]?.item.currency ?? "USD";
  const groups = [...menu.categories.filter((c) => c.items.length), ...(menu.uncategorized.length ? [{ id: "x", name: "Autres", items: menu.uncategorized }] : [])];

  async function send() {
    setState({ sending: true });
    const supabase = createClient();
    const { data, error } = await supabase.rpc("public_place_order", {
      p_token: token, p_items: lines.map((l) => ({ menu_item_id: l.item.id, quantity: l.q })), p_customer_name: name || null, p_notes: null,
    });
    if (error) setState({ error: error.message });
    else { setCart({}); setState({ ok: `Commande n° ${(data as { number: string }).number} envoyée ! Un serveur arrive.` }); }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-white pb-40">
      <header className="bg-navy-900 px-5 py-6 text-white">
        <div className="text-xs uppercase tracking-widest text-gold-400">Table {menu.table}</div>
        <h1 className="text-2xl font-bold">{menu.establishment}</h1>
      </header>
      {state.ok && <div className="m-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{state.ok}</div>}
      {state.error && <div className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
      {groups.map((g) => (
        <section key={g.id} className="px-4 pt-5">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{g.name}</h2>
          <ul className="divide-y divide-slate-100">
            {g.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3">
                <div className="flex-1"><div className="font-semibold">{i.name}</div>{i.description && <div className="text-xs text-slate-500">{i.description}</div>}
                  <div className="text-sm font-bold text-electric-600">{fmt(i.price, i.currency)}</div></div>
                {menu.ordering_enabled && (
                  <div className="flex items-center gap-2">
                    <button aria-label="Retirer" className="h-9 w-9 rounded-full border text-lg" onClick={() => setCart((c) => ({ ...c, [i.id]: Math.max(0, (c[i.id] ?? 0) - 1) }))}>−</button>
                    <span className="w-5 text-center">{cart[i.id] ?? 0}</span>
                    <button aria-label="Ajouter" className="h-9 w-9 rounded-full bg-navy-900 text-lg text-white" onClick={() => setCart((c) => ({ ...c, [i.id]: Math.min(50, (c[i.id] ?? 0) + 1) }))}>+</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-lg border-t bg-white p-4 shadow-2xl">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre prénom (facultatif)" className="input mb-2" />
          <button disabled={state.sending} onClick={send} className="btn-gold w-full py-3 text-base">Commander · {fmt(total, cur)}</button>
        </div>
      )}
      <footer className="p-6 text-center text-xs text-slate-400">Propulsé par OSTAPAUL MANAGER</footer>
    </main>
  );
}
