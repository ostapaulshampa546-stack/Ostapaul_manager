"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Rafraîchit les données serveur périodiquement (léger, adapté aux connexions faibles). */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) router.refresh(); }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
