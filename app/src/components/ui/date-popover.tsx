"use client";

import { CalendarDays, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DatePreset } from "@/lib/fr-dates";
import { dayMonth } from "@/lib/fr-dates";
import { MiniCalendar } from "./mini-calendar";

/**
 * Petite fenêtre de choix de date, ouverte sous un bouton : raccourcis (« Demain », « Fin du mois »…),
 * « Choisir une date » (mini-calendrier en ligne) et « Retirer ». Échap ou clic à côté ferme.
 * À placer dans un parent `relative`.
 */
export function DatePopover({
  presets, value, today, onPick, onClose, removeLabel = "Retirer", align = "left", label,
}: {
  presets: DatePreset[]; value: string | null; today: string; onPick: (iso: string | null) => void; onClose: () => void;
  removeLabel?: string; align?: "left" | "right"; label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [calendar, setCalendar] = useState(false);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const down = (ev: MouseEvent) => { if (ref.current && !ref.current.contains(ev.target as Node)) onClose(); };
    const key = (ev: KeyboardEvent) => { if (ev.key === "Escape") { ev.stopPropagation(); onClose(); } };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key, true);
    };
  }, [onClose]);

  const item = "flex w-full items-center justify-between gap-6 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 focus-visible:bg-surface-2";
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className={`absolute top-full z-30 mt-1 min-w-56 border border-border bg-bg py-1 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
    >
      {presets.map((p) => (
        <button key={p.label} type="button" className={item} onClick={() => onPick(p.date)}>
          <span>{p.label}</span>
          <span className="label text-muted">{dayMonth(p.date, today)}</span>
        </button>
      ))}
      <button type="button" className={item} aria-expanded={calendar} onClick={() => setCalendar((c) => !c)}>
        <span>Choisir une date</span>
        <CalendarDays className="size-4 text-muted" aria-hidden />
      </button>
      {calendar && (
        <div className="border-y border-border px-3 py-3">
          <MiniCalendar value={value} today={today} onPick={(d) => onPick(d)} autoFocus />
        </div>
      )}
      {value && (
        <button type="button" className={`${item} text-muted`} onClick={() => onPick(null)}>
          <span>{removeLabel}</span>
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
