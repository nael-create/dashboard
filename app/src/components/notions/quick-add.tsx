"use client";

import { Check, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiJson } from "@/lib/client-api";
import { EVENTS } from "@/lib/shortcuts";
import { btnPrimary, field, iconBtn } from "@/components/ui/forms";

/**
 * Ajout rapide d'une notion, depuis n'importe quelle page : bouton « + » ou touche N.
 * Terme obligatoire, définition et tags facultatifs ; Entrée enregistre, Échap ferme.
 */
export function QuickAddNotion() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const termRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const show = (e: Event) => {
      const term = (e as CustomEvent<{ term?: string }>).detail?.term;
      if (term) setTerm(term);
      setOpen(true);
      setMsg(null);
      termRef.current?.focus(); // si déjà ouvert ; sinon autoFocus à l'ouverture
    };
    window.addEventListener(EVENTS.newNotion, show);
    return () => window.removeEventListener(EVENTS.newNotion, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;
    setBusy(true);
    try {
      await apiJson("/api/notions", "POST", {
        term,
        definition,
        tags: tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
      });
      setMsg({ ok: true, text: definition.trim() ? `« ${term.trim()} » ajoutée.` : `« ${term.trim()} » ajoutée (à compléter).` });
      setTerm("");
      setDefinition("");
      setTags("");
      termRef.current?.focus();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : window.dispatchEvent(new Event(EVENTS.newNotion)))}
        aria-label="Nouvelle notion (N)"
        title="Nouvelle notion (N)"
        aria-expanded={open}
        className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        <Plus className="size-[18px]" aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Nouvelle notion"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className="absolute right-0 top-11 z-40 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-4 shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Nouvelle notion</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className={iconBtn}><X className="size-4" /></button>
          </div>
          <form onSubmit={save} className="space-y-2">
            <input ref={termRef} autoFocus value={term} onChange={(e) => setTerm(e.target.value)} required maxLength={120} placeholder="Terme" aria-label="Terme" className={`${field} font-medium`} />
            <input value={definition} onChange={(e) => setDefinition(e.target.value)} placeholder="Définition (facultatif)" aria-label="Définition" className={field} />
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, séparés par des virgules (facultatif)" aria-label="Tags" className={field} />
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs text-muted">Entrée pour enregistrer · Échap pour fermer</span>
              <button type="submit" disabled={busy || !term.trim()} className={btnPrimary}>Ajouter</button>
            </div>
            {msg && (
              <p className={`flex items-center gap-1.5 text-sm ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                {msg.ok && <Check className="size-4" aria-hidden />} {msg.text}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
