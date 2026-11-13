"use client";

import { Check, Pencil, Printer, RotateCcw, Search, Trash2, Upload, X } from "lucide-react";
import { Fragment, useCallback, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiJson, isConflict } from "@/lib/client-api";
import { fold } from "@/lib/slug";
import { btnDanger, btnGhost, btnPrimary, chip, field, iconBtn } from "@/components/ui/forms";
import { Notice } from "@/components/ui/notice";
import { formatISODate } from "@/lib/dates";
import { StarButton } from "@/components/favorites/favorites-context";
import { Practice } from "./practice";

const renderStar = (n: { id: string; term: string; tags: string[] }) => (
  <StarButton type="notion" refId={`notion:${n.id}`} title={n.term} source={n.tags.join(", ")} />
);

export interface NotionItem {
  id: string;
  term: string;
  tags: string[];
  added: string | null;
  definition: string;
  example: string;
  complete: boolean;
  box: number;
  due: string | null;
  reviewed: boolean;
}

type Tab = "consulter" | "travailler" | "gerer";
type Sort = "alpha" | "tag" | "date";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const letterOf = (term: string) => {
  const c = fold(term).charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
};
const matches = (n: NotionItem, q: string) => !q || fold(`${n.term} ${n.definition} ${n.example} ${n.tags.join(" ")}`).includes(fold(q));
const byTerm = (a: NotionItem, b: NotionItem) => a.term.localeCompare(b.term, "fr", { sensitivity: "base" });

