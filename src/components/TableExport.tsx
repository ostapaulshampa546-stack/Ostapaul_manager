"use client";
/** Exporte un tableau HTML (par son id) en fichier CSV lisible par Excel (séparateur « ; »). */
export function TableExport({ tableId, filename, label = "Excel (CSV)" }: { tableId: string; filename: string; label?: string }) {
  const run = () => {
    const table = document.getElementById(tableId);
    if (!table) return;
    const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = Array.from(table.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.querySelectorAll("th,td")).filter((c) => !c.classList.contains("no-export"))
        .map((c) => esc(((c as HTMLElement).dataset.export ?? (c as HTMLElement).innerText).replace(/\s+/g, " ").trim())).join(";"));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return <button type="button" onClick={run} className="btn-ghost no-print">⬇️ {label}</button>;
}
