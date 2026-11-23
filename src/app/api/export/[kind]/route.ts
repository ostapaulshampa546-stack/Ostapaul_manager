import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/context";
import { getResource } from "@/lib/resources";

function csv(rows: Record<string, unknown>[], columns?: string[]) {
  const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // protection contre l'injection de formules
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\r\n");
}

/** Export Excel (CSV UTF-8, séparateur « ; ») — formule Standard+. Les données passent par la RLS de l'utilisateur. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenant") ?? "";
  const ctx = await getTenantContext(tenantId);
  if (!ctx.has("export")) return NextResponse.json({ error: "Export réservé aux formules Standard et Premium" }, { status: 403 });
  const supabase = await createClient();
  let rows: Record<string, unknown>[] = [];
  let cols: string[] | undefined;
  if (kind === "finance") {
    const { data, error } = await supabase.rpc("finance_report", { p_tenant: tenantId, p_from: url.searchParams.get("from"), p_to: url.searchParams.get("to"), p_granularity: url.searchParams.get("g") ?? "day" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    rows = data ?? [];
  } else if (kind === "attendance") {
    const { data } = await supabase.from("attendance").select("attendance_date, scanned_at, person_type, person_id, event_type, status, source").eq("tenant_id", tenantId).eq("attendance_date", url.searchParams.get("date") ?? "").limit(10000);
    rows = data ?? [];
  } else if (kind === "student_balances") {
    const { data } = await supabase.from("student_balances").select("matricule, full_name, guardian_name, guardian_phone, currency, total_due, total_paid, balance, overdue").eq("tenant_id", tenantId).limit(10000);
    rows = data ?? [];
  } else if (kind === "payments") {
    const { data } = await supabase.from("payments").select("reference, receipt_number, created_at, paid_at, payable_type, amount, currency, method, status, payer_name, payer_phone").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(10000);
    rows = data ?? [];
  } else {
    const res = getResource(kind);
    if (!res || (res.readPerm && !ctx.can(res.readPerm) && !ctx.can(res.writePerm))) return NextResponse.json({ error: "Export inconnu" }, { status: 404 });
    cols = res.fields.map((f) => f.name);
    const { data } = await supabase.from(res.table).select(cols.join(",")).eq("tenant_id", tenantId).limit(10000);
    rows = (data ?? []) as unknown as Record<string, unknown>[];
  }
  return new NextResponse(csv(rows, cols), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ostapaul-${kind}-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