export function NotionsBoard({
  initial, initialVersion, initialTab, today,
}: { initial: NotionItem[]; initialVersion: string; initialTab: Tab; today: string }) {
  const [notions, setNotions] = useState(initial);
  const [version, setVersion] = useState(initialVersion);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [error, setError] = useState<{ text: string; conflict: boolean } | null>(null);

  const reload = useCallback(async () => {
    const d = await apiJson<{ notions: NotionItem[]; version: string }>("/api/notions");
    setNotions(d.notions);
    setVersion(d.version);
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
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

  const switchTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t !== "consulter") url.searchParams.set("onglet", t);
    else url.searchParams.delete("onglet");
    window.history.replaceState(null, "", url);
  };
  const incomplete = notions.filter((n) => !n.complete).length;

  return (
    <div>
      <div role="tablist" aria-label="Notions" className="mb-6 flex w-fit rounded-full bg-surface-2 p-1 print:hidden">
        {([["consulter", "Tout consulter"], ["travailler", "Travailler"], ["gerer", "Gérer"]] as const).map(([id, label]) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => switchTab(id)}
            className={`rounded-full px-4 py-1.5 text-sm transition-all ${tab === id ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-text"}`}>
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 print:hidden">
          <Notice action={error.conflict ? <button type="button" className="text-sm font-medium underline" onClick={() => { setError(null); reload(); }}>Recharger</button> : undefined}>
            {error.text}
          </Notice>
        </div>
      )}

      {tab === "travailler" ? (
        <Practice
          cards={notions.filter((n) => n.complete)}
          today={today}
          onRecorded={(id, box, due) => setNotions((all) => all.map((n) => (n.id === id ? { ...n, box, due, reviewed: true } : n)))}
        />
      ) : tab === "consulter" ? (
        <Glossary
          notions={notions.filter((n) => n.complete)}
          incomplete={incomplete}
          renderStar={renderStar}
          onShowIncomplete={() => { setIncompleteOnly(true); switchTab("gerer"); }}
        />
      ) : (
        <Manage notions={notions} version={version} run={run} incompleteOnly={incompleteOnly} setIncompleteOnly={setIncompleteOnly} renderStar={renderStar} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Onglet « Tout consulter » : glossaire en lecture seule              */
/* ------------------------------------------------------------------ */

function GlossaryCard({ n, renderStar, letter }: { n: NotionItem; renderStar?: (n: NotionItem) => React.ReactNode; letter?: string }) {
  return (
    <article id={`notion-${n.id}`} className="h-full scroll-mt-28 break-inside-avoid border-t border-text/80 pb-4 pt-3 print:border-gray-400">
      <p className="label mb-2 h-3 text-muted">{letter ?? ""}</p>
      <h3 className="flex items-start justify-between gap-2 text-[clamp(1.35rem,2vw,1.7rem)] font-light leading-[1.05] tracking-[-0.03em]">
        <span>{n.term}</span>
        {renderStar && <span className="print:hidden">{renderStar(n)}</span>}
      </h3>
      <div className="md mt-1.5 text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{n.definition}</ReactMarkdown></div>
      {n.example && <p className="mt-2 border-l border-text/60 pl-2 text-sm italic text-muted">{n.example}</p>}
      {n.tags.length > 0 && <p className="label mt-3 text-muted">{n.tags.map((t) => `#${t}`).join(" ")}</p>}
    </article>
  );
}

function Glossary({
  notions, incomplete, onShowIncomplete, renderStar,
}: { notions: NotionItem[]; incomplete: number; onShowIncomplete: () => void; renderStar?: (n: NotionItem) => React.ReactNode }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("alpha");
  const shown = useMemo(() => notions.filter((n) => matches(n, q)), [notions, q]);

  const groups = useMemo((): [string, NotionItem[]][] => {
    if (sort === "date") return [["", [...shown].sort((a, b) => (b.added ?? "").localeCompare(a.added ?? "") || byTerm(a, b))]];
    if (sort === "tag") {
      const m = new Map<string, NotionItem[]>();
      for (const n of shown) for (const t of n.tags.length ? n.tags : ["Sans tag"]) m.set(t, [...(m.get(t) ?? []), n]);
      return [...m.entries()].sort((a, b) => (a[0] === "Sans tag" ? 1 : b[0] === "Sans tag" ? -1 : a[0].localeCompare(b[0], "fr"))).map(([t, l]) => [t, l.sort(byTerm)]);
    }
    const m = new Map<string, NotionItem[]>();
    for (const n of [...shown].sort(byTerm)) m.set(letterOf(n.term), [...(m.get(letterOf(n.term)) ?? []), n]);
    return [...m.entries()];
  }, [shown, sort]);

  const present = new Set(shown.map((n) => letterOf(n.term)));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <label className="relative w-full sm:w-auto sm:min-w-0 sm:flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un terme, une définition, un tag" aria-label="Rechercher dans les notions" className={`${field} pl-9`} />
        </label>
        {([["alpha", "A → Z"], ["tag", "Par tag"], ["date", "Par date d'ajout"]] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)} className={chip(sort === id)}>{label}</button>
        ))}
        <button type="button" onClick={() => window.print()} className={btnGhost}><Printer className="size-4" aria-hidden /> Imprimer</button>
      </div>

      {incomplete > 0 && (
        <button type="button" onClick={onShowIncomplete} className="mb-4 text-sm text-muted underline-offset-2 hover:text-accent-text hover:underline print:hidden">
          {incomplete} notion{incomplete > 1 ? "s" : ""} à compléter
        </button>
      )}

      {sort === "alpha" && (
        <nav aria-label="Index alphabétique" className="sticky top-14 z-20 -mx-4 mb-4 flex flex-wrap justify-center gap-0.5 bg-bg/90 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0 print:hidden">
          {[...LETTERS, "#"].map((l) => (
            present.has(l) ? (
              <a key={l} href={`#lettre-${l}`} className="grid size-7 place-items-center rounded-md text-xs font-semibold transition-colors hover:bg-accent-soft hover:text-accent-text">{l}</a>
            ) : (
              <span key={l} aria-hidden className="grid size-7 place-items-center text-xs text-muted/40">{l}</span>
            )
          ))}
        </nav>
      )}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {notions.length ? "Aucune notion ne correspond à ta recherche." : "Aucune notion avec définition pour l'instant. Ajoute-en avec « + » ou la touche N."}
        </p>
      ) : (
        // Une seule grille dense : les titres de groupe (lettre ou tag) occupent toute la largeur.
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:block print:columns-2 print:gap-4">
          {groups.map(([g, list]) => (
            <Fragment key={g || "all"}>
              {/* A → Z : grille dense, la lettre s'affiche sur la première notion (ancre de l'index). */}
              {g && sort !== "alpha" && (
                <h2 className="col-span-full mt-6 scroll-mt-28 title-md lowercase print:mb-2 print:mt-4">
                  {sort === "tag" && g !== "Sans tag" ? `#${g}` : g}
                </h2>
              )}
              {list.map((n, i) => (
                <div key={`${g}-${n.id}`} id={sort === "alpha" && i === 0 ? `lettre-${g}` : undefined} className="scroll-mt-28 print:mb-3">
                  <GlossaryCard n={n} renderStar={renderStar} letter={sort === "alpha" && i === 0 ? g : undefined} />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Onglet « Gérer »                                                     */
/* ------------------------------------------------------------------ */

function LevelDots({ box, reviewed }: { box: number; reviewed: boolean }) {
  const label = reviewed ? `Niveau ${box} sur 6` : "Jamais révisée";
  return (
    <span className="flex gap-0.5" title={label} aria-label={label}>
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className={`size-1.5 rounded-full ${reviewed && i < box ? "bg-accent" : "bg-border"}`} />
      ))}
    </span>
  );
}

function Manage({
  notions, version, run, incompleteOnly, setIncompleteOnly, renderStar,
}: {
  notions: NotionItem[]; version: string; run: (fn: () => Promise<unknown>) => Promise<boolean>;
  incompleteOnly: boolean; setIncompleteOnly: (v: boolean) => void; renderStar?: (n: NotionItem) => React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: "delete" | "reset" } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const tags = useMemo(() => [...new Set(notions.flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b, "fr")), [notions]);
  const shown = notions
    .filter((n) => matches(n, q) && (!tag || n.tags.includes(tag)) && (!incompleteOnly || !n.complete))
    .sort(byTerm);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-auto sm:min-w-0 sm:flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" aria-label="Rechercher" className={`${field} pl-9`} />
        </label>
        <button type="button" aria-pressed={incompleteOnly} onClick={() => setIncompleteOnly(!incompleteOnly)} className={chip(incompleteOnly)}>À compléter</button>
        <button type="button" aria-pressed={tag === null} onClick={() => setTag(null)} className={chip(tag === null)}>Tous les tags</button>
        {tags.map((t) => <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)} className={chip(tag === t)}>#{t}</button>)}
        <button type="button" onClick={() => setImportOpen(!importOpen)} className={`${btnGhost} ml-auto`}><Upload className="size-4" aria-hidden /> Importer</button>
      </div>

      {importOpen && <BulkImport existing={notions.map((n) => n.term)} version={version} run={run} onDone={() => setImportOpen(false)} />}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">Aucune notion ne correspond.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {shown.map((n) => (
            <li key={n.id} className="p-4">
              {editing === n.id ? (
                <EditForm n={n} onCancel={() => setEditing(null)} onSave={async (patch) => {
                  if (await run(() => apiJson(`/api/notions/${encodeURIComponent(n.id)}`, "PATCH", { version, ...patch }))) setEditing(null);
                }} />
              ) : (
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {n.term}
                      {!n.complete && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-normal text-amber-700 dark:text-amber-300">à compléter</span>}
                    </p>
                    {n.definition && <p className="line-clamp-2 text-sm text-muted">{n.definition}</p>}
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                      {n.complete && <LevelDots box={n.box} reviewed={n.reviewed} />}
                      {n.added && <span>Ajoutée le {formatISODate(n.added)}</span>}
                      {n.tags.length > 0 && <span>{n.tags.map((t) => `#${t}`).join(" ")}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {renderStar?.(n)}
                    <button type="button" className={iconBtn} aria-label={`Modifier « ${n.term} »`} title="Modifier" onClick={() => setEditing(n.id)}><Pencil className="size-4" /></button>
                    {n.reviewed && (
                      <button type="button" className={iconBtn} aria-label={`Réinitialiser la progression de « ${n.term} »`} title="Réinitialiser la progression" onClick={() => setConfirm({ id: n.id, kind: "reset" })}><RotateCcw className="size-4" /></button>
                    )}
                    <button type="button" className={`${iconBtn} hover:text-rose-600`} aria-label={`Supprimer « ${n.term} »`} title="Supprimer" onClick={() => setConfirm({ id: n.id, kind: "delete" })}><Trash2 className="size-4" /></button>
                  </div>
                </div>
              )}
              {confirm?.id === n.id && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-sm">
                  <span className="flex-1">
                    {confirm.kind === "delete" ? `Supprimer « ${n.term} » de NOTIONS.md ?` : `Remettre la progression de « ${n.term} » à zéro ?`}
                  </span>
                  <button type="button" className={btnDanger} onClick={async () => {
                    const ok = confirm.kind === "delete"
                      ? await run(() => apiJson(`/api/notions/${encodeURIComponent(n.id)}?version=${version}`, "DELETE"))
                      : await run(() => apiJson(`/api/notions/${encodeURIComponent(n.id)}/reset`, "POST", {}));
                    if (ok) setConfirm(null);
                  }}>{confirm.kind === "delete" ? "Supprimer" : "Réinitialiser"}</button>
                  <button type="button" className={btnGhost} onClick={() => setConfirm(null)}>Annuler</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditForm({
  n, onSave, onCancel,
}: { n: NotionItem; onSave: (p: { term: string; definition: string; example: string; tags: string[] }) => Promise<void>; onCancel: () => void }) {
  const [term, setTerm] = useState(n.term);
  const [definition, setDefinition] = useState(n.definition);
  const [example, setExample] = useState(n.example);
  const [tags, setTags] = useState(n.tags.join(", "));
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ term, definition, example, tags: tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean) });
      }}
    >
      <input value={term} onChange={(e) => setTerm(e.target.value)} required maxLength={120} aria-label="Terme" className={`${field} font-medium`} />
      <textarea value={definition} onChange={(e) => setDefinition(e.target.value)} rows={3} placeholder="Définition" aria-label="Définition" className={`${field} resize-y`} />
      <textarea value={example} onChange={(e) => setExample(e.target.value)} rows={2} placeholder="Exemple ou contexte (facultatif)" aria-label="Exemple" className={`${field} resize-y`} />
      <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, séparés par des virgules" aria-label="Tags" className={field} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={btnGhost}><X className="size-4" aria-hidden /> Annuler</button>
        <button type="submit" className={btnPrimary}><Check className="size-4" aria-hidden /> Enregistrer</button>
      </div>
    </form>
  );
}

/** Import en masse « terme : définition », avec aperçu avant d'enregistrer. */
function BulkImport({
  existing, version, run, onDone,
}: { existing: string[]; version: string; run: (fn: () => Promise<unknown>) => Promise<boolean>; onDone: () => void }) {
  const [raw, setRaw] = useState("");
  const preview = useMemo(() => parseBulkClient(raw, existing), [raw, existing]);
  const ok = preview.filter((p) => p.status === "ok");
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <h3 className="font-medium">Importer plusieurs notions</h3>
      <p className="text-sm text-muted">Une notion par ligne, au format <code>terme : définition</code>. Les lignes vides sont ignorées, les doublons signalés.</p>
      <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6} placeholder={"Taux directeur : taux fixé par la banque centrale\nSpread : écart entre deux taux"} aria-label="Notions à importer" className={`${field} font-mono text-xs`} />
      {preview.length > 0 && (
        <div className="max-h-64 overflow-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-left text-xs text-muted">
              <tr><th className="px-3 py-1.5">Terme</th><th className="px-3 py-1.5">Définition</th><th className="px-3 py-1.5">État</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {preview.map((p) => (
                <tr key={p.line} className={p.status === "ok" ? "" : "text-muted"}>
                  <td className="px-3 py-1.5 font-medium">{p.term || "—"}</td>
                  <td className="px-3 py-1.5">{p.definition || <span className="italic">à compléter</span>}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-xs">{p.status === "ok" ? "OK" : p.status === "duplicate" ? "Doublon (ignoré)" : "Invalide (ignoré)"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className={btnGhost}>Fermer</button>
        <button type="button" disabled={!ok.length} className={btnPrimary}
          onClick={async () => {
            if (await run(() => apiJson("/api/notions/import", "POST", { version, items: ok.map(({ term, definition }) => ({ term, definition })) }))) {
              setRaw("");
              onDone();
            }
          }}>
          Importer {ok.length} notion{ok.length > 1 ? "s" : ""}
        </button>
      </div>
    </section>
  );
}

/** Même règle que le serveur (lib/notions.ts › parseBulk), pour l'aperçu instantané. */
function parseBulkClient(raw: string, existing: string[]) {
  const key = (t: string) => fold(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const seen = new Set(existing.map(key));
  const out: { line: number; term: string; definition: string; status: "ok" | "duplicate" | "invalid" }[] = [];
  raw.split(/\r?\n/).forEach((l, i) => {
    if (!l.trim()) return;
    const m = l.match(/^\s*(.+?)\s*:\s*(.*)$/);
    const term = (m ? m[1] : l).trim().replace(/^[-*]\s+/, "");
    const definition = m ? m[2].trim() : "";
    const status = !term || /^##/.test(term) ? "invalid" : seen.has(key(term)) ? "duplicate" : "ok";
    if (status === "ok") seen.add(key(term));
    out.push({ line: i + 1, term, definition, status });
  });
  return out;
}
