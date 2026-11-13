"use client";

import { MapPin, Repeat, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiJson, isConflict } from "@/lib/client-api";
import { fmtLongDay, timeLabel, type DisplayEvent } from "@/lib/calendar-view";
import { btnDanger, btnGhost, btnPrimary, field, iconBtn } from "@/components/ui/forms";

export type EventDialogState =
  | { mode: "create"; date: string; minutes: number | null }
  | { mode: "edit"; id: string }
  | { mode: "view"; event: DisplayEvent; day: string; calendarName: string; color: string }
  | null;

interface Form {
  title: string;
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  location: string;
  note: string;
  weekly: boolean;
  until: string;
}

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Petite fenêtre du calendrier :
 * - « Perso » : créer (clic sur un créneau libre / un jour), modifier, supprimer (avec confirmation) ;
 * - calendriers abonnés : détails seulement (lecture seule).
 */
export function EventDialog({
  state, onClose, onSaved, persoName, timeZone,
}: { state: EventDialogState; onClose: () => void; onSaved: () => void; persoName: string; timeZone: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [version, setVersion] = useState<string>("");
  const [error, setError] = useState<{ text: string; conflict: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (state && !d.open) d.showModal();
    if (!state && d.open) d.close();
    setError(null);
    setConfirmDelete(false);
    if (state?.mode === "create") {
      const start = state.minutes ?? 9 * 60;
      setForm({
        title: "", date: state.date, allDay: false, startTime: hhmm(start), endTime: hhmm(Math.min(start + 60, 23 * 60 + 59)),
        location: "", note: "", weekly: false, until: "",
      });
    } else if (state?.mode === "edit") {
      setForm(null);
      apiJson<{ event: { title: string; date: string; allDay: boolean; startTime?: string; endTime?: string; location: string; note: string; repeat: string | null; until: string | null }; version: string }>(`/api/agenda/${encodeURIComponent(state.id)}`)
        .then(({ event: e, version: v }) => {
          setVersion(v);
          setForm({
            title: e.title, date: e.date, allDay: e.allDay, startTime: e.startTime ?? "09:00", endTime: e.endTime ?? "10:00",
            location: e.location ?? "", note: e.note ?? "", weekly: e.repeat === "weekly", until: e.until ?? "",
          });
        })
        .catch((err) => setError({ text: err instanceof Error ? err.message : String(err), conflict: false }));
    }
  }, [state]);

  const payload = (f: Form) => ({
    title: f.title, date: f.date, allDay: f.allDay,
    startTime: f.allDay ? undefined : f.startTime, endTime: f.allDay ? undefined : f.endTime,
    location: f.location, note: f.note, repeat: f.weekly ? "weekly" : null, until: f.weekly && f.until ? f.until : null,
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !state) return;
    setBusy(true);
    setError(null);
    try {
      if (state.mode === "create") await apiJson("/api/agenda", "POST", payload(form));
      else if (state.mode === "edit") await apiJson(`/api/agenda/${encodeURIComponent(state.id)}`, "PATCH", { ...payload(form), version });
      onSaved();
      onClose();
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : String(err), conflict: isConflict(err) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (state?.mode !== "edit") return;
    setBusy(true);
    try {
      await apiJson(`/api/agenda/${encodeURIComponent(state.id)}?version=${version}`, "DELETE");
      onSaved();
      onClose();
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : String(err), conflict: isConflict(err) });
    } finally {
      setBusy(false);
    }
  };

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(480px,calc(100vw-2rem))] border border-border bg-bg p-0 text-text backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      {state?.mode === "view" ? (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <p className="label flex items-center gap-2 text-muted">
              <span className="size-2 rounded-full" style={{ background: state.color }} aria-hidden /> {state.calendarName} · lecture seule
            </p>
            <button type="button" onClick={onClose} aria-label="Fermer" className={iconBtn}><X className="size-4" /></button>
          </div>
          <h2 className="text-[clamp(1.6rem,4vw,2.25rem)] font-light leading-[1.05] tracking-[-0.03em]">{state.event.title}</h2>
          <p className="mt-3 text-sm">{fmtLongDay(state.day)} · <span className="tabular-nums">{timeLabel(state.event, state.day)}</span></p>
          {state.event.location && <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-3.5" aria-hidden /> {state.event.location}</p>}
          {state.event.mergedCount && state.event.mergedCount > 1 && (
            <p className="mt-3 text-xs text-muted">Regroupe {state.event.mergedCount} événements consécutifs.</p>
          )}
          <p className="mt-5 border-t border-border pt-3 text-xs text-muted">Les calendriers abonnés se modifient dans Outlook, Google ou iCloud.</p>
        </div>
      ) : (
        <form onSubmit={save} className="p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <h2 className="title-md lowercase">{state?.mode === "edit" ? "modifier l'événement" : "nouvel événement"}</h2>
            <button type="button" onClick={onClose} aria-label="Fermer" className={iconBtn}><X className="size-4" /></button>
          </div>
          {!form ? (
            <div className="h-48 animate-pulse bg-surface-2" />
          ) : (
            <div className="space-y-4">
              <input value={form.title} onChange={(e) => set({ title: e.target.value })} required maxLength={160} autoFocus
                placeholder="Titre" aria-label="Titre" className={`${field} text-lg`} />
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 block text-sm sm:col-span-1">
                  <span className="label mb-1 block text-muted">Date</span>
                  <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} required className={field} />
                </label>
                <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-sm sm:col-span-1">
                  <input type="checkbox" checked={form.allDay} onChange={(e) => set({ allDay: e.target.checked })} className="size-4 accent-[var(--accent)]" />
                  Toute la journée
                </label>
                {!form.allDay && (
                  <>
                    <label className="block text-sm">
                      <span className="label mb-1 block text-muted">Début</span>
                      <input type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} required className={field} />
                    </label>
                    <label className="block text-sm">
                      <span className="label mb-1 block text-muted">Fin</span>
                      <input type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} required className={field} />
                    </label>
                  </>
                )}
              </div>
              <input value={form.location} onChange={(e) => set({ location: e.target.value })} maxLength={200} placeholder="Lieu (facultatif)" aria-label="Lieu" className={field} />
              <textarea value={form.note} onChange={(e) => set({ note: e.target.value })} rows={2} placeholder="Note (facultatif)" aria-label="Note" className={`${field} resize-y`}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit(); }} />
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.weekly} onChange={(e) => set({ weekly: e.target.checked })} className="size-4 accent-[var(--accent)]" />
                  <Repeat className="size-3.5 text-muted" aria-hidden /> Chaque semaine
                </label>
                {form.weekly && (
                  <label className="flex items-center gap-2 text-muted">
                    jusqu&apos;au
                    <input type="date" value={form.until} min={form.date} onChange={(e) => set({ until: e.target.value })} aria-label="Fin de la répétition (facultatif)" className={`${field} w-auto py-1`} />
                  </label>
                )}
              </div>
              <p className="label text-muted">Calendrier « {persoName} » · AGENDA.md · fuseau {timeZone.replace(/_/g, " ")}</p>
              {error && (
                <p className="bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-300">
                  {error.text}
                  {error.conflict && " Ferme et rouvre l'événement pour recharger."}
                </p>
              )}
              {confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2 bg-rose-500/10 px-3 py-2 text-sm">
                  <span className="flex-1">Supprimer « {form.title} »{form.weekly ? " (toutes les semaines)" : ""} ?</span>
                  <button type="button" className={btnDanger} disabled={busy} onClick={remove}>Supprimer</button>
                  <button type="button" className={btnGhost} onClick={() => setConfirmDelete(false)}>Annuler</button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
                  {state?.mode === "edit" ? (
                    <button type="button" className={`${btnGhost} hover:text-rose-700`} onClick={() => setConfirmDelete(true)}>Supprimer</button>
                  ) : <span className="label text-muted">Entrée pour enregistrer</span>}
                  <div className="flex gap-2">
                    <button type="button" className={btnGhost} onClick={onClose}>Annuler</button>
                    <button type="submit" className={btnPrimary} disabled={busy || !form.title.trim()}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      )}
    </dialog>
  );
}
