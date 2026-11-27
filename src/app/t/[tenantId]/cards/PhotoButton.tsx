"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePhoto, uploadPhoto } from "./actions";

/** Recadre au format photo d'identité (3:4), 480 × 640 px max, JPEG. */
async function toIdPhoto(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const ratio = 3 / 4;
  let sw = bmp.width, sh = bmp.height;
  if (sw / sh > ratio) sw = sh * ratio; else sh = sw / ratio;
  const sx = (bmp.width - sw) / 2, sy = Math.max(0, (bmp.height - sh) / 2.5);
  const W = Math.min(480, Math.round(sw)), H = Math.round(W / ratio);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  c.getContext("2d")!.drawImage(bmp, sx, sy, sw, sh, 0, 0, W, H);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("conversion"))), "image/jpeg", 0.85));
}

export function PhotoButton({ tenantId, type, personId, hasPhoto }: { tenantId: string; type: string; personId: string; hasPhoto: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const onFile = (f?: File) => {
    if (!f) return;
    setErr(null);
    start(async () => {
      try {
        const blob = await toIdPhoto(f);
        const fd = new FormData();
        fd.append("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
        const r = await uploadPhoto(tenantId, type, personId, fd);
        if (!r.ok) setErr(r.error); else router.refresh();
      } catch { setErr("Image illisible. Essayez une autre photo."); }
      if (input.current) input.current.value = "";
    });
  };

  return (
    <div className="no-print mt-1 flex flex-wrap items-center gap-2 text-xs">
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <button type="button" disabled={pending} onClick={() => input.current?.click()} className="btn-ghost btn-sm">
        {pending ? "Envoi…" : hasPhoto ? "📷 Changer la photo" : "📷 Ajouter une photo"}
      </button>
      {hasPhoto && !pending && (
        <button type="button" className="text-slate-500 underline" onClick={() => {
          if (!confirm("Retirer la photo de cette carte ?")) return;
          start(async () => { const r = await deletePhoto(tenantId, type, personId); if (!r.ok) setErr(r.error); else router.refresh(); });
        }}>Retirer</button>
      )}
      {err && <span className="text-red-600">{err}</span>}
    </div>
  );
}
