import { createClient } from "@/lib/supabase/server";
import { PublicMenu, type MenuData } from "./PublicMenu";

export const metadata = { title: "Menu", robots: { index: false } };

export default async function MenuPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_table_menu", { p_token: token });
  if (!data) return <main className="p-8 text-center">QR code invalide.</main>;
  return <PublicMenu token={token} menu={data as MenuData} />;
}
