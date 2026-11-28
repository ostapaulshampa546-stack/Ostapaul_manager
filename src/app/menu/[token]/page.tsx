import { createClient } from "@/lib/supabase/server";
import { PublicMenu, type MenuData } from "@/app/m/[token]/PublicMenu";

export const metadata = { title: "Menu", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Menu public de tout le restaurant (QR à l'entrée, sur les flyers, WhatsApp…). Consultation seule. */
export default async function RestaurantMenu({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_restaurant_menu", { p_token: token });
  if (!data) return <main className="p-8 text-center">Menu introuvable ou momentanément indisponible.</main>;
  return <PublicMenu token="" menu={data as MenuData} />;
}
