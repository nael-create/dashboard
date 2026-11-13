"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, LayoutGrid, RefreshCw, Settings2 } from "lucide-react";
import { useRef, useState } from "react";
import { apiJson } from "@/lib/client-api";
import { btnGhost, iconBtn } from "@/components/ui/forms";
import { Notice } from "@/components/ui/notice";
import { relativeTime } from "@/lib/relative-time";
import { NewsCard } from "./news-card";
import { NewsSourcesDialog } from "./news-sources-dialog";
import { useNews, type Article, type NewsWidgetData } from "./use-news";

export function NewsBoard({ renderActions }: { renderActions?: (a: Article) => React.ReactNode }) {
  const { data, error, refreshing, load, isNew, setData } = useNews();
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  // Référence en plus de l'état : les événements de glisser-déposer peuvent arriver avant le rendu suivant.
  const dragRef = useRef<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveOrder = async (widgets: NewsWidgetData[]) => {
    if (!data) return;
    setData({ ...data, widgets }); // retour visuel immédiat
    setSaveError(null);
    try {
      const res = await apiJson<{ version: string }>("/api/news/layout", "PATCH", {
        version: data.version,
        order: widgets.map((w) => ({ key: w.key, visible: w.visible })),
      });
      setData((d) => (d ? { ...d, version: res.version } : d));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      load();
    }
  };

  const move = (from: number, to: number) => {
    if (!data || to < 0 || to >= data.widgets.length || from === to) return;
    const next = [...data.widgets];
    const [w] = next.splice(from, 1);
    next.splice(to, 0, w);
    saveOrder(next);
  };

  const shown = data ? data.widgets.filter((w) => editing || w.visible) : [];
  const errorsBySource = new Map(data?.errors.map((e) => [e.sourceId, e]) ?? []);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {data ? `Mis à jour ${relativeTime(data.fetchedAt)} · rafraîchi automatiquement toutes les 5 min` : "Chargement…"}
        </p>
        <div className="flex flex-wrap gap-1">
          <button type="button" className={btnGhost} onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden /> Rafraîchir
          </button>
          <button type="button" className={btnGhost} aria-pressed={editing} onClick={() => setEditing(!editing)}>
            <LayoutGrid className="size-4" aria-hidden /> {editing ? "Terminer" : "Organiser"}
          </button>
          <button type="button" className={btnGhost} onClick={() => setDialog(true)} disabled={!data}>
            <Settings2 className="size-4" aria-hidden /> Sources
          </button>
        </div>
      </div>

      {error && <div className="mb-4"><Notice>{error}</Notice></div>}
      {saveError && <div className="mb-4"><Notice>{saveError}</Notice></div>}
      {data && data.errors.length > 0 && (
        <ul className="mb-4 space-y-2">
          {data.errors.map((e) => (
            <li key={e.sourceId}>
              <Notice><strong className="font-semibold">« {e.name} »</strong> n&apos;a pas pu être chargé : {e.message}.{e.staleSince && ` Articles du dernier chargement réussi (${e.staleSince}).`}</Notice>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <p className="mb-4 text-sm text-muted">
          Glisse les widgets pour les réordonner (ou utilise ↑ ↓), et l&apos;œil pour les masquer. Tout est enregistré dans NEWS.md.
        </p>
      )}

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-[28px] bg-surface-2" />)}
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          Aucun widget visible. « Organiser » pour en réafficher, ou « Sources » pour en ajouter.
        </p>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((w) => {
            const index = data.widgets.findIndex((x) => x.key === w.key);
            const err = w.sourceIds.map((id) => errorsBySource.get(id)).find(Boolean);
            return (
              <li
                key={w.key}
                draggable={editing}
                onDragStart={(e) => {
                  dragRef.current = w.key;
                  setDragKey(w.key);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", w.key); // requis par Firefox
                }}
                onDragOver={(e) => { if (editing) e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragRef.current ?? e.dataTransfer.getData("text/plain");
                  if (from) move(data.widgets.findIndex((x) => x.key === from), index);
                  dragRef.current = null;
                  setDragKey(null);
                }}
                onDragEnd={() => { dragRef.current = null; setDragKey(null); }}
                className={`transition-opacity ${editing ? "cursor-grab" : ""} ${dragKey === w.key ? "opacity-40" : ""} ${editing && !w.visible ? "opacity-50" : ""}`}
              >
                <NewsCard
                  title={w.title}
                  href={editing ? undefined : `/news/${encodeURIComponent(w.key)}`}
                  domain={w.domain}
                  color={w.color}
                  items={w.items.slice(0, 5)}
                  isNew={isNew}
                  error={err ? `Erreur : ${err.message}` : undefined}
                  renderActions={editing ? undefined : renderActions}
                >
                  {editing && (
                    <span className="flex items-center">
                      <GripVertical className="size-4 text-muted" aria-hidden />
                      <button type="button" className={iconBtn} aria-label={`Monter « ${w.title} »`} onClick={() => move(index, index - 1)}><ArrowUp className="size-4" /></button>
                      <button type="button" className={iconBtn} aria-label={`Descendre « ${w.title} »`} onClick={() => move(index, index + 1)}><ArrowDown className="size-4" /></button>
                      <button type="button" className={iconBtn} aria-label={w.visible ? `Masquer « ${w.title} »` : `Afficher « ${w.title} »`}
                        onClick={() => saveOrder(data.widgets.map((x) => (x.key === w.key ? { ...x, visible: !x.visible } : x)))}>
                        {w.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </button>
                    </span>
                  )}
                </NewsCard>
              </li>
            );
          })}
        </ol>
      )}

      {data && <NewsSourcesDialog open={dialog} onClose={() => setDialog(false)} data={data} onChanged={() => load()} />}
    </div>
  );
}
