"use client";

import { Star } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiJson } from "@/lib/client-api";

type FavType = "article" | "newsletter" | "notion" | "memo" | "project";

interface Ctx {
  has: (type: FavType, ref: string) => boolean;
  toggle: (input: { type: FavType; ref: string; title: string; source?: string; published?: string | null }) => Promise<void>;
  error: string | null;
}

const FavoritesContext = createContext<Ctx | null>(null);
export const FAVORITES_CHANGED = "dashboard:favorites-changed";

/** État des étoiles pour toute l'app (une seule lecture de FAVORIS.md, mise à jour optimiste). */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ keys: string[] }>("/api/favorites");
      setKeys(new Set(d.keys));
    } catch {
      /* les étoiles restent vides */
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(FAVORITES_CHANGED, load);
    return () => window.removeEventListener(FAVORITES_CHANGED, load);
  }, [load]);

  const has = useCallback((type: FavType, ref: string) => keys.has(`${type}|${ref}`), [keys]);

  const toggle: Ctx["toggle"] = useCallback(async (input) => {
    const key = `${input.type}|${input.ref}`;
    const wasOn = keys.has(key);
    setError(null);
    setKeys((k) => {
      const n = new Set(k);
      if (wasOn) n.delete(key);
      else n.add(key);
      return n;
    }); // retour visuel immédiat
    try {
      const res = await apiJson<{ starred: boolean; ref: string }>("/api/favorites/toggle", "POST", input);
      setKeys((k) => {
        const n = new Set(k);
        n.delete(key);
        if (res.starred) n.add(`${input.type}|${res.ref}`);
        return n;
      });
      window.dispatchEvent(new Event(FAVORITES_CHANGED));
    } catch (e) {
      setKeys((k) => {
        const n = new Set(k);
        if (wasOn) n.add(key);
        else n.delete(key);
        return n;
      });
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [keys]);

  return <FavoritesContext.Provider value={{ has, toggle, error }}>{children}</FavoritesContext.Provider>;
}

/** Étoile « Favori » : un clic ajoute / retire, avec retour visuel immédiat. */
export function StarButton({
  type, refId, title, source, published, className = "",
}: { type: FavType; refId: string; title: string; source?: string; published?: string | null; className?: string }) {
  const ctx = useContext(FavoritesContext);
  if (!ctx) return null;
  const on = ctx.has(type, refId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Retirer « ${title} » des favoris` : `Ajouter « ${title} » aux favoris`}
      title={on ? "Retirer des favoris" : "Ajouter aux favoris"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        ctx.toggle({ type, ref: refId, title, source, published });
      }}
      className={`grid size-8 shrink-0 place-items-center rounded-full transition-all hover:bg-surface-2 active:scale-90 ${on ? "text-amber-500" : "text-muted hover:text-text"} ${className}`}
    >
      <Star className={`size-4 transition-transform ${on ? "scale-110 fill-current" : ""}`} aria-hidden />
    </button>
  );
}
