"use client";

import { CalendarPlus } from "lucide-react";
import { useState } from "react";
import { btnGhost, btnPrimary, field, iconBtn } from "@/components/ui/forms";

/**
 * « Planifier » une prochaine action : choisir un jour (aujourd'hui par défaut) et une heure facultative ;
 * l'action quitte la liste du README et devient une tâche datée liée au projet.
 */
export function PlanButton({ text, onPlan }: { text: string; onPlan: (date: string, time: string | null) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const show = () => {
    setDate(new Date().toLocaleDateString("en-CA"));
    setTime("");
    setOpen(true);
  };
  return (
    <span className="relative">
      <button type="button" className={iconBtn} aria-label={`Planifier « ${text} »`} title="Planifier (devient une tâche datée)" onClick={() => (open ? setOpen(false) : show())}>
        <CalendarPlus className="size-4" />
      </button>
      {open && (
        <form
          className="absolute right-0 top-full z-30 mt-1 grid w-64 gap-2 border border-border bg-surface p-3 shadow-lg"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const ok = await onPlan(date, time || null);
            setBusy(false);
            if (ok) setOpen(false);
          }}
        >
          <p className="label text-muted">planifier comme tâche</p>
          <div className="flex gap-2">
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={`${field} py-1 text-sm`} aria-label="Date de la tâche" autoFocus />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${field} w-24 py-1 text-sm`} aria-label="Heure (facultative)" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Annuler</button>
            <button type="submit" className={btnPrimary} disabled={busy}>Planifier</button>
          </div>
        </form>
      )}
    </span>
  );
}
