"use client";

import { Lock, Pencil, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiJson, isConflict } from "@/lib/client-api";
import { btnDanger, btnGhost, btnPrimary, chip, field, iconBtn } from "@/components/ui/forms";
import { Notice } from "@/components/ui/notice";
import { formatISODate } from "@/lib/dates";
import { StarButton } from "@/components/favorites/favorites-context";

export interface MemoItem {
  key: string;
  id: string | null;
  date: string;
  title: string;
  pinned: boolean;
  tags: string[];
  text: string;
}

interface Draft { title: string; text: string; tags: string; pinned: boolean }
const emptyDraft: Draft = { title: "", text: "", tags: "", pinned: false };
const toTags = (s: string) => s.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean);

/** Rappel affiché près de chaque zone de saisie. */
export function SecretReminder() {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted">
      <Lock className="mt-px size-3.5 shrink-0" aria-hidden />
      Pas de mots de passe, codes d&apos;accès ni numéros de carte : MEMO.md est publié sur GitHub.
    </p>
  );
}

function MemoForm({
  initial, submitLabel, onSubmit, onCancel,
}: { initial: Draft; submitLabel: string; onSubmit: (d: Draft) => Promise<boolean>; onCancel?: () => void }) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  // Arrivée depuis la palette (« Nouveau mémo ») : titre pré-rempli et focus.
  useEffect(() => {
    if (onCancel) return;
    const sp = new URLSearchParams(window.location.search);
    if (!sp.has("nouveau")) return;
    const t = sp.get("titre");
    if (t) setD((x) => ({ ...x, title: t }));
    document.querySelector<HTMLInputElement>('input[aria-label="Titre"]')?.focus();
  }, [onCancel]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onSubmit(d);
    setBusy(false);
    if (ok && !onCancel) setD(emptyDraft);
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })}
        placeholder="Titre court" required maxLength={120} aria-label="Titre" className={`${field} font-medium`}
      />
      <textarea
        value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })}
        placeholder="À retenir… (Markdown accepté)" rows={3} aria-label="Texte" className={`${field} resize-y`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={d.tags} onChange={(e) => setD({ ...d, tags: e.target.value })}
          placeholder="Tags, séparés par des virgules" aria-label="Tags" className={`${field} min-w-0 flex-1 sm:max-w-xs`}
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={d.pinned} onChange={(e) => setD({ ...d, pinned: e.target.checked })} className="size-4 accent-[var(--accent)]" />
          Épingler
        </label>
        <div className="ml-auto flex gap-2">
          {onCancel && <button type="button" onClick={onCancel} className={btnGhost}>Annuler</button>}
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Enregistrement…" : submitLabel}</button>
        </div>
      </div>
      <SecretReminder />
    </form>
  );
}

