"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, LayoutGrid, RefreshCw, Settings2 } from "lucide-react";
import { useRef, useState } from "react";
import { apiJson } from "@/lib/client-api";
import { btnGhost, iconBtn } from "@/components/ui/forms";
import { Notice } from "@/components/ui/notice";
import { relativeTime } from "@/lib/relative-time";
import { NewsCard } from "./news-card";
import { StarButton } from "@/components/favorites/favorites-context";
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

  // Les articles sans image vont dans le « Fil » ; un widget qui n'a que ceux-là n'est montré qu'en mode Organiser.
  const pictured = (w: NewsWidgetData) => w.items.filter((a) => !a.noImage);
  const onlyFil = (w: NewsWidgetData) => w.items.length > 0 && pictured(w).length === 0;
  const shown = data ? data.widgets.filter((w) => editing || (w.visible && !onlyFil(w))) : [];
  const sourceOf = new Map(data?.sources.map((s) => [s.id, s]) ?? []);
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
          {[0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse bg-surface-2" />)}
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
                  items={pictured(w).slice(0, 5)}
                  isNew={isNew}
                  error={err ? `Erreur : ${err.message}` : editing && onlyFil(w) ? "Articles sans image : affichés dans le Fil, plus bas." : undefined}
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

      {/* Fil : les articles sans image (ex. Reuters via Google News), en liste compacte. */}
      {data && data.fil.length > 0 && !editing && (
        <section aria-labelledby="fil-titre" className="mt-16">
          <header className="mb-2 flex items-baseline justify-between gap-3 border-t border-text/80 pt-3">
            <h2 id="fil-titre" className="title-md lowercase">fil</h2>
            <p className="label text-muted">Articles sans image · {data.fil.length}</p>
          </header>
          <ol className="divide-y divide-border">
            {data.fil.map((a) => {
              const src = sourceOf.get(a.sourceId);
              return (
                <li key={a.id} className="group grid grid-cols-[1fr_auto] items-start gap-x-3 py-2.5 sm:grid-cols-[4.5rem_9rem_1fr_auto] sm:items-baseline">
                  <span className="label order-2 col-span-2 flex items-center gap-2 text-muted sm:order-none sm:col-span-1">
                    {a.date ? <time dateTime={a.date} suppressHydrationWarning>{relativeTime(a.date)}</time> : "—"}
                    <span className="sm:hidden" aria-hidden>·</span>
                    <span className="flex items-center gap-1.5 truncate sm:hidden">{src?.name ?? a.publisher}</span>
                  </span>
                  <span className="label hidden items-center gap-1.5 truncate text-muted sm:flex">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: src?.color ?? "var(--muted)" }} aria-hidden />
                    <span className="truncate">{src?.name ?? a.publisher}</span>
                  </span>
                  <a href={a.link} target="_blank" rel="noopener noreferrer" className="min-w-0 leading-snug">
                    <span className="link-underline">{a.title}</span>
                    {isNew(a) && <span className="label ml-2 text-accent-text">nouveau</span>}
                  </a>
                  <span className="-my-1">
                    <StarButton type="article" refId={a.link} title={a.title} source={a.publisher} published={a.date?.slice(0, 10) ?? null} />
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {data && <NewsSourcesDialog open={dialog} onClose={() => setDialog(false)} data={data} onChanged={() => load()} />}
    </div>
  );
}
