"use client";

import { ArrowLeft, ArrowRight, Check, Layers, ListChecks, PenLine, RotateCcw, Shuffle, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiJson } from "@/lib/client-api";
import { afterAnswer, LEARNED_BOX } from "@/lib/leitner";
import { buildDeck, checkWritten, choicesFor, shouldRecord, shuffle, type DeckKind, type PracticeCard } from "@/lib/practice";
import { isTyping } from "@/lib/shortcuts";
import { btnGhost, btnPrimary, field } from "@/components/ui/forms";
import { Flashcard } from "./flashcard";

type Mode = "cartes" | "qcm" | "ecrire";
type Result = "knew" | "again";

const MODES: { id: Mode; label: string; icon: typeof Layers; hint: string }[] = [
  { id: "cartes", label: "Cartes", icon: Layers, hint: "Retourne la carte, puis « Je sais » ou « À revoir »." },
  { id: "qcm", label: "QCM", icon: ListChecks, hint: "Choisis le bon mot parmi quatre." },
  { id: "ecrire", label: "Écrire", icon: PenLine, hint: "Tape le mot (accents et majuscules ignorés)." },
];

const DECKS: { id: DeckKind; label: string }[] = [
  { id: "due", label: "À revoir aujourd'hui" },
  { id: "learning", label: "Pas encore apprises" },
  { id: "all", label: "Toutes" },
];

const pill = (active: boolean) =>
  `label inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors ${
    active ? "border-text bg-text text-bg" : "border-border text-muted hover:border-text hover:text-text"
  }`;

/** Délai lisible avant la prochaine révision. */
const inDays = (d: number) => (d <= 1 ? "demain" : `dans ${d} jours`);

/**
 * Onglet « Travailler » : entraînement façon Quizlet sur les notions (définition devant, mot derrière).
 * Les réponses alimentent la mémoire (Leitner) : « À revoir » toujours ; « Je sais » seulement pour une
 * carte à revoir aujourd'hui (s'entraîner en avance ne fait pas sauter d'étape).
 */
