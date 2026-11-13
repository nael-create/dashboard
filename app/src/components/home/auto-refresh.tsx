"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Rafraîchit les données serveur de la page toutes les N minutes (flux mis en cache côté serveur). */
export function AutoRefresh({ minutes }: { minutes: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), minutes * 60_000);
    return () => clearInterval(t);
  }, [router, minutes]);
  return null;
}
