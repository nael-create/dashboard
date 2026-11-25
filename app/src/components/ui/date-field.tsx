"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { isIsoDate, longDate, type DatePreset } from "@/lib/fr-dates";
import { DatePopover } from "./date-popover";
import { field } from "./forms";

/**
 * Champ de date en français (« mercredi 25 novembre ») : bouton qui ouvre les raccourcis et le
 * mini-calendrier. Remplace <input type="date">, dont l'affichage suit la langue du navigateur.
 */
export function DateField({
  value, onChange, today, presets = [], label, required = false, className = "",
}: { value: string; onChange: (iso: string) => void; today: string; presets?: DatePreset[]; label: string; required?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const ok = isIsoDate(value);
  return (
    <span className={`relative block ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={`${label} : ${ok ? longDate(value, today) : "aucune"}`}
        className={`${field} flex items-center justify-between gap-2 text-left`}>
        <span className={ok ? "first-letter:uppercase" : "text-muted"}>{ok ? longDate(value, today) : "Choisir une date"}</span>
        <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <DatePopover label={label} presets={presets} value={ok ? value : null} today={today}
          onPick={(d) => { setOpen(false); if (d) onChange(d); else if (!required) onChange(""); }}
          onClose={() => setOpen(false)} removeLabel={required ? "Fermer" : "Retirer"} />
      )}
    </span>
  );
}

/** Lit une heure saisie en français : « 14:30 », « 14h30 », « 14h », « 9 » → « 09:00 ». null si invalide. */
export function parseTime(v: string): string | null {
  const m = v.trim().toLowerCase().match(/^(\d{1,2})(?:\s*[:h.]\s*(\d{2})?)?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * Champ d'heure sur 24 h (« 14:30 », « 14h30 » accepté), jamais AM/PM : texte libre normalisé à la
 * sortie du champ. Vide = pas d'heure (sauf `required`).
 */
export function TimeField({
  value, onChange, label, required = false, className = "", disabled = false,
}: { value: string; onChange: (hhmm: string) => void; label: string; required?: boolean; className?: string; disabled?: boolean }) {
  const [draft, setDraft] = useState(value);
  const [bad, setBad] = useState(false);
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); setDraft(value); setBad(false); }
  return (
    <input
      type="text" inputMode="numeric" autoComplete="off" value={draft} disabled={disabled}
      placeholder="hh:mm" aria-label={label} aria-invalid={bad || undefined} required={required}
      onChange={(e) => { setDraft(e.target.value); setBad(false); }}
      onBlur={() => {
        if (!draft.trim()) { setBad(required); if (!required) onChange(""); return; }
        const t = parseTime(draft);
        if (t) { setDraft(t); onChange(t); } else setBad(true);
      }}
      className={`${field} tabular-nums ${bad ? "border-rose-600" : ""} ${className}`}
    />
  );
}
