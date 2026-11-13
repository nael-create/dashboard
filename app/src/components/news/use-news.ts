"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface Article {
  id: string;
  title: string;
  link: string;
  publisher: string;
  sourceId: string;
  date: string | null;
  thumbnail: string | null;
}
export interface NewsWidgetData {
  key: string;
  title: string;
  color: string;
  domain: string;
  sourceIds: string[];
  visible: boolean;
  items: Article[];
}
export interface NewsSourceData {
  id: string;
  name: string;
  category: string;
  color: string;
  enabled: boolean;
  private: boolean;
  host: string;
  domain: string;
}
export interface NewsData {
  mode: "source" | "category";
  version: string;
  sources: NewsSourceData[];
  widgets: NewsWidgetData[];
  latest: Article[];
  errors: { sourceId: string; name: string; message: string; staleSince?: string }[];
  fetchedAt: string;
}

const LAST_SEEN = "dashboard.news.lastSeen";
const AUTO_REFRESH_MS = 5 * 60 * 1000;

/** Données d'actus + rafraîchissement automatique (5 min) + repère « Nouveau » depuis la dernière visite. */
export function useNews() {
  const [data, setData] = useState<NewsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const req = useRef(0);

  const load = useCallback(async (refresh = false) => {
    const id = ++req.current;
    if (refresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/news${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (id !== req.current) return;
      if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
      setData(json);
      setError(null);
    } catch (e) {
      if (id === req.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === req.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(), AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // Dernière visite : lue à l'arrivée, mise à jour en quittant la page (les repères restent visibles pendant la visite).
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(LAST_SEEN));
      setLastSeen(Number.isFinite(v) && v > 0 ? v : null);
    } catch {
      setLastSeen(null);
    }
    const save = () => {
      try {
        localStorage.setItem(LAST_SEEN, String(Date.now()));
      } catch {
        /* stockage indisponible */
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      save();
    };
  }, []);

  const isNew = useCallback(
    (a: Article) => lastSeen !== null && a.date !== null && Date.parse(a.date) > lastSeen,
    [lastSeen],
  );

  return { data, error, refreshing, load, isNew, setData };
}
