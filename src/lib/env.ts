function req(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

/** Variable serveur ; accepte aussi le nom en minuscules (saisie fréquente dans le tableau de bord Vercel). */
function secret(name: string): string | undefined {
  return process.env[name] || process.env[name.toLowerCase()] || undefined;
}

export const env = {
  supabaseUrl: () => req("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => req("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  serviceRoleKey: () => secret("SUPABASE_SERVICE_ROLE_KEY"),
  appUrl: () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  anthropicKey: () => secret("ANTHROPIC_API_KEY"),
  pawapayUrl: () => secret("PAWAPAY_API_URL") || "https://api.sandbox.pawapay.io",
  pawapayToken: () => secret("PAWAPAY_API_TOKEN"),
  cronSecret: () => secret("CRON_SECRET"),
  twilio: () => ({
    sid: secret("TWILIO_ACCOUNT_SID"), token: secret("TWILIO_AUTH_TOKEN"),
    smsFrom: secret("TWILIO_SMS_FROM"), waFrom: secret("TWILIO_WHATSAPP_FROM"),
  }),
};
