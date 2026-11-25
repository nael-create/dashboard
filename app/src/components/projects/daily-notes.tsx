"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { longDate } from "@/lib/fr-dates";

export interface DayNote { date: string; text: string; done: string[] }
/** Enregistre la note d'un jour ; renvoie un message d'erreur, ou null si c'est enregistré. */
export type SaveNote = (date: string, text: string) => Promise<string | null>;

const VISIBLE_DAYS = 7;
const AUTOSAVE_MS = 900;

/**
 * Colonne « notes » : la note du jour (zone de texte, Markdown accepté, enregistrée toute seule quand
 * on arrête d'écrire — « enregistré »), puis les jours précédents, du plus récent au plus ancien, avec
 * leur note (cliquer pour modifier) et les tâches faites ce jour-là (« ✓ … »). Jours vides masqués ;
 * au-delà des 7 plus récents, « voir les jours précédents ».
 */
export function DailyNotes({ notes, today, save }: { notes: DayNote[]; today: string; save: SaveNote }) {
  const [showAll, setShowAll] = useState(false);
  const todayNote = notes.find((n) => n.date === today);
  const past = notes.filter((n) => n.date !== today && (n.text.trim() || n.done.length)).sort((a, b) => b.date.localeCompare(a.date));
  const shown = showAll ? past : past.slice(0, VISIBLE_DAYS);

  return (
    <section aria-labelledby="notes-titre">
      <h2 id="notes-titre" className="section-title mb-4">notes</h2>
      <div>
        <h3 className="label mb-2 text-muted first-letter:uppercase">{longDate(today)}</h3>
        <NoteEditor date={today} initial={todayNote?.text ?? ""} save={save} placeholder="Ce qui s'est passé aujourd'hui, idées, décisions… (Markdown accepté)" rows={6} autosave />
        {todayNote && todayNote.done.length > 0 && <DoneList items={todayNote.done} />}
      </div>

      {shown.length > 0 && (
        <ol className="mt-8 space-y-6 border-t border-border pt-6">
          {shown.map((n) => (
            <li key={n.date}>
              <h3 className="label mb-1.5 text-muted first-letter:uppercase">{longDate(n.date, today)}</h3>
              <PastNote note={n} save={save} />
              {n.done.length > 0 && <DoneList items={n.done} />}
            </li>
          ))}
        </ol>
      )}
      {!showAll && past.length > VISIBLE_DAYS && (
        <button type="button" onClick={() => setShowAll(true)} className="label mt-6 text-muted underline-offset-4 hover:text-text hover:underline">
          voir les jours précédents ({past.length - VISIBLE_DAYS})
        </button>
      )}
    </section>
  );
}

function DoneList({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 space-y-0.5 text-sm text-muted" aria-label="Tâches faites ce jour-là">
      {items.map((t, i) => <li key={i}><span className="text-accent-text" aria-hidden>✓ </span><span className="sr-only">Fait : </span>{t}</li>)}
    </ul>
  );
}

function PastNote({ note, save }: { note: DayNote; save: SaveNote }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <NoteEditor date={note.date} initial={note.text} save={save} rows={4} autosave autoFocus onDone={() => setEditing(false)} />;
  if (!note.text.trim()) {
    return <button type="button" onClick={() => setEditing(true)} className="text-sm text-muted hover:text-text">+ ajouter une note</button>;
  }
  return (
    <button type="button" onClick={() => setEditing(true)} className="block w-full text-left" aria-label={`Modifier la note du ${longDate(note.date)}`}>
      <div className="md text-sm hover:text-text/80"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={["a"]} unwrapDisallowed>{note.text}</ReactMarkdown></div>
    </button>
  );
}

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

function NoteEditor({
  date, initial, save, placeholder, rows, autosave, autoFocus, onDone,
}: { date: string; initial: string; save: SaveNote; placeholder?: string; rows: number; autosave?: boolean; autoFocus?: boolean; onDone?: () => void }) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saved = useRef(initial);
  const latest = useRef(initial);
  const dirty = useRef(false);

  // Contenu relu ailleurs (tâche cochée, autre onglet) : on le reprend si l'on n'est pas en train d'écrire.
  useEffect(() => {
    if (!dirty.current && initial !== latest.current) {
      setText(initial);
      latest.current = initial;
      saved.current = initial;
    }
  }, [initial]);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const value = latest.current;
    if (value === saved.current) { dirty.current = false; setState((s) => (s === "pending" ? "idle" : s)); return; }
    setState("saving");
    const err = await save(date, value);
    if (err) { setState("error"); setError(err); return; }
    saved.current = value;
    if (latest.current === value) dirty.current = false;
    setError(null);
    setState(latest.current === value ? "saved" : "pending");
  }, [date, save]);

  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); flush(); } }, [flush]);

  return (
    <div>
      <textarea
        value={text}
        autoFocus={autoFocus}
        rows={rows}
        placeholder={placeholder}
        aria-label={`Note du ${longDate(date)}`}
        maxLength={20_000}
        onChange={(e) => {
          setText(e.target.value);
          latest.current = e.target.value;
          dirty.current = true;
          setState("pending");
          if (autosave) {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(flush, AUTOSAVE_MS);
          }
        }}
        onBlur={async () => { await flush(); onDone?.(); }}
        onKeyDown={(e) => { if (e.key === "Escape" && onDone) (e.target as HTMLTextAreaElement).blur(); }}
        className="block w-full resize-y border border-border bg-surface px-3 py-2 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-muted/80 focus:border-text"
      />
      <p className="mt-1 h-4 text-right text-[11px] text-muted" aria-live="polite">
        {state === "saving" ? "enregistrement…" : state === "saved" ? "enregistré" : state === "error" ? <span className="text-rose-700 dark:text-rose-400">{error}</span> : ""}
      </p>
    </div>
  );
}