export function Practice({ cards, today, onRecorded }: {
  cards: PracticeCard[];
  today: string;
  onRecorded: (id: string, box: number, due: string) => void;
}) {
  const counts = useMemo(
    () => Object.fromEntries(DECKS.map((d) => [d.id, buildDeck(cards, d.id, today, LEARNED_BOX).length])) as Record<DeckKind, number>,
    [cards, today],
  );
  const [mode, setMode] = useState<Mode>("cartes");
  const [deckKind, setDeckKind] = useState<DeckKind>(counts.due > 0 ? "due" : "all");
  const [shuffled, setShuffled] = useState(true);
  const [queue, setQueue] = useState<PracticeCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [history, setHistory] = useState<number[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // QCM / Écrire
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState<"correct" | "close" | "wrong" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const start = useCallback((list: PracticeCard[], shuffle_ = shuffled) => {
    setQueue(shuffle_ ? shuffle(list) : [...list].sort((a, b) => a.term.localeCompare(b.term, "fr")));
    setIndex(0);
    setFlipped(false);
    setResults({});
    setHistory([]);
    setPicked(null);
    setTyped("");
    setVerdict(null);
    setNote(null);
  }, [shuffled]);

  // Nouveau paquet quand on change de paquet ou d'ordre (pas à chaque mise à jour de la mémoire).
  const deckKey = `${deckKind}|${shuffled}`;
  const lastKey = useRef("");
  useEffect(() => {
    if (lastKey.current === deckKey) return;
    lastKey.current = deckKey;
    start(buildDeck(cards, deckKind, today, LEARNED_BOX));
  }, [deckKey, cards, deckKind, today, start]);

  const card = queue[index];
  const done = queue.length > 0 && index >= queue.length;
  const known = Object.values(results).filter((r) => r === "knew").length;
  const again = Object.values(results).filter((r) => r === "again").length;
  const choices = useMemo(() => (card && mode === "qcm" ? choicesFor(card, cards) : []), [card, mode, cards]);

  const resetCardState = () => {
    setFlipped(false);
    setPicked(null);
    setTyped("");
    setVerdict(null);
  };

  const answer = useCallback(async (knew: boolean) => {
    if (!card) return;
    setError(null);
    setResults((r) => ({ ...r, [card.id]: knew ? "knew" : "again" }));
    setHistory((h) => [...h, index]);
    if (shouldRecord(knew, card, today)) {
      const next = afterAnswer(card.box, knew);
      const due = new Date(`${today}T12:00:00Z`);
      due.setUTCDate(due.getUTCDate() + next.days);
      const dueISO = due.toISOString().slice(0, 10);
      setNote(`« ${card.term} » : prochaine révision ${inDays(next.days)}.`);
      onRecorded(card.id, next.box, dueISO);
      apiJson("/api/notions/review", "POST", { id: card.id, result: knew ? "knew" : "again" }).catch((e) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
    } else {
      setNote(`« ${card.term} » : entraînement libre, ta mémoire n'avance pas avant la date prévue.`);
    }
    resetCardState();
    setIndex((i) => i + 1);
  }, [card, index, today, onRecorded]);

  const undo = () => {
    const prev = history.at(-1);
    if (prev === undefined) return;
    const id = queue[prev]?.id;
    setHistory((h) => h.slice(0, -1));
    if (id) setResults((r) => {
      const { [id]: _removed, ...rest } = r;
      return rest;
    });
    resetCardState();
    setIndex(prev);
    setNote("Retour à la carte précédente (la mémoire déjà enregistrée n'est pas annulée).");
  };

  const submitWritten = () => {
    if (!card || verdict) return;
    setVerdict(checkWritten(card.term, typed));
  };

  // Clavier (jamais pendant la saisie, sauf Entrée dans le champ « Écrire »).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]")) return;
      if (!card) return;
      // Entrée sur un bouton ou dans le formulaire : géré par le bouton lui-même (pas de double réponse).
      const el = e.target as HTMLElement | null;
      if (e.key === "Enter" && el?.closest?.("button, form, [role=button]")) return;
      if (mode === "cartes" && !isTyping(e.target)) {
        if (e.key === " " || e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          setFlipped((f) => !f);
        } else if (e.key === "ArrowLeft" || e.key === "1") {
          e.preventDefault();
          answer(false);
        } else if (e.key === "ArrowRight" || e.key === "2") {
          e.preventDefault();
          answer(true);
        }
      } else if (mode === "qcm" && !isTyping(e.target)) {
        const n = Number(e.key);
        if (!picked && n >= 1 && n <= choices.length) setPicked(choices[n - 1]);
        else if (picked && e.key === "Enter") {
          e.preventDefault();
          answer(picked === card.term);
        }
      } else if (mode === "ecrire" && verdict && e.key === "Enter") {
        e.preventDefault();
        answer(verdict !== "wrong");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, mode, picked, choices, verdict, answer]);

  useEffect(() => {
    if (mode === "ecrire" && card && !verdict) inputRef.current?.focus();
  }, [mode, card, verdict]);

  if (cards.length === 0) {
    return <p className="border-y border-dashed border-border py-8 text-sm text-muted">Ajoute des notions avec une définition pour t&apos;entraîner.</p>;
  }

  const missed = queue.filter((c) => results[c.id] === "again");

  return (
    <div className="mx-auto max-w-3xl">
      {/* Réglages : mode, paquet, ordre */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => { setMode(id); resetCardState(); }} aria-pressed={mode === id} className={pill(mode === id)}>
            <Icon className="size-3.5" aria-hidden /> {label}
          </button>
        ))}
      </div>
      <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border py-3">
        {DECKS.map(({ id, label }) => (
          <button key={id} type="button" onClick={() => setDeckKind(id)} aria-pressed={deckKind === id} disabled={counts[id] === 0}
            className={`label inline-flex items-center gap-1.5 py-1 transition-colors disabled:opacity-40 ${deckKind === id ? "text-text" : "text-muted hover:text-text"}`}>
            <span className={`size-1.5 rounded-full ${deckKind === id ? "bg-accent" : "bg-transparent"}`} aria-hidden />
            {label} ({counts[id]})
          </button>
        ))}
        <button type="button" onClick={() => setShuffled((s) => !s)} aria-pressed={shuffled}
          className={`label ml-auto inline-flex items-center gap-1.5 py-1 transition-colors ${shuffled ? "text-text" : "text-muted hover:text-text"}`}>
          <Shuffle className="size-3.5" aria-hidden /> Mélanger
        </button>
      </div>

      {queue.length === 0 ? (
        <p className="border-y border-dashed border-border py-8 text-sm text-muted">Aucune carte dans ce paquet. Choisis « Toutes ».</p>
      ) : done ? (
        /* Fin de la série */
        <div className="rise border-t border-text/80 pt-6">
          <p className="label text-muted">Série terminée</p>
          <p className="mt-2 text-[clamp(2.5rem,7vw,5rem)] font-light leading-none tracking-[-0.04em]">
            {known} <span className="text-muted">/ {queue.length}</span>
          </p>
          <p className="mt-2 text-sm text-muted">{known} su{known > 1 ? "s" : ""} · {again} à revoir</p>
          {missed.length > 0 && (
            <ul className="mt-6 divide-y divide-border border-y border-border">
              {missed.map((c) => (
                <li key={c.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_2fr] sm:gap-6">
                  <span className="font-medium">{c.term}</span>
                  <span className="text-sm text-muted">{c.definition}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {missed.length > 0 && (
              <button type="button" className={btnPrimary} onClick={() => start(missed)}>
                <RotateCcw className="size-4" aria-hidden /> Revoir les {missed.length} à revoir
              </button>
            )}
            <button type="button" className={btnGhost} onClick={() => start(buildDeck(cards, deckKind, today, LEARNED_BOX))}>
              Recommencer la série
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Progression */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <span className="label inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <span className="grid size-6 place-items-center rounded-full border border-current tabular-nums">{again}</span> À revoir
            </span>
            <span className="label tabular-nums text-muted">{index + 1} / {queue.length}</span>
            <span className="label inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              Je sais <span className="grid size-6 place-items-center rounded-full border border-current tabular-nums">{known}</span>
            </span>
          </div>
          <div className="mb-5 h-px bg-border">
            <div className="h-px bg-text transition-[width] duration-500" style={{ width: `${(index / queue.length) * 100}%` }} />
          </div>

          {mode === "cartes" && card && (
            <>
              <Flashcard card={card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} onSwipe={(d) => answer(d === "right")} />
              <div className="mt-5 grid grid-cols-[auto_1fr_1fr] items-center gap-2">
                <button type="button" onClick={undo} disabled={history.length === 0} aria-label="Carte précédente" title="Carte précédente"
                  className="grid size-11 place-items-center rounded-full border border-border text-muted transition-colors hover:border-text hover:text-text disabled:opacity-30">
                  <Undo2 className="size-4" aria-hidden />
                </button>
                <button type="button" onClick={() => answer(false)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-amber-600/70 text-[12px] uppercase tracking-[0.04em] text-amber-800 transition-colors hover:bg-amber-500/10 dark:text-amber-300">
                  <ArrowLeft className="size-4" aria-hidden /> À revoir
                </button>
                <button type="button" onClick={() => answer(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-emerald-600/70 text-[12px] uppercase tracking-[0.04em] text-emerald-800 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300">
                  Je sais <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
              <p className="mt-3 hidden text-center text-xs text-muted sm:block">Espace : retourner · ← À revoir · → Je sais</p>
              <p className="mt-3 text-center text-xs text-muted sm:hidden">Touche pour retourner · glisse à gauche (à revoir) ou à droite (je sais)</p>
            </>
          )}

          {mode === "qcm" && card && (
            <>
              <Flashcard card={card} flipped={false} onFlip={() => {}} />
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {choices.map((c, i) => {
                  const isRight = c === card.term;
                  const state = !picked ? "" : isRight ? "border-emerald-600 bg-emerald-500/10" : c === picked ? "border-rose-600 bg-rose-500/10" : "opacity-50";
                  return (
                    <button key={c} type="button" disabled={!!picked} onClick={() => setPicked(c)}
                      className={`flex items-center gap-3 border border-border px-4 py-3 text-left transition-colors hover:border-text ${state}`}>
                      <span className="label text-muted">{i + 1}</span>
                      <span className="flex-1">{c}</span>
                      {picked && isRight && <Check className="size-4 text-emerald-600" aria-hidden />}
                      {picked && !isRight && c === picked && <X className="size-4 text-rose-600" aria-hidden />}
                    </button>
                  );
                })}
              </div>
              {picked && (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm">{picked === card.term ? "Bien joué." : <>La réponse : <strong>{card.term}</strong></>}</p>
                  <button type="button" className={btnPrimary} onClick={() => answer(picked === card.term)} autoFocus>Continuer</button>
                </div>
              )}
            </>
          )}

          {mode === "ecrire" && card && (
            <>
              <Flashcard card={card} flipped={verdict !== null && verdict !== "correct"} onFlip={() => {}} />
              <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (verdict) answer(verdict !== "wrong"); else submitWritten(); }}>
                <input ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!!verdict}
                  placeholder="Tape le mot…" aria-label="Ta réponse" autoComplete="off" autoCapitalize="off" spellCheck={false}
                  className={`${field} flex-1 text-lg ${verdict === "correct" || verdict === "close" ? "border-emerald-600" : verdict === "wrong" ? "border-rose-600" : ""}`} />
                <button type="submit" className={btnPrimary}>{verdict ? "Continuer" : "Vérifier"}</button>
              </form>
              {verdict && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p>
                    {verdict === "correct" && "Exact."}
                    {verdict === "close" && <>Presque (faute de frappe) : <strong>{card.term}</strong></>}
                    {verdict === "wrong" && <>La réponse : <strong>{card.term}</strong>{typed.trim() ? <span className="text-muted"> — tu as écrit « {typed.trim()} »</span> : null}</>}
                  </p>
                  {verdict === "wrong" && (
                    <button type="button" className={btnGhost} onClick={() => answer(true)}>J&apos;avais bon</button>
                  )}
                </div>
              )}
              {!verdict && (
                <button type="button" className="label mt-3 text-muted hover:text-text" onClick={() => setVerdict("wrong")}>Je ne sais pas</button>
              )}
            </>
          )}
        </>
      )}

      {note && <p className="mt-6 text-xs text-muted" aria-live="polite">{note}</p>}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <p className="mt-6 border-t border-border pt-3 text-xs text-muted">
        {MODES.find((m) => m.id === mode)?.hint} Mémoire : « À revoir » fait revenir la carte demain ; « Je sais » la fait avancer
        seulement si elle était prévue aujourd&apos;hui.
      </p>
    </div>
  );
}
