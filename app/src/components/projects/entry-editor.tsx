"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Pencil, Plus, X } from "lucide-react";
import { useCallback, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiJson, isConflict } from "@/lib/client-api";
import { btnDanger, btnGhost, btnPrimary, field, iconBtn } from "@/components/ui/forms";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Notice } from "@/components/ui/notice";
import { formatISODate } from "@/lib/dates";
import { StarButton } from "@/components/favorites/favorites-context";

export interface Editable {
  kind: "project" | "area";
  slug: string;
  version: string;
  fields: Record<string, string>;
  sections: Record<string, string>;
  actions: { text: string; done: boolean }[];
  journal: { date: string; text: string }[];
  body: string;
}

const STATUSES: [string, string][] = [["idea", "Idée"], ["active", "Actif"], ["paused", "En pause"], ["done", "Terminé"], ["dropped", "Abandonné"]];
const PRIORITIES = ["P1", "P2", "P3"];
const KNOWN = new Set(["Objectif", "Prochaines actions", "Notes", "Liens", "Journal", "Rôle", "Standards à maintenir"]);
const isTodo = (v?: string) => !v || v.trim() === "TODO: fill in";

type Change = Record<string, unknown> & { op: string };

export function EntryEditor({ initial, star }: { initial: Editable; star?: ReactNode }) {
  const router = useRouter();
  const [e, setE] = useState(initial);
  const [error, setError] = useState<{ text: string; conflict: boolean } | null>(null);
  const [archiveAsk, setArchiveAsk] = useState<string | null>(null);
  const isProject = e.kind === "project";
  const base = `/api/entries/${e.kind}/${e.slug}`;

  // Version du fichier la plus récente connue (mise à jour dès la réponse, sans attendre le rechargement).
  const versionRef = useRef(initial.version);
  const reload = useCallback(async () => {
    const fresh = await apiJson<Editable>(base);
    versionRef.current = fresh.version;
    setE(fresh);
  }, [base]);

  const change = async (c: Change, confirmArchive = false): Promise<boolean> => {
    setError(null);
    try {
      const res = await apiJson<{ version: string; archivedTo: string | null }>(base, "PATCH", { version: versionRef.current, change: c, confirmArchive });
      versionRef.current = res.version;
      if (res.archivedTo) {
        router.push(`/projets?archive=${encodeURIComponent(res.archivedTo)}`);
        router.refresh();
        return true;
      }
      await reload();
      return true;
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : String(err), conflict: isConflict(err) });
      return false;
    }
  };
  const setFields = (fields: Record<string, string>) => change({ op: "fields", fields });

  const extra = extraSections(e.body);

  return (
    <article>
      <Link href="/projets" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent-text">
        <ArrowLeft className="size-4" aria-hidden /> Projets et domaines
      </Link>
      {error && (
        <div className="mb-4">
          <Notice action={error.conflict ? <button type="button" className="text-sm font-medium underline" onClick={() => { setError(null); reload(); }}>Recharger</button> : undefined}>
            {error.text}
          </Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="rise min-w-0 space-y-10 border-t border-text/80 pt-5">
          <div>
            <p className="mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted">
              {isProject ? "Projet" : "Domaine"}
              {star ?? (isProject && <StarButton type="project" refId={`project:${e.slug}`} title={e.fields.title || e.slug} />)}
            </p>
            <InlineText
              value={e.fields.title ?? ""}
              label="Titre"
              className="text-[clamp(2.25rem,5.5vw,4.5rem)] font-light leading-[1] tracking-[-0.04em]"
              onSave={(v) => setFields({ title: v })}
            />
          </div>

          {(isProject ? ["Objectif"] : ["Rôle", "Standards à maintenir"]).map((name) => (
            <SectionEditor key={name} name={name} text={e.sections[name] ?? ""} onSave={(t) => change({ op: "section", name, text: t })} />
          ))}

          {isProject && <Actions items={e.actions} change={change} />}

          {(isProject ? ["Notes", "Liens"] : ["Notes"]).map((name) => (
            <SectionEditor key={name} name={name} text={e.sections[name] ?? ""} onSave={(t) => change({ op: "section", name, text: t })} />
          ))}

          {isProject && <Journal entries={e.journal} change={change} />}

          {extra.map(([name, text]) => (
            <section key={name}>
              <h2 className="mb-3 border-b border-border pb-2 title-md lowercase">{name}</h2>
              <div className="md text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{text}</ReactMarkdown></div>
              <p className="mt-1 text-xs text-muted">Section ajoutée à la main : modifiable dans le fichier.</p>
            </section>
          ))}
        </div>

        <aside className="h-fit space-y-4 border-t border-text/80 pt-5 lg:sticky lg:top-28">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Statut</span>
            <select
              value={e.fields.status ?? ""}
              onChange={(ev) => {
                const v = ev.target.value;
                if (isProject && (v === "done" || v === "dropped")) setArchiveAsk(v);
                else setFields({ status: v });
              }}
              className={field}
            >
              {!STATUSES.some(([v]) => v === e.fields.status) && <option value={e.fields.status ?? ""}>{e.fields.status || "—"}</option>}
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {archiveAsk && (
            <div className="rounded-xl bg-amber-500/10 p-3 text-sm">
              <p className="mb-2">
                Marquer ce projet « {archiveAsk === "done" ? "Terminé" : "Abandonné"} » : son dossier sera déplacé tel quel dans <code>archive/</code> et il disparaîtra des tableaux. Continuer ?
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" className={btnGhost} onClick={() => setArchiveAsk(null)}>Annuler</button>
                <button type="button" className={btnDanger} onClick={async () => { await change({ op: "fields", fields: { status: archiveAsk } }, true); setArchiveAsk(null); }}>
                  Archiver
                </button>
              </div>
            </div>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Priorité</span>
            <select value={e.fields.priority ?? ""} onChange={(ev) => setFields({ priority: ev.target.value })} className={field}>
              {!PRIORITIES.includes(e.fields.priority ?? "") && <option value={e.fields.priority ?? ""}>{e.fields.priority || "—"}</option>}
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          {isProject && (
            <>
              <div className="text-sm">
                <span className="mb-1 block text-muted">Prochaine action</span>
                <InlineText value={e.fields.next_action ?? ""} label="Prochaine action" boxed onSave={(v) => setFields({ next_action: v })} />
              </div>
              <label className="block text-sm">
                <span className="mb-1 flex items-center justify-between text-muted">
                  Deadline
                  {e.fields.deadline && <button type="button" className="text-xs underline-offset-2 hover:underline" onClick={() => setFields({ deadline: "" })}>Effacer</button>}
                </span>
                <input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(e.fields.deadline ?? "") ? e.fields.deadline : ""}
                  onChange={(ev) => setFields({ deadline: ev.target.value })} className={field} />
              </label>
            </>
          )}
          <dl className="space-y-1 border-t border-border pt-3 text-xs text-muted">
            <div className="flex justify-between"><dt>Créé le</dt><dd>{formatISODate(e.fields.created ?? null) || "—"}</dd></div>
            <div className="flex justify-between"><dt>Mis à jour le</dt><dd>{formatISODate(e.fields.updated ?? null) || "—"}</dd></div>
          </dl>
          <p className="text-xs text-muted">Source : <code className="break-all">{isProject ? "projects" : "areas"}/{e.slug}/README.md</code></p>
        </aside>
      </div>
    </article>
  );
}

/** Champ d'une ligne modifiable sur place (Entrée ou sortie du champ pour enregistrer). */
function InlineText({
  value, label, onSave, className = "", boxed = false,
}: { value: string; label: string; onSave: (v: string) => Promise<boolean>; className?: string; boxed?: boolean }) {
  const [v, setV] = useState(isTodo(value) ? "" : value);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setV(isTodo(value) ? "" : value);
  }
  const commit = () => {
    const next = v.trim();
    const current = isTodo(value) ? "" : value;
    if (next !== current) onSave(next || "TODO: fill in");
  };
  return (
    <input
      value={v}
      onChange={(ev) => setV(ev.target.value)}
      onBlur={commit}
      onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); if (ev.key === "Escape") setV(isTodo(value) ? "" : value); }}
      placeholder="TODO: fill in"
      aria-label={label}
      className={`w-full rounded-lg bg-transparent outline-none transition-colors placeholder:italic placeholder:text-muted ${boxed ? `${field}` : "-mx-2 px-2 py-1 hover:bg-surface-2 focus:bg-surface-2"} ${className}`}
    />
  );
}

