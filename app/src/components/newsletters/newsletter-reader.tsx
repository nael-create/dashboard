"use client";

import { GraduationCap, StickyNote, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiJson, isConflict } from "@/lib/client-api";
import { locateQuote, MAX_PASSAGE, quoteFrom, type Quote } from "@/lib/anchoring";
import { EVENTS } from "@/lib/shortcuts";
import { btnGhost, btnPrimary, field } from "@/components/ui/forms";

export type HlColor = "yellow" | "green" | "blue" | "pink";
export interface ReaderHighlight {
  id: string;
  color: HlColor;
  text: string;
  prefix: string;
  suffix: string;
  note: string;
}
export interface ReaderMessage {
  subject: string;
  from: string;
  received: string;
  link: string;
}

export const HL_COLORS: { id: HlColor; label: string }[] = [
  { id: "yellow", label: "Jaune" },
  { id: "green", label: "Vert" },
  { id: "blue", label: "Bleu" },
  { id: "pink", label: "Rose" },
];

/* ------------------------------------------------------------------ */
/* Outils DOM : texte du conteneur, positions ↔ nœuds, marques          */
/* ------------------------------------------------------------------ */

function textNodes(root: Node): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

/** Position d'un point (nœud, décalage) dans le texte du conteneur. */
function offsetOf(root: Node, node: Node, offset: number): number {
  const r = document.createRange();
  r.setStart(root, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

/** Entoure [start, end) du texte du conteneur de <mark> (un par morceau de nœud texte). */
function wrapRange(root: HTMLElement, start: number, end: number, h: ReaderHighlight) {
  let pos = 0;
  for (const node of textNodes(root)) {
    const len = node.data.length;
    const from = Math.max(start, pos);
    const to = Math.min(end, pos + len);
    if (from < to) {
      let target = node;
      if (from > pos) target = target.splitText(from - pos);
      if (to < pos + len) target.splitText(to - from);
      const mark = document.createElement("mark");
      mark.className = `hl hl-${h.color}${h.note ? " hl-note" : ""}`;
      mark.dataset.hl = h.id;
      mark.tabIndex = 0;
      mark.setAttribute("role", "button");
      mark.setAttribute("aria-label", h.note ? `Surlignage avec note : ${h.note}` : "Surlignage : modifier");
      target.parentNode!.insertBefore(mark, target);
      mark.appendChild(target);
    }
    pos += len;
    if (pos >= end) break;
  }
}

function unwrapAll(root: HTMLElement) {
  root.querySelectorAll("mark[data-hl]").forEach((m) => {
    const parent = m.parentNode!;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
  });
  root.normalize();
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

type Toolbar = { quote: Quote; tooLong: number | null; x: number; y: number; below: boolean };
type Popover = { id: string; x: number; y: number; below: boolean; editNote: boolean };

/**
 * Lecture d'une newsletter avec surlignage (mode « Lecture »).
 * Le HTML reçu est déjà nettoyé strictement côté serveur (sanitizeForReading) ; la page porte en plus
 * une CSP à nonce. Les surlignages sont ancrés par citation (passage + préfixe + suffixe).
 */
export function NewsletterReader({
  html, message, initialHighlights, initialVersion, focusId,
}: {
  html: string;
  message: ReaderMessage;
  initialHighlights: ReaderHighlight[];
  initialVersion: string;
  focusId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState(initialHighlights);
  const [version, setVersion] = useState(initialVersion);
  const [toolbar, setToolbar] = useState<Toolbar | null>(null);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const interacting = useRef(false);
  const reported = useRef(false);
  const focused = useRef(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Dessine les surlignages (après chaque changement) et signale ceux qu'on ne retrouve plus.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    unwrapAll(root);
    const text = root.textContent ?? "";
    const found: string[] = [];
    const lost: string[] = [];
    // Les plus longs d'abord : un surlignage contenu dans un autre reste cliquable par-dessus.
    for (const h of [...highlights].sort((a, b) => b.text.length - a.text.length)) {
      const pos = locateQuote(text, { exact: h.text, prefix: h.prefix, suffix: h.suffix });
      if (!pos) {
        lost.push(h.id);
        continue;
      }
      found.push(h.id);
      wrapRange(root, pos.start, pos.end, h);
    }
    setMissing(lost);
    if (!reported.current && (found.length || lost.length)) {
      reported.current = true;
      apiJson("/api/highlights/status", "POST", { found, missing: lost }).catch(() => {});
    }
    if (focusId && !focused.current) {
      const el = root.querySelector<HTMLElement>(`mark[data-hl="${CSS.escape(focusId)}"]`);
      if (el) {
        focused.current = true;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        root.querySelectorAll(`mark[data-hl="${CSS.escape(focusId)}"]`).forEach((m) => m.classList.add("hl-flash"));
      }
    }
  }, [highlights, focusId]);

  /* -------- Sélection → barre flottante -------- */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const root = ref.current;
        const sel = document.getSelection();
        if (!root || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
          if (!interacting.current) setToolbar(null);
          return;
        }
        const range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) {
          if (!interacting.current) setToolbar(null);
          return;
        }
        const text = root.textContent ?? "";
        const start = offsetOf(root, range.startContainer, range.startOffset);
        const end = offsetOf(root, range.endContainer, range.endOffset);
        const quote = quoteFrom(text, start, end);
        if (!quote) return setToolbar(null);
        const rect = range.getBoundingClientRect();
        // Sur écran tactile, sous la sélection (le menu du système s'affiche au-dessus) ;
        // au-dessus si la place manque en bas de l'écran.
        let below = coarse || rect.top < 90;
        if (below && rect.bottom + 70 > window.innerHeight && rect.top > 90) below = false;
        setPopover(null);
        setToolbar({
          quote,
          tooLong: quote.exact.length > MAX_PASSAGE ? quote.exact.length : null,
          x: Math.min(Math.max(rect.left + rect.width / 2, 150), window.innerWidth - 150),
          y: below ? rect.bottom + 10 : rect.top - 10,
          below,
        });
      }, coarse ? 350 : 120);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
    };
  }, []);

  // La barre suit la page quand on fait défiler : on la ferme simplement.
  useEffect(() => {
    if (!toolbar && !popover) return;
    const close = () => {
      setToolbar(null);
      setPopover((p) => (p?.editNote ? p : null));
    };
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, [toolbar, popover]);

  const fail = (e: unknown) => setError(isConflict(e) ? "SURLIGNAGES.md a changé ailleurs : recharge la page." : e instanceof Error ? e.message : String(e));

  const create = useCallback(async (color: HlColor, then?: (h: ReaderHighlight) => void) => {
    if (!toolbar || toolbar.tooLong) return;
    setError(null);
    try {
      const res = await apiJson<{ highlight: ReaderHighlight; version: string }>("/api/highlights", "POST", {
        text: toolbar.quote.exact, prefix: toolbar.quote.prefix, suffix: toolbar.quote.suffix, color,
        subject: message.subject, from: message.from, received: message.received, link: message.link,
      });
      setVersion(res.version);
      setHighlights((hs) => [...hs, res.highlight]);
      document.getSelection()?.removeAllRanges();
      setToolbar(null);
      window.dispatchEvent(new Event(EVENTS.contentChanged));
      then?.(res.highlight);
    } catch (e) {
      fail(e);
    } finally {
      interacting.current = false;
    }
  }, [toolbar, message]);

  const openNotion = (h: ReaderHighlight) =>
    window.dispatchEvent(new CustomEvent(EVENTS.newNotion, {
      detail: { definition: h.text, example: `${message.subject} — ${message.from.replace(/\s*<[^>]*>\s*$/, "")}`, highlight: h.id },
    }));

  const openPopover = (el: HTMLElement, editNote = false) => {
    const id = el.dataset.hl!;
    const rect = el.getBoundingClientRect();
    const below = rect.top < 260;
    setToolbar(null);
    setPopover({ id, editNote, below, x: Math.min(Math.max(rect.left + rect.width / 2, 170), window.innerWidth - 170), y: below ? rect.bottom + 10 : rect.top - 10 });
  };

  const patch = async (id: string, body: { color?: HlColor; note?: string }) => {
    setError(null);
    try {
      const res = await apiJson<{ highlight: ReaderHighlight; version: string }>(`/api/highlights/${id}`, "PATCH", { version, ...body });
      setVersion(res.version);
      setHighlights((hs) => hs.map((h) => (h.id === id ? { ...h, ...body } : h)));
      window.dispatchEvent(new Event(EVENTS.contentChanged));
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      const res = await apiJson<{ version: string }>(`/api/highlights/${id}?version=${encodeURIComponent(version)}`, "DELETE");
      setVersion(res.version);
      setHighlights((hs) => hs.filter((h) => h.id !== id));
      setPopover(null);
      window.dispatchEvent(new Event(EVENTS.contentChanged));
    } catch (e) {
      fail(e);
    }
  };

  // Clic (ou Entrée) sur un surlignage existant.
  const onClick = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest<HTMLElement>("mark[data-hl]");
    if (!mark) return;
    const sel = document.getSelection();
    if (sel && !sel.isCollapsed) return; // en train de sélectionner
    openPopover(mark);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const mark = (e.target as HTMLElement).closest<HTMLElement>("mark[data-hl]");
    if (mark && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openPopover(mark);
    }
  };

  const current = popover ? highlights.find((h) => h.id === popover.id) : undefined;

  return (
    <div className="relative">
      {error && <p className="mb-4 border-l-2 border-rose-600 pl-3 text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p>}
      {missing.length > 0 && (
        <p className="label mb-4 text-muted">
          {missing.length} surlignage{missing.length > 1 ? "s" : ""} introuvable{missing.length > 1 ? "s" : ""} dans ce mail — visible{missing.length > 1 ? "s" : ""} dans <a href="/surlignages" className="link-underline text-text">Surlignages</a>.
        </p>
      )}
      {/* HTML déjà nettoyé strictement côté serveur (aucun script, style, id ou class) ; CSP à nonce en plus. */}
      <div
        ref={ref}
        className="nl"
        onClick={onClick}
        onKeyDown={onKeyDown}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {mounted && toolbar && createPortal(
        <div
          role="toolbar"
          aria-label="Surligner la sélection"
          onPointerDown={(e) => {
            interacting.current = true;
            if (e.pointerType === "mouse") e.preventDefault(); // garde la sélection
          }}
          className="fixed z-50 flex items-center gap-1 border border-border bg-bg p-1.5 text-text shadow-lg"
          style={{ left: toolbar.x, top: toolbar.y, transform: `translate(-50%, ${toolbar.below ? "0" : "-100%"})` }}
        >
          {toolbar.tooLong ? (
            <span className="px-2 py-1 text-xs">Sélection trop longue ({toolbar.tooLong} caractères, 1 000 au plus).</span>
          ) : (
            <>
              {HL_COLORS.map((c) => (
                <button key={c.id} type="button" onClick={() => create(c.id)} aria-label={`Surligner en ${c.label.toLowerCase()}`} title={c.label}
                  className={`grid size-9 place-items-center rounded-full transition-transform hover:scale-110`}>
                  <span className={`size-5 rounded-full hl-swatch hl-${c.id}`} aria-hidden />
                </button>
              ))}
              <span className="mx-1 h-6 w-px bg-border" aria-hidden />
              <button type="button" onClick={() => create("yellow", (h) => setTimeout(() => {
                const el = ref.current?.querySelector<HTMLElement>(`mark[data-hl="${CSS.escape(h.id)}"]`);
                if (el) openPopover(el, true);
              }, 30))} className="label inline-flex h-9 items-center gap-1.5 px-2 hover:text-accent-text">
                <StickyNote className="size-3.5" aria-hidden /> Ajouter une note
              </button>
              <button type="button" onClick={() => create("yellow", openNotion)} className="label inline-flex h-9 items-center gap-1.5 px-2 hover:text-accent-text">
                <GraduationCap className="size-3.5" aria-hidden /> Créer une notion
              </button>
            </>
          )}
        </div>,
        document.body,
      )}

      {mounted && popover && current && createPortal(
        <HighlightPopover
          key={current.id}
          highlight={current}
          popover={popover}
          onClose={() => setPopover(null)}
          onColor={(c) => patch(current.id, { color: c })}
          onNote={async (note) => (await patch(current.id, { note })) && setPopover(null)}
          onDelete={() => remove(current.id)}
          onNotion={() => {
            setPopover(null);
            openNotion(current);
          }}
        />,
        document.body,
      )}
    </div>
  );
}