export function MemoBoard({ initial, initialVersion }: { initial: MemoItem[]; initialVersion: string }) {
  const [entries, setEntries] = useState(initial);
  const [version, setVersion] = useState(initialVersion);
  const [error, setError] = useState<{ text: string; conflict: boolean } | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await apiJson<{ entries: MemoItem[]; version: string }>("/api/memo");
    setEntries(data.entries);
    setVersion(data.version);
  }, []);

  /** Exécute une modification puis relit le fichier ; affiche les erreurs sans rien perdre. */
  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setError(null);
    try {
      await fn();
      await reload();
      return true;
    } catch (e) {
      setError({ text: e instanceof Error ? e.message : String(e), conflict: isConflict(e) });
      return false;
    }
  };

  const allTags = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) for (const t of e.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [entries]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...entries]
      .filter((e) => (!tag || e.tags.includes(tag)) && (!pinnedOnly || e.pinned))
      .filter((e) => !q || `${e.title} ${e.text} ${e.tags.join(" ")}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date));
  }, [entries, tag, pinnedOnly, query]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Plus className="size-4 text-accent-text" aria-hidden /> Nouveau mémo
        </h2>
        <MemoForm
          initial={emptyDraft}
          submitLabel="Ajouter"
          onSubmit={(d) => run(() => apiJson("/api/memo", "POST", { version, title: d.title, text: d.text, tags: toTags(d.tags), pinned: d.pinned }))}
        />
      </section>

      {error && (
        <Notice action={error.conflict ? <button type="button" onClick={() => { setError(null); reload(); }} className="text-sm font-medium underline">Recharger</button> : undefined}>
          {error.text}
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-auto sm:min-w-0 sm:flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" aria-label="Rechercher dans le mémo" className={`${field} pl-9`} />
        </label>
        <button type="button" onClick={() => setPinnedOnly(!pinnedOnly)} className={chip(pinnedOnly)} aria-pressed={pinnedOnly}>Épinglés</button>
        <button type="button" onClick={() => setTag(null)} className={chip(tag === null)} aria-pressed={tag === null}>Tous</button>
        {allTags.map(([t, n]) => (
          <button key={t} type="button" onClick={() => setTag(tag === t ? null : t)} className={chip(tag === t)} aria-pressed={tag === t}>
            #{t} <span className="opacity-70">{n}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {entries.length ? "Aucun mémo ne correspond à ces filtres." : "Aucun mémo pour l'instant."}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((e) => (
            <li key={e.key} id={`memo-${e.id ?? e.key}`} className={`scroll-mt-24 rounded-2xl border bg-surface p-4 transition-colors sm:p-5 ${e.pinned ? "border-accent/50" : "border-border"}`}>
              {editing === e.key ? (
                <MemoForm
                  initial={{ title: e.title, text: e.text, tags: e.tags.join(", "), pinned: e.pinned }}
                  submitLabel="Enregistrer"
                  onCancel={() => setEditing(null)}
                  onSubmit={async (d) => {
                    const ok = await run(() =>
                      apiJson(`/api/memo/${encodeURIComponent(e.key)}`, "PATCH", { version, title: d.title, text: d.text, tags: toTags(d.tags), pinned: d.pinned }),
                    );
                    if (ok) setEditing(null);
                    return ok;
                  }}
                />
              ) : (
                <>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium leading-snug">{e.title}</h3>
                      <p className="text-xs text-muted">{formatISODate(e.date)}</p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <StarButton type="memo" refId={`memo:${e.id ?? e.key}`} title={e.title} source={e.tags.join(", ")} />
                      <button
                        type="button" className={`${iconBtn} ${e.pinned ? "text-accent-text" : ""}`}
                        aria-label={e.pinned ? "Désépingler" : "Épingler"} title={e.pinned ? "Désépingler" : "Épingler"}
                        onClick={() => run(() => apiJson(`/api/memo/${encodeURIComponent(e.key)}`, "PATCH", { version, pinned: !e.pinned }))}
                      >
                        {e.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                      </button>
                      <button type="button" className={iconBtn} aria-label="Modifier" title="Modifier" onClick={() => setEditing(e.key)}>
                        <Pencil className="size-4" />
                      </button>
                      <button type="button" className={`${iconBtn} hover:text-rose-600`} aria-label="Supprimer" title="Supprimer" onClick={() => setConfirming(e.key)}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  {e.text && (
                    <div className="md text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{e.text}</ReactMarkdown>
                    </div>
                  )}
                  {e.tags.length > 0 && (
                    <p className="mt-3 flex flex-wrap gap-1.5">
                      {e.tags.map((t) => (
                        <button key={t} type="button" onClick={() => setTag(t)} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted hover:text-text">#{t}</button>
                      ))}
                    </p>
                  )}
                  {confirming === e.key && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-sm">
                      <span className="flex-1">Supprimer « {e.title} » de MEMO.md ?</span>
                      <button type="button" className={btnDanger} onClick={async () => { if (await run(() => apiJson(`/api/memo/${encodeURIComponent(e.key)}?version=${version}`, "DELETE"))) setConfirming(null); }}>Supprimer</button>
                      <button type="button" className={btnGhost} onClick={() => setConfirming(null)}>Annuler</button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
