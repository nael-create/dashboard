"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { longDate, monthGrid, monthTitle, WEEKDAY_INITIALS, WEEKDAY_NAMES } from "@/lib/fr-dates";
import { addDays } from "@/lib/tasks-core";

/**
 * Petit calendrier en français (lundi en premier), sans <input type="date"> : clic sur un jour, ou
 * flèches du clavier (← → ↑ ↓ un jour / une semaine, Page↑/↓ un mois), Entrée pour choisir.
 */
export function MiniCalendar({ value, today, onPick, autoFocus = false }: { value: string | null; today: string; onPick: (iso: string) => void; autoFocus?: boolean }) {
  const start = value ?? today;
  const [cursor, setCursor] = useState(start);
  const [view, setView] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) });
  const grid = useRef<HTMLDivElement>(null);
  const focusNext = useRef(autoFocus);

  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${cursor}"]`)?.focus();
  }, [cursor, view]);

  const go = (iso: string) => {
    focusNext.current = true;
    setCursor(iso);
    setView({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) });
  };
  const shiftMonth = (n: number) => {
    const d = new Date(Date.UTC(view.y, view.m - 1 + n, 1));
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
  };
  const onKey = (ev: React.KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, PageUp: -30, PageDown: 30 }[ev.key];
    if (step === undefined) return;
    ev.preventDefault();
    go(addDays(cursor, step));
  };

  return (
    <div className="w-[16.5rem] select-none text-sm">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mois précédent" className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="font-medium first-letter:uppercase" aria-live="polite">{monthTitle(view.y, view.m)}</span>
        <button type="button" onClick={() => shiftMonth(1)} aria-label="Mois suivant" className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text">
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <div ref={grid} role="grid" aria-label={monthTitle(view.y, view.m)} onKeyDown={onKey}>
        <div role="row" className="grid grid-cols-7">
          {WEEKDAY_INITIALS.map((d, i) => <span key={i} role="columnheader" aria-label={WEEKDAY_NAMES[i]} className="label py-1 text-center text-muted">{d}</span>)}
        </div>
        {monthGrid(view.y, view.m).map((week, wi) => (
          <div key={wi} role="row" className="grid grid-cols-7">
            {week.map((d, i) => d ? (
              <span key={d} role="gridcell" aria-selected={d === value}>
                <button
                  type="button"
                  data-day={d}
                  tabIndex={d === cursor ? 0 : -1}
                  onClick={() => onPick(d)}
                  onFocus={() => setCursor(d)}
                  aria-label={longDate(d, today) + (d === today ? " (aujourd'hui)" : "")}
                  className={`mx-auto grid size-8 place-items-center rounded-full tabular-nums transition-colors ${
                    d === value ? "bg-text text-bg" : d === today ? "text-accent-text ring-1 ring-accent" : d < today ? "text-muted hover:bg-surface-2" : "hover:bg-surface-2"
                  }`}
                >
                  {Number(d.slice(8))}
                </button>
              </span>
            ) : <span key={`x${i}`} role="gridcell" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