function HighlightPopover({
  highlight, popover, onClose, onColor, onNote, onDelete, onNotion,
}: {
  highlight: ReaderHighlight;
  popover: Popover;
  onClose: () => void;
  onColor: (c: HlColor) => void;
  onNote: (note: string) => void;
  onDelete: () => void;
  onNotion: () => void;
}) {
  const [note, setNote] = useState(highlight.note);
  const [editing, setEditing] = useState(popover.editNote || !!highlight.note);
  const [confirm, setConfirm] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node) && !(e.target as HTMLElement).closest?.("mark[data-hl]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={box}
      role="dialog"
      aria-label="Surlignage"
      className="fixed z-50 w-[min(320px,calc(100vw-1.5rem))] border border-border bg-bg p-3 text-text shadow-lg"
      style={{ left: popover.x, top: popover.y, transform: `translate(-50%, ${popover.below ? "0" : "-100%"})` }}
    >
      <div className="mb-2 flex items-center gap-1">
        {HL_COLORS.map((c) => (
          <button key={c.id} type="button" onClick={() => onColor(c.id)} aria-label={`Couleur ${c.label.toLowerCase()}`} aria-pressed={highlight.color === c.id}
            className={`grid size-8 place-items-center rounded-full ${highlight.color === c.id ? "ring-2 ring-text" : ""}`}>
            <span className={`size-5 rounded-full hl-swatch hl-${c.id}`} aria-hidden />
          </button>
        ))}
        <button type="button" onClick={onClose} aria-label="Fermer" className="ml-auto grid size-8 place-items-center text-muted hover:text-text"><X className="size-4" /></button>
      </div>
      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); onNote(note); }} className="space-y-2">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus maxLength={2000} placeholder="Ta note…" aria-label="Note"
            className={`${field} resize-y text-sm`}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onNote(note); } }} />
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => { setNote(highlight.note); setEditing(!!highlight.note); }}>Annuler</button>
            <button type="submit" className={btnPrimary}>Enregistrer</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="label inline-flex items-center gap-1.5 py-1 text-muted hover:text-text">
          <StickyNote className="size-3.5" aria-hidden /> Ajouter une note
        </button>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
        <button type="button" onClick={onNotion} className="label inline-flex items-center gap-1.5 py-1 text-muted hover:text-text">
          <GraduationCap className="size-3.5" aria-hidden /> Créer une notion
        </button>
        {confirm ? (
          <span className="flex items-center gap-2 text-xs">
            Supprimer ?
            <button type="button" onClick={onDelete} className="label text-rose-700 hover:underline dark:text-rose-300">Oui</button>
            <button type="button" onClick={() => setConfirm(false)} className="label text-muted hover:text-text">Non</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="label inline-flex items-center gap-1.5 py-1 text-muted hover:text-rose-700">
            <Trash2 className="size-3.5" aria-hidden /> Retirer
          </button>
        )}
      </div>
    </div>
  );
}
