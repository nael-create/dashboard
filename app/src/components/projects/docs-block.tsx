"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, FileText, Plus } from "lucide-react";
import { useState } from "react";
import { apiJson } from "@/lib/client-api";
import { btnGhost, btnPrimary, chip, field, iconBtn } from "@/components/ui/forms";
import { Notice } from "@/components/ui/notice";
import { shortDate } from "@/lib/fr-dates";

export interface DocListItem { slug: string; title: string; updated: string | null; order: number }
export interface TemplateItem { id: string; title: string; description: string }

/**
 * Bloc « documents (n) », replié par défaut : liste des pages de docs (glisser-déposer ou ↑/↓ pour
 * réordonner) et « Nouveau document » (vide ou depuis un modèle). Une page s'ouvre en plein écran.
 */
export function DocsBlock({ api, hrefBase, initial, templates, open: openInit = false }: {
  /** Route d'API des docs, ex. /api/projects/<nom>/docs */
  api: string;
  /** Adresse des pages, ex. /projets/<nom>/docs */
  hrefBase: string;
  initial: DocListItem[]; templates: TemplateItem[]; open?: boolean;
}) {
  const router = useRouter();
  const [docs, setDocs] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const create = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    try {
      const { doc } = await apiJson<{ doc: string }>(api, "POST", { title: title || templates.find((t) => t.id === template)?.title || "", template });
      router.push(`${hrefBase}/${doc}?modifier=1`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const reorder = async (order: string[]) => {
    setDocs((d) => order.map((s) => d.find((x) => x.slug === s)!));
    try {
      setDocs((await apiJson<{ docs: DocListItem[] }>(api, "PATCH", { order })).docs);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const move = (i: number, dir: -1 | 1) => {
    const order = docs.map((d) => d.slug);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    reorder(order);
  };

  return (
    <details className="group/docs border-t border-text/80" open={openInit || undefined}>
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 [&::-webkit-details-marker]:hidden">
        <span className="section-title">documents <span className="label text-muted">({docs.length})</span></span>
        <span className="label text-muted transition-transform group-open/docs:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="pb-6">
        {error && <div className="mb-4"><Notice>{error}</Notice></div>}
        {docs.length > 0 && (
          <ol className="mb-4 border-t border-border">
            {docs.map((d, i) => (
              <li
                key={d.slug}
                draggable
                onDragStart={() => setDragging(d.slug)}
                onDragOver={(ev) => dragging && ev.preventDefault()}
                onDrop={() => {
                  if (!dragging || dragging === d.slug) return;
                  const order = docs.map((x) => x.slug).filter((s) => s !== dragging);
                  order.splice(order.indexOf(d.slug), 0, dragging);
                  setDragging(null);
                  reorder(order);
                }}
                className={`group flex items-center gap-3 border-b border-border py-2.5 ${dragging === d.slug ? "opacity-50" : ""}`}
              >
                <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                <Link href={`${hrefBase}/${d.slug}`} className="min-w-0 flex-1 truncate text-[15px] hover:text-accent-text">{d.title}</Link>
                <span className="label hidden text-muted sm:inline">{d.updated && /^\d{4}-\d{2}-\d{2}$/.test(d.updated) ? shortDate(d.updated) : ""}</span>
                <span className="flex shrink-0 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <button type="button" className={iconBtn} aria-label={`Monter « ${d.title} »`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></button>
                  <button type="button" className={iconBtn} aria-label={`Descendre « ${d.title} »`} disabled={i === docs.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></button>
                </span>
              </li>
            ))}
          </ol>
        )}
        {!creating ? (
          <button type="button" className={btnGhost} onClick={() => setCreating(true)}><Plus className="size-3.5" aria-hidden /> Nouveau document</button>
        ) : (
          <form onSubmit={create} className="space-y-3">
            <input value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="Titre du document…" aria-label="Titre du document" maxLength={120} className={field} autoFocus />
            <div role="radiogroup" aria-label="Modèle" className="flex flex-wrap gap-1.5">
              {[{ id: null, title: "Page vide", description: "" }, ...templates].map((t) => (
                <button key={t.id ?? "vide"} type="button" role="radio" aria-checked={template === t.id} title={t.description || undefined}
                  onClick={() => setTemplate(t.id)} className={chip(template === t.id)}>{t.title}</button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => { setCreating(false); setTitle(""); setTemplate(null); }}>Annuler</button>
              <button type="submit" className={btnPrimary} disabled={!title.trim() && !template}>Créer</button>
            </div>
          </form>
        )}
      </div>
    </details>
  );
}
