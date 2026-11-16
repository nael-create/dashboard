"use client";

import { ArrowUpRight, GraduationCap, Search, StickyNote, Trash2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { apiJson, isConflict } from "@/lib/client-api";
import { fold } from "@/lib/slug";
import { EVENTS } from "@/lib/shortcuts";
import { formatISODate } from "@/lib/dates";
import { btnGhost, btnPrimary, field } from "@/components/ui/forms";
import { Notice } from "@/components/ui/notice";
import { StarButton } from "@/components/favorites/favorites-context";
import { HL_COLORS, type HlColor } from "@/components/newsletters/newsletter-reader";

export interface BoardHighlight {
  id: string;
  date: string;
  subject: string;
  color: HlColor;
  from: string;
  received: string;
  link: string;
  text: string;
  note: string;
}

type Group = "date" | "newsletter";

const senderName = (from: string) => from.replace(/\s*<[^>]*>\s*$/, "").trim() || from;
const receivedDay = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : "");

/**
 * Page « Surlignages » : tous les passages surlignés dans les newsletters.
 * Chronologique (plus récent d'abord) ou groupé par newsletter ; filtres couleur et expéditeur ;
 * recherche instantanée (texte, note, objet, expéditeur).
 */
export function HighlightsBoard({
  initial, initialVersion, status,
}: { initial: BoardHighlight[]; initialVersion: string; status: Record<string, "found" | "missing"> }) {
  const [items, setItems] = useState(initial);
  const [version, setVersion] = useState(initialVersion);
  const [q, setQ] = useState("");
  const [color, setColor] = useState<HlColor | null>(null);
  const [sender, setSender] = useState("");
  const [group, setGroup] = useState<Group>("date");
  const [error, setError] = useState<{ text: string; conflict: boolean } | null>(null);

  const senders = useMemo(() => [...new Set(items.map((h) => senderName(h.from)))].sort((a, b) => a.localeCompare(b, "fr")), [items]);

  const shown = useMemo(() => {
    const f = fold(q.trim());
    return items.filter((h) =>
      (!color || h.color === color) &&
      (!sender || senderName(h.from) === sender) &&
      (!f || fold(`${h.text} ${h.note} ${h.subject} ${h.from}`).includes(f)));
  }, [items, q, color, sender]);

  const groups = useMemo(() => {
    if (group === "date") return [{ key: "all", title: "", items: shown }];
    const map = new Map<string, { key: string; title: string; meta: string; items: BoardHighlight[] }>();
    for (const h of shown) {
      const key = h.link || `${h.subject}|${h.received}`;
      if (!map.has(key)) map.set(key, { key, title: h.subject, meta: [senderName(h.from), receivedDay(h.received) && formatISODate(receivedDay(h.received))].filter(Boolean).join(" · "), items: [] });
      map.get(key)!.items.push(h);
    }
    return [...map.values()];
  }, [shown, group]);

  // Arrivée sur /surlignages#hl-… : défile jusqu'au surlignage et le signale.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    el?.scrollIntoView({ block: "center" });
    el?.classList.add("hl-flash");
  }, []);

  const fail = (e: unknown) => setError({ text: e instanceof Error ? e.message : String(e), conflict: isConflict(e) });
  const reload = async () => {
    const d = await apiJson<{ highlights: BoardHighlight[]; version: string }>("/api/highlights");
    setItems(d.highlights);
    setVersion(d.version);
    setError(null);
  };

  const patch = async (id: string, body: { color?: HlColor; note?: string }) => {
    setError(null);
    try {
      const res = await apiJson<{ version: string }>(`/api/highlights/${id}`, "PATCH", { version, ...body });
      setVersion(res.version);
      setItems((all) => all.map((h) => (h.id === id ? { ...h, ...body } : h)));
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
      setItems((all) => all.filter((h) => h.id !== id));
      window.dispatchEvent(new Event(EVENTS.contentChanged));
    } catch (e) {
      fail(e);
    }
  };

  if (items.length === 0) {
    return (
      <p className="border-y border-dashed border-border py-10 text-sm text-muted">
        Aucun surlignage pour l&apos;instant. Ouvre une newsletter, sélectionne un passage et choisis une couleur.
      </p>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4">
          <Notice action={error.conflict ? <button type="button" className="text-sm font-medium underline" onClick={reload}>Recharger</button> : undefined}>{error.text}</Notice>
        </div>
      )}

      {/* Recherche et filtres */}
      <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-border py-3">
        <label className="relative block min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans les passages, notes, objets, expéditeurs…" aria-label="Rechercher" className={`${field} pl-9`} />
        </label>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1" role="group" aria-label="Couleur">
            {HL_COLORS.map((c) => (
              <button key={c.id} type="button" onClick={() => setColor((cur) => (cur === c.id ? null : c.id))} aria-pressed={color === c.id} aria-label={`Filtrer : ${c.label.toLowerCase()}`}
                className={`grid size-8 place-items-center rounded-full ${color === c.id ? "ring-2 ring-text" : ""}`}>
                <span className={`size-5 rounded-full hl-swatch hl-${c.id}`} aria-hidden />
              </button>
            ))}
          </div>
          <select value={sender} onChange={(e) => setSender(e.target.value)} aria-label="Expéditeur" className={`${field.replace("w-full", "")} w-auto max-w-[14rem] py-1.5 text-sm`}>
            <option value="">Tous les expéditeurs</option>
            {senders.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex items-center gap-3" role="group" aria-label="Affichage">
            {([["date", "Chronologique"], ["newsletter", "Par newsletter"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setGroup(id)} aria-pressed={group === id}
                className={`label inline-flex items-center gap-1.5 py-1 ${group === id ? "text-text" : "text-muted hover:text-text"}`}>
                <span className={`size-1.5 rounded-full ${group === id ? "bg-accent" : "bg-transparent"}`} aria-hidden /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="label mb-4 text-muted">{shown.length} surlignage{shown.length > 1 ? "s" : ""}{shown.length !== items.length ? ` sur ${items.length}` : ""}</p>

      {shown.length === 0 ? (
        <p className="border-y border-dashed border-border py-8 text-sm text-muted">Aucun surlignage ne correspond.</p>
      ) : (
        groups.map((g) => (
          <Fragment key={g.key}>
            {group === "newsletter" && (
              <header className="mb-4 mt-10 border-t border-text/80 pt-3 first:mt-0">
                <h2 className="title-md">{g.title}</h2>
                {"meta" in g && g.meta && <p className="label mt-1 text-muted">{g.meta}</p>}
              </header>
            )}
            <ol className="divide-y divide-border border-y border-border">
              {g.items.map((h) => (
                <HighlightRow key={h.id} h={h} missing={status[h.id] === "missing"} compact={group === "newsletter"}
                  onColor={(c) => patch(h.id, { color: c })} onNote={(n) => patch(h.id, { note: n })} onDelete={() => remove(h.id)} />
              ))}
            </ol>
          </Fragment>
        ))
      )}
    </div>
  );
}

function HighlightRow({
  h, missing, compact, onColor, onNote, onDelete,
}: {
  h: BoardHighlight;
  missing: boolean;
  compact: boolean;
  onColor: (c: HlColor) => void;
  onNote: (note: string) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(h.note);
  const [confirm, setConfirm] = useState(false);

  const createNotion = () =>
    window.dispatchEvent(new CustomEvent(EVENTS.newNotion, {
      detail: { definition: h.text, example: `${h.subject} — ${senderName(h.from)}`, highlight: h.id },
    }));

  return (
    <li id={h.id} className="scroll-mt-28 py-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <blockquote className="text-[clamp(1.05rem,1.5vw,1.25rem)] font-light leading-snug">
            <mark className={`hl hl-${h.color} cursor-text`}>{h.text}</mark>
          </blockquote>
          {editing ? (
            <form className="mt-3 max-w-xl space-y-2" onSubmit={async (e) => { e.preventDefault(); if (await onNote(note)) setEditing(false); }}>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus maxLength={2000} placeholder="Ta note…" aria-label="Note" className={`${field} resize-y text-sm`}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
              <div className="flex gap-2">
                <button type="submit" className={btnPrimary}>Enregistrer</button>
                <button type="button" className={btnGhost} onClick={() => { setNote(h.note); setEditing(false); }}>Annuler</button>
              </div>
            </form>
          ) : (
            h.note && <p className="mt-3 max-w-xl whitespace-pre-line border-l border-text/60 pl-3 text-sm">{h.note}</p>
          )}
          <p className="label mt-3 text-muted">
            {!compact && <>{h.subject} · {senderName(h.from)}{receivedDay(h.received) && ` · ${formatISODate(receivedDay(h.received))}`} · </>}
            surligné le {formatISODate(h.date)}
            {missing && <span className="ml-2 text-amber-700 dark:text-amber-400">· introuvable dans le mail</span>}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2 lg:flex-col lg:items-end">
          <a href={`/surlignages/ouvrir/${encodeURIComponent(h.id)}`} className="label link-underline inline-flex items-center gap-1 text-text">
            Ouvrir dans la newsletter <ArrowUpRight className="size-3" aria-hidden />
          </a>
          <div className="flex items-center gap-0.5" role="group" aria-label="Couleur">
            {HL_COLORS.map((c) => (
              <button key={c.id} type="button" onClick={() => onColor(c.id)} aria-pressed={h.color === c.id} aria-label={`Couleur ${c.label.toLowerCase()}`}
                className={`grid size-7 place-items-center rounded-full ${h.color === c.id ? "ring-2 ring-text" : ""}`}>
                <span className={`size-4 rounded-full hl-swatch hl-${c.id}`} aria-hidden />
              </button>
            ))}
            <StarButton type="highlight" refId={`highlight:${h.id}`} title={h.text.length > 90 ? `${h.text.slice(0, 90)}…` : h.text} source={h.subject} published={receivedDay(h.received) || null} />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setEditing(true)} className="label inline-flex items-center gap-1 text-muted hover:text-text">
              <StickyNote className="size-3.5" aria-hidden /> {h.note ? "Modifier la note" : "Note"}
            </button>
            <button type="button" onClick={createNotion} className="label inline-flex items-center gap-1 text-muted hover:text-text">
              <GraduationCap className="size-3.5" aria-hidden /> Créer une notion
            </button>
            {confirm ? (
              <span className="flex items-center gap-2 text-xs">
                Supprimer ?
                <button type="button" onClick={onDelete} className="label text-rose-700 hover:underline dark:text-rose-300">Oui</button>
                <button type="button" onClick={() => setConfirm(false)} className="label text-muted hover:text-text">Non</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} aria-label="Supprimer ce surlignage" className="label inline-flex items-center gap-1 text-muted hover:text-rose-700">
                <Trash2 className="size-3.5" aria-hidden /> Supprimer
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
