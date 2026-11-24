"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiJson, isConflict } from "@/lib/client-api";
import { headings, wikiSuggestions, type LinkContext } from "@/lib/wiki-links";
import { btnDanger, btnGhost, btnPrimary, field, iconBtn } from "@/components/ui/forms";
import { Notice } from "@/components/ui/notice";
import { StarButton } from "@/components/favorites/favorites-context";
import { DocMarkdown } from "./doc-markdown";

export interface DocPageData { project: string; slug: string; title: string; created: string | null; updated: string | null; body: string; version: string }

const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX = 5 * 1024 * 1024;

/**
 * Page de docs : lecture (sommaire automatique dès 3 titres, liens [[…]], images), modification
 * (« [[ » propose pages et projets, image collée ou déposée → projects/<projet>/assets/), renommer,
 * « Nouvelle décision » (journal de décisions), supprimer = ranger dans docs/_archive/ après confirmation.
 */
export function DocPage({ initial, projectTitle, ctx }: { initial: DocPageData; projectTitle: string; ctx: LinkContext }) {
  const router = useRouter();
  const [doc, setDoc] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial.body);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [error, setError] = useState<{ text: string; conflict: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [title, setTitle] = useState(initial.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [decision, setDecision] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<{ start: number; query: string } | null>(null);
  const [sel, setSel] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const base = `/api/projects/${doc.project}/docs/${doc.slug}`;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("modifier")) setEditing(true);
  }, []);

  const reload = async () => {
    const fresh = await apiJson<DocPageData>(base);
    setDoc(fresh);
    setTitle(fresh.title);
    return fresh;
  };
  const fail = (e: unknown) => setError({ text: e instanceof Error ? e.message : String(e), conflict: isConflict(e) });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiJson(base, "PATCH", { version: doc.version, body: text });
      await reload();
      setEditing(false);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const rename = async () => {
    const t = title.trim();
    if (!t || t === doc.title) return setTitle(doc.title);
    try {
      await apiJson(base, "PATCH", { version: doc.version, title: t });
      await reload();
    } catch (e) {
      fail(e);
      setTitle(doc.title);
    }
  };
  const archive = async () => {
    try {
      await apiJson(`${base}?version=${doc.version}`, "DELETE");
      router.push(`/projets/${doc.project}?onglet=docs`);
      router.refresh();
    } catch (e) {
      fail(e);
    }
  };
  const addDecision = async () => {
    if (!decision?.trim()) return;
    try {
      await apiJson(base, "POST", { action: "decision", version: doc.version, title: decision });
      const fresh = await reload();
      setText(fresh.body);
      setDecision(null);
    } catch (e) {
      fail(e);
    }
  };

  /* Insertion au curseur (images, liens). */
  const insertAt = (start: number, end: number, insert: string) => {
    const el = area.current;
    setText((cur) => cur.slice(0, start) + insert + cur.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + insert.length, start + insert.length);
    });
  };

  const upload = async (files: File[]) => {
    const images = files.filter((f) => ACCEPT.includes(f.type));
    if (!images.length) return false;
    for (const f of images) {
      if (f.size > MAX) {
        setError({ text: `« ${f.name} » dépasse 5 Mo.`, conflict: false });
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const res = await fetch(`/api/projects/${doc.project}/assets?nom=${encodeURIComponent(f.name)}`, { method: "POST", body: f, headers: { "Content-Type": f.type } });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
        const el = area.current;
        const pos = el ? el.selectionStart : text.length;
        insertAt(pos, el ? el.selectionEnd : pos, `\n![${f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[[\]]/g, "")}](${json.markdown})\n`);
      } catch (e) {
        fail(e);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    return true;
  };

  /* Autocomplétion « [[ ». */
  const options = useMemo(() => (suggest ? wikiSuggestions(suggest.query, ctx) : []), [suggest, ctx]);
  const onTextChange = (v: string, caret: number) => {
    setText(v);
    const before = v.slice(0, caret);
    const m = before.match(/\[\[([^\]\n|]*)$/);
    setSuggest(m ? { start: caret - m[1].length, query: m[1] } : null);
    setSel(0);
  };
  const pick = (insert: string) => {
    if (!suggest || !area.current) return;
    const caret = area.current.selectionStart;
    const after = text.slice(caret).startsWith("]]") ? 2 : 0;
    insertAt(suggest.start, caret + after, `${insert}]]`);
    setSuggest(null);
  };

  const toc = headings(doc.body);
  const isDecisionLog = /^##\s+Décisions\s*$/m.test(doc.body);

  return (
    <article>
      <Link href={`/projets/${doc.project}?onglet=docs`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent-text">
        <ArrowLeft className="size-4" aria-hidden /> {projectTitle} · docs
      </Link>
      {error && (
        <div className="mb-4">
          <Notice action={error.conflict ? <button type="button" className="text-sm font-medium underline" onClick={() => { setError(null); reload().then((f) => setText(f.body)); }}>Recharger</button> : undefined}>{error.text}</Notice>
        </div>
      )}

      <header className="rise border-t border-text/80 pt-5">
        <p className="label mb-1 flex items-center justify-between text-muted">
          page · {projectTitle}
          <StarButton type="doc" refId={`doc:${doc.project}/${doc.slug}`} title={doc.title} />
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setTitle(doc.title); }}
          aria-label="Titre de la page (renommer)"
          maxLength={120}
          className="-mx-2 w-full bg-transparent px-2 py-1 text-[clamp(2rem,5vw,4rem)] font-light leading-[1.05] tracking-[-0.04em] outline-none hover:bg-surface-2 focus:bg-surface-2"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <p className="label text-muted">mise à jour {doc.updated ?? "—"} · <code className="normal-case">projects/{doc.project}/docs/{doc.slug}.md</code></p>
          <div className="flex flex-wrap items-center gap-2">
            {isDecisionLog && !editing && (
              <button type="button" className={`${btnGhost} border border-border`} onClick={() => setDecision("")}><Plus className="size-4" aria-hidden /> Nouvelle décision</button>
            )}
            {!editing && <button type="button" className={btnPrimary} onClick={() => { setText(doc.body); setEditing(true); setTab("write"); }}><Pencil className="size-3.5" aria-hidden /> Modifier</button>}
            {!editing && <button type="button" className={iconBtn} aria-label="Supprimer la page" title="Supprimer (rangée dans l'archive du projet)" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /></button>}
          </div>
        </div>
        {confirmDelete && (
          <div className="mt-4 flex flex-wrap items-center gap-2 bg-rose-500/10 px-3 py-2 text-sm" role="alert">
            <span className="flex-1">Supprimer « {doc.title} » ? La page est rangée dans <code>docs/_archive/</code> du projet (récupérable à la main), jamais effacée.</span>
            <button type="button" className={btnDanger} onClick={archive}>Supprimer</button>
            <button type="button" className={btnGhost} onClick={() => setConfirmDelete(false)}>Annuler</button>
          </div>
        )}
        {decision !== null && (
          <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); addDecision(); }}>
            <input value={decision} onChange={(e) => setDecision(e.target.value)} autoFocus placeholder="Titre de la décision (ex. Choisir Resend pour les rappels)" aria-label="Titre de la décision" maxLength={160} className={`${field} min-w-0 flex-1`} onKeyDown={(e) => e.key === "Escape" && setDecision(null)} />
            <button type="submit" className={btnPrimary} disabled={!decision.trim()}>Ajouter</button>
            <button type="button" className={btnGhost} onClick={() => setDecision(null)}>Annuler</button>
          </form>
        )}
      </header>

      {editing ? (
        <div className="mt-6 border border-border">
          <div role="tablist" className="flex items-center gap-1 border-b border-border px-2 pt-2">
            {([["write", "Écrire"], ["preview", "Aperçu"]] as const).map(([id, l]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${tab === id ? "border-accent font-medium" : "border-transparent text-muted hover:text-text"}`}>{l}</button>
            ))}
            <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 px-2 pb-1 text-xs text-muted hover:text-text">
              <ImagePlus className="size-4" aria-hidden /> Image
              <input type="file" accept={ACCEPT.join(",")} multiple className="sr-only" onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ""; }} />
            </label>
          </div>
          <div className="relative p-3">
            {tab === "write" ? (
              <>
                <textarea
                  ref={area}
                  value={text}
                  onChange={(e) => onTextChange(e.target.value, e.target.selectionStart)}
                  onPaste={(e) => {
                    const files = [...e.clipboardData.files];
                    if (files.some((f) => ACCEPT.includes(f.type))) {
                      e.preventDefault();
                      upload(files);
                    }
                  }}
                  onDrop={(e) => {
                    const files = [...e.dataTransfer.files];
                    if (files.length) {
                      e.preventDefault();
                      upload(files);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (options.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                      e.preventDefault();
                      setSel((s) => (s + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
                    } else if (options.length && (e.key === "Enter" || e.key === "Tab")) {
                      e.preventDefault();
                      pick(options[sel].insert);
                    } else if (e.key === "Escape" && suggest) {
                      setSuggest(null);
                    } else if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      save();
                    }
                  }}
                  rows={22}
                  aria-label="Texte de la page (Markdown)"
                  autoFocus
                  className={`${field} resize-y font-mono text-[13px] leading-relaxed`}
                  placeholder={"## Titre de section\n\nTexte… [[autre page]] pour un lien, colle ou dépose une image."}
                />
                {options.length > 0 && (
                  <ul role="listbox" aria-label="Pages et projets" className="absolute left-4 top-4 z-20 w-72 border border-border bg-surface shadow-lg">
                    <li className="label border-b border-border px-3 py-1.5 text-muted">lier à…</li>
                    {options.map((o, i) => (
                      <li key={o.insert} role="option" aria-selected={i === sel}>
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(o.insert); }}
                          className={`flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-sm ${i === sel ? "bg-surface-2" : ""}`}>
                          <span className="truncate">{o.label}</span><span className="label shrink-0 text-muted">{o.hint}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="md min-h-48 bg-surface-2 p-4 text-[15px]">
                {text.trim() ? <DocMarkdown text={text} ctx={ctx} /> : <p className="text-muted">Rien à afficher.</p>}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted">
                {uploading > 0 ? "Envoi de l'image…" : "« [[ » pour lier une page ou un projet · image : coller, déposer ou bouton (5 Mo max) · ⌘S enregistre"}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setEditing(false); setText(doc.body); setSuggest(null); }} className={btnGhost}>Annuler</button>
                <button type="button" disabled={busy || uploading > 0} className={btnPrimary} onClick={save}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-12">
          {toc.length >= 3 && (
            <nav aria-label="Sommaire" className="lg:order-2 lg:col-span-3">
              <div className="lg:sticky lg:top-6">
                <p className="label mb-2 text-muted">sommaire</p>
                <ol className="space-y-1 border-l border-border text-sm">
                  {toc.map((h) => (
                    <li key={h.id} className={h.level === 3 ? "pl-6" : "pl-3"}>
                      <a href={`#${h.id}`} className="text-muted hover:text-text">{h.text}</a>
                    </li>
                  ))}
                </ol>
              </div>
            </nav>
          )}
          <div className={`md min-w-0 text-[16px] leading-relaxed ${toc.length >= 3 ? "lg:col-span-9" : "lg:col-span-9"}`}>
            {doc.body.trim() ? <DocMarkdown text={doc.body} ctx={ctx} /> : (
              <button type="button" onClick={() => setEditing(true)} className="text-sm italic text-muted hover:text-text">Page vide — cliquer pour écrire.</button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
