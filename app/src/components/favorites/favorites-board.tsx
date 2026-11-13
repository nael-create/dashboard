"use client";

import { Archive, ExternalLink, FolderKanban, GraduationCap, Mail, Newspaper, Pencil, Search, StickyNote, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, isConflict } from "@/lib/client-api";
import { fold } from "@/lib/slug";
import { formatISODate } from "@/lib/dates";
import { btnGhost, btnPrimary, chip, field, iconBtn } from "@/components/ui/forms";
import { Notice } from "@/components/ui/notice";
import { FAVORITES_CHANGED, StarButton } from "./favorites-context";

type FavType = "article" | "newsletter" | "notion" | "memo" | "project";
interface Fav {
  id: string; added: string; title: string; type: FavType; ref: string; source: string;
  published: string | null; note: string; href: string | null; external: boolean; missing: boolean; archived: boolean;
}

const TYPES: { id: FavType; label: string; icon: typeof Newspaper }[] = [
  { id: "article", label: "Articles", icon: Newspaper },
  { id: "newsletter", label: "Newsletters", icon: Mail },
  { id: "notion", label: "Notions", icon: GraduationCap },
  { id: "memo", label: "Mémos", icon: StickyNote },
  { id: "project", label: "Projets", icon: FolderKanban },
];

export function FavoritesBoard() {
  const [favs, setFavs] = useState<Fav[] | null>(null);
  const [version, setVersion] = useState("");
  const [type, setType] = useState<FavType | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; conflict: boolean } | null>(null);

  const load = useCallback(async () => {
    const d = await apiJson<{ favorites: Fav[]; version: string }>("/api/favorites");
    setFavs(d.favorites);
    setVersion(d.version);
  }, []);

  useEffect(() => {
    load().catch((e) => setError({ text: String(e.message ?? e), conflict: false }));
    window.addEventListener(FAVORITES_CHANGED, load);
    return () => window.removeEventListener(FAVORITES_CHANGED, load);
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
      window.dispatchEvent(new Event(FAVORITES_CHANGED));
      return true;
    } catch (e) {
      setError({ text: e instanceof Error ? e.message : String(e), conflict: isConflict(e) });
      return false;
    }
  };

  const shown = useMemo(() => {
    const query = fold(q.trim());
    return (favs ?? [])
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => (!type || f.type === type) && (!query || fold(`${f.title} ${f.source} ${f.note}`).includes(query)))
      .sort((a, b) => b.f.added.localeCompare(a.f.added) || a.i - b.i) // plus récents d'abord
      .map(({ f }) => f);
  }, [favs, type, q]);

  const counts = useMemo(() => new Map(TYPES.map((t) => [t.id, (favs ?? []).filter((f) => f.type === t.id).length])), [favs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-auto sm:min-w-0 sm:flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" aria-label="Rechercher dans les favoris" className={`${field} pl-9`} />
        </label>
        <button type="button" aria-pressed={type === null} onClick={() => setType(null)} className={chip(type === null)}>Tous</button>
        {TYPES.map((t) => (
          <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(type === t.id ? null : t.id)} className={chip(type === t.id)}>
            {t.label} <span className="opacity-70">{counts.get(t.id) ?? 0}</span>
          </button>
        ))}
      </div>

      {error && (
        <Notice action={error.conflict ? <button type="button" className="text-sm font-medium underline" onClick={() => { setError(null); load(); }}>Recharger</button> : undefined}>
          {error.text}
        </Notice>
      )}

      {!favs ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          {favs.length ? "Aucun favori ne correspond." : "Aucun favori pour l'instant. Clique sur l'étoile d'un article, d'une newsletter, d'une notion, d'un mémo ou d'un projet."}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {shown.map((f) => {
            const T = TYPES.find((t) => t.id === f.type)!;
            const label = TYPES.find((t) => t.id === f.type)!.label.replace(/s$/, "");
            return (
              <li key={f.id} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted" title={label}><T.icon className="size-4" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  {f.missing ? (
                    <p className="font-medium text-muted line-through">{f.title}</p>
                  ) : f.href ? (
                    f.external ? (
                      <a href={f.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 font-medium hover:text-accent-text">
                        {f.title} <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted" aria-hidden />
                      </a>
                    ) : (
                      <Link href={f.href} className="font-medium hover:text-accent-text">{f.title}</Link>
                    )
                  ) : (
                    <p className="font-medium">{f.title}</p>
                  )}
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <span>{label}</span>
                    {f.source && <><span aria-hidden>·</span><span>{f.source}</span></>}
                    {f.published && <><span aria-hidden>·</span><span>{formatISODate(f.published)}</span></>}
                    <span aria-hidden>·</span><span>ajouté le {formatISODate(f.added)}</span>
                    {f.missing && <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-700 dark:text-rose-300">Élément supprimé</span>}
                    {f.archived && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5"><Archive className="size-3" aria-hidden /> Archivé</span>}
                  </p>
                  {editing === f.id ? (
                    <NoteForm initial={f.note} onCancel={() => setEditing(null)}
                      onSave={async (note) => { if (await run(() => apiJson(`/api/favorites/${encodeURIComponent(f.id)}`, "PATCH", { version, note }))) setEditing(null); }} />
                  ) : f.note ? (
                    <button type="button" onClick={() => setEditing(f.id)} className="mt-1.5 block text-left text-sm italic text-text/80 hover:text-text">« {f.note} »</button>
                  ) : (
                    <button type="button" onClick={() => setEditing(f.id)} className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-accent-text">
                      <Pencil className="size-3" aria-hidden /> Ajouter une note
                    </button>
                  )}
                </div>
                {f.missing || f.archived ? (
                  <button type="button" className={`${iconBtn} hover:text-rose-600`} aria-label={`Retirer « ${f.title} » des favoris`} title="Retirer des favoris"
                    onClick={() => run(() => apiJson(`/api/favorites/${encodeURIComponent(f.id)}?version=${version}`, "DELETE"))}>
                    <Trash2 className="size-4" />
                  </button>
                ) : (
                  <StarButton type={f.type} refId={f.ref} title={f.title} source={f.source} published={f.published} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NoteForm({ initial, onSave, onCancel }: { initial: string; onSave: (n: string) => Promise<void>; onCancel: () => void }) {
  const [note, setNote] = useState(initial);
  return (
    <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); onSave(note); }}>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} autoFocus placeholder="Note personnelle (courte)" aria-label="Note personnelle"
        onKeyDown={(e) => e.key === "Escape" && onCancel()} className={`${field} min-w-0 flex-1 py-1.5`} />
      <button type="submit" className={btnPrimary}>Enregistrer</button>
      <button type="button" className={btnGhost} onClick={onCancel}>Annuler</button>
    </form>
  );
}