function SectionEditor({ name, text, onSave }: { name: string; text: string; onSave: (t: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  return (
    <section>
      <h2 className="mb-3 flex items-center justify-between border-b border-border pb-2 title-md lowercase">
        {name}
        {!editing && (
          <button type="button" className={iconBtn} aria-label={`Modifier « ${name} »`} title="Modifier" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </button>
        )}
      </h2>
      {editing ? (
        <MarkdownEditor initial={isTodo(text) ? "" : text} label={name} onCancel={() => setEditing(false)}
          onSave={async (t) => { const ok = await onSave(t.trim() || "TODO: fill in"); if (ok) setEditing(false); return ok; }} />
      ) : isTodo(text) || !text.trim() ? (
        <button type="button" onClick={() => setEditing(true)} className="text-sm italic text-muted hover:text-text">TODO: fill in</button>
      ) : (
        <div className="md text-[15px]"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{text}</ReactMarkdown></div>
      )}
    </section>
  );
}

function Actions({ items, change }: { items: { text: string; done: boolean }[]; change: (c: Change) => Promise<boolean> }) {
  const [adding, setAdding] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const visible = items.map((a, i) => ({ ...a, i })).filter((a) => !isTodo(a.text));
  return (
    <section>
      <h2 className="mb-3 border-b border-border pb-2 title-md lowercase">Prochaines actions</h2>
      {visible.length === 0 && <p className="mb-2 text-sm italic text-muted">TODO: fill in</p>}
      <ul className="space-y-1">
        {visible.map((a, k) => (
          <li key={`${a.i}-${a.text}`} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-2">
            <button
              type="button"
              role="checkbox"
              aria-checked={a.done}
              aria-label={`Fait : ${a.text}`}
              title="Fait (passe dans le journal)"
              disabled={a.done}
              onClick={() => change({ op: "action-check", index: a.i, text: a.text })}
              className="grid size-5 shrink-0 place-items-center rounded-md border border-border transition-colors hover:border-accent hover:bg-accent-soft disabled:opacity-50"
            >
              {a.done && <Check className="size-3.5" />}
            </button>
            {editing === a.i ? (
              <form className="flex flex-1 gap-1" onSubmit={async (ev) => { ev.preventDefault(); if (await change({ op: "action-edit", index: a.i, text: a.text, newText: draft })) setEditing(null); }}>
                <input value={draft} onChange={(ev) => setDraft(ev.target.value)} autoFocus aria-label="Modifier l'action" className={`${field} py-1`}
                  onKeyDown={(ev) => ev.key === "Escape" && setEditing(null)} />
                <button type="submit" className={iconBtn} aria-label="Enregistrer"><Check className="size-4" /></button>
                <button type="button" className={iconBtn} aria-label="Annuler" onClick={() => setEditing(null)}><X className="size-4" /></button>
              </form>
            ) : (
              <>
                <span className={`min-w-0 flex-1 text-[15px] ${a.done ? "text-muted line-through" : ""}`}>{a.text}</span>
                <span className="flex shrink-0 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <button type="button" className={iconBtn} aria-label={`Monter « ${a.text} »`} disabled={k === 0} onClick={() => change({ op: "action-move", index: a.i, text: a.text, dir: -1 })}><ArrowUp className="size-4" /></button>
                  <button type="button" className={iconBtn} aria-label={`Descendre « ${a.text} »`} disabled={k === visible.length - 1} onClick={() => change({ op: "action-move", index: a.i, text: a.text, dir: 1 })}><ArrowDown className="size-4" /></button>
                  <button type="button" className={iconBtn} aria-label={`Modifier « ${a.text} »`} onClick={() => { setEditing(a.i); setDraft(a.text); }}><Pencil className="size-4" /></button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <form className="mt-2 flex gap-2" onSubmit={async (ev) => { ev.preventDefault(); if (adding.trim() && (await change({ op: "action-add", text: adding }))) setAdding(""); }}>
        <input value={adding} onChange={(ev) => setAdding(ev.target.value)} placeholder="Nouvelle action…" aria-label="Nouvelle action" className={field} />
        <button type="submit" className={btnPrimary} disabled={!adding.trim()}><Plus className="size-4" aria-hidden /> Ajouter</button>
      </form>
    </section>
  );
}

function Journal({ entries, change }: { entries: { date: string; text: string }[]; change: (c: Change) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  return (
    <section>
      <h2 className="mb-3 border-b border-border pb-2 title-md lowercase">Journal</h2>
      <form className="mb-3 flex flex-wrap gap-2" onSubmit={async (ev) => { ev.preventDefault(); if (text.trim() && (await change({ op: "journal-add", text, date }))) setText(""); }}>
        <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} aria-label="Date de l'entrée" className={`${field} w-auto`} />
        <input value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Nouvelle entrée du journal…" aria-label="Nouvelle entrée du journal" className={`${field} min-w-0 flex-1`} />
        <button type="submit" className={btnPrimary} disabled={!text.trim()}>Ajouter</button>
      </form>
      {entries.length === 0 ? (
        <p className="text-sm italic text-muted">Aucune entrée.</p>
      ) : (
        <ol className="space-y-1.5 text-[15px]">
          {entries.map((j, i) => (
            <li key={i} className="flex gap-3">
              <time className="w-24 shrink-0 text-sm tabular-nums text-muted">{j.date}</time>
              <span>{j.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Sections ajoutées à la main (hors modèle) : affichées en lecture seule. */
function extraSections(body: string): [string, string][] {
  const out: [string, string][] = [];
  const parts = body.split(/^## /m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf("\n");
    const name = (nl === -1 ? p : p.slice(0, nl)).trim();
    if (KNOWN.has(name)) continue;
    out.push([name, (nl === -1 ? "" : p.slice(nl + 1)).replace(/^# .*$/m, "").trim()]);
  }
  return out;
}
