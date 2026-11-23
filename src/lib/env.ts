function req(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export const env = {
  supabaseUrl: () => req("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => req("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  serviceRoleKey: () => process.env.SUPABASE_SERVICE_ROLE_KEY,
  appUrl: () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  anthropicKey: () => process.env.ANTHROPIC_API_KEY,
  pawapayUrl: () => process.env.PAWAPAY_API_URL || "https://api.sandbox.pawapay.io",
  pawapayToken: () => process.env.PAWAPAY_API_TOKEN,
  cronSecret: () => process.env.CRON_SECRET,
};
