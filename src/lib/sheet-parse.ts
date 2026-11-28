/**
 * Lecture de tableaux côté navigateur : CSV / TSV / copier-coller Excel, et fichiers .xlsx.
 * Renvoie une grille de chaînes (première ligne = intitulés si présents).
 */
import { unzipSync, strFromU8 } from "fflate";

export type Grid = string[][];

function detectDelimiter(sample: string) {
  const first = sample.split(/\r?\n/).slice(0, 5).join("\n");
  const counts: [string, number][] = [["\t", 0], [";", 0], [",", 0]];
  for (const c of counts) c[1] = first.split(c[0]).length - 1;
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** CSV/TSV avec guillemets ("a;b", "dit ""oui"""), séparateur détecté automatiquement. */
export function parseDelimited(text: string): Grid {
  const t = text.replace(/^﻿/, "");
  const d = detectDelimiter(t);
  const rows: Grid = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === d) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return clean(rows);
}

function colIndex(ref: string) {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const c of letters) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/** Première feuille d'un classeur Excel (.xlsx). */
export function parseXlsx(buf: ArrayBuffer): Grid {
  const files = unzipSync(new Uint8Array(buf));
  const read = (p: string) => (files[p] ? strFromU8(files[p]) : "");
  const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");

  const shared: string[] = [];
  const ss = read("xl/sharedStrings.xml");
  if (ss) for (const si of Array.from(xml(ss).getElementsByTagName("si"))) {
    shared.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""));
  }

  // Feuille : la première déclarée dans le classeur
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = read("xl/workbook.xml"), rels = read("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const first = xml(wb).getElementsByTagName("sheet")[0];
    const rid = first?.getAttribute("r:id") ?? first?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const rel = Array.from(xml(rels).getElementsByTagName("Relationship")).find((r) => r.getAttribute("Id") === rid);
    const target = rel?.getAttribute("Target");
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  }
  const sheet = read(sheetPath);
  if (!sheet) throw new Error("Feuille Excel introuvable");

  const grid: Grid = [];
  for (const r of Array.from(xml(sheet).getElementsByTagName("row"))) {
    const out: string[] = [];
    for (const c of Array.from(r.getElementsByTagName("c"))) {
      const idx = colIndex(c.getAttribute("r") ?? "A");
      const type = c.getAttribute("t");
      let v = "";
      if (type === "inlineStr") v = Array.from(c.getElementsByTagName("t")).map((t) => t.textContent ?? "").join("");
      else {
        const raw = c.getElementsByTagName("v")[0]?.textContent ?? "";
        v = type === "s" ? shared[Number(raw)] ?? "" : type === "b" ? (raw === "1" ? "oui" : "non") : raw;
        // Nombres : éviter 12.300000000000001
        if (!type && /^-?\d+\.\d{9,}$/.test(v)) v = String(Number(Number(v).toFixed(6)));
      }
      out[idx] = v;
    }
    grid.push(Array.from(out, (x) => x ?? ""));
  }
  return clean(grid);
}

/** Retire les lignes vides et les espaces superflus ; égalise la largeur. */
function clean(rows: Grid): Grid {
  const kept = rows.map((r) => r.map((c) => (c ?? "").trim())).filter((r) => r.some((c) => c !== ""));
  const width = Math.max(0, ...kept.map((r) => r.length));
  return kept.map((r) => [...r, ...Array(width - r.length).fill("")]);
}

export async function parseFile(file: File): Promise<Grid> {
  if (/\.xlsx$/i.test(file.name)) return parseXlsx(await file.arrayBuffer());
  if (/\.xls$/i.test(file.name)) throw new Error("Ancien format Excel (.xls) : dans Excel, faites « Enregistrer sous » → « Classeur Excel (.xlsx) » ou CSV.");
  const buf = await file.arrayBuffer();
  let text = new TextDecoder("utf-8").decode(buf);
  if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf); // CSV Excel français
  return parseDelimited(text);
}

/** Modèle CSV (séparateur « ; », compatible Excel en français). */
export function templateCsv(headers: string[], examples: string[][]) {
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return "﻿" + [headers, ...examples].map((r) => r.map(esc).join(";")).join("\r\n");
}
