import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_BUCKET = "tenant-files";

export const PHOTO_TABLES = {
  employee: { table: "employees", perm: "hr.write" },
  student: { table: "students", perm: "academic.write" },
  teacher: { table: "teachers", perm: "academic.write" },
} as const;
export type PhotoPersonType = keyof typeof PHOTO_TABLES;

/** Liens temporaires (1 h) vers des photos privées ; respecte les droits de lecture de l'utilisateur. */
export async function signPhotos(supabase: SupabaseClient, paths: (string | null | undefined)[]) {
  const list = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const map = new Map<string, string>();
  if (!list.length) return map;
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(list, 3600);
  for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  return map;
}

/** Vérifie qu'un fichier est bien une image JPEG (la photo est recadrée en JPEG dans le navigateur). */
export async function isJpeg(file: File) {
  const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}
