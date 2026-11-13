"use client";

import { Check, Globe, Lock, Plus, Trash2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface PublicCalendar { id: string; name: string; color: string; host: string; timeZone: string | null }
export interface ZoneInfo { source: "calendar" | "x-wr-timezone" | "vtimezone" | "display"; name: string }

const SOURCE_LABELS: Record<ZoneInfo["source"], string> = {
  calendar: "choisi ici",
  "x-wr-timezone": "indiqué par le calendrier",
  vtimezone: "déclaré dans le fichier",
  display: "fuseau de l'ordinateur",
};

/** Liste des fuseaux IANA connus du navigateur (pour la recherche). */
function useTimeZones(): string[] {
  return useMemo(() => {
    try {
      const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
      return list.includes("UTC") ? list : ["UTC", ...list];
    } catch {
      return ["UTC"];
    }
  }, []);
}

/** Couleurs proposées par défaut (chaque calendrier a la sienne). */
const PRESETS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#14b8a6", "#f97316"];

async function api(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
  return json;
}

export function CalendarManager({
  open, onClose, calendars, zones, mergeAdjacent, onChanged,
}: {
  open: boolean; onClose: () => void; calendars: PublicCalendar[]; zones: Record<string, ZoneInfo>;
  mergeAdjacent: boolean; onChanged: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const timeZones = useTimeZones();
  const listId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(560px,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-text shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
        <header className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Calendriers</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text">
            <X className="size-4" />
          </button>
        </header>

        {calendars.length > 0 && (
          <>
            <datalist id={listId}>
              {timeZones.map((z) => <option key={z} value={z} />)}
            </datalist>
            <ul className="mb-4 space-y-2">
              {calendars.map((c) => (
                <CalendarRow key={c.id} cal={c} zone={zones[c.id]} listId={listId} timeZones={timeZones} onChanged={onChanged} />
              ))}
            </ul>
            <MergeToggle value={mergeAdjacent} onChanged={onChanged} />
          </>
        )}

        {/* Recréé à chaque ouverture : la couleur proposée est une couleur encore libre. */}
        <AddForm key={open ? "open" : "closed"} used={calendars.map((c) => c.color)} onAdded={onChanged} />
      </div>
    </dialog>
  );
}

function ColorPicker({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={label}>
      {PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className="grid size-6 place-items-center rounded-full transition-transform hover:scale-110"
          style={{ background: c }}
        >
          {value === c && <Check className="size-3.5 text-white" />}
        </button>
      ))}
      <label className="relative grid size-6 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-border text-muted" title="Autre couleur">
        <Plus className="size-3.5" />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Autre couleur" />
      </label>
    </div>
  );
}

function MergeToggle({ value, onChanged }: { value: boolean; onChanged: () => void }) {
  const [on, setOn] = useState(value);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setOn(value), [value]);
  const toggle = async () => {
    const next = !on;
    setOn(next);
    setError(null);
    try {
      await api("/api/calendar-options", { method: "PATCH", body: JSON.stringify({ mergeAdjacent: next }) });
      onChanged();
    } catch (e) {
      setOn(!next);
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="mb-6 rounded-xl border border-border p-3">
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <span>
          <span className="block text-sm font-medium">Regrouper les événements consécutifs</span>
          <span className="mt-0.5 block text-xs text-muted">
            Même calendrier, même titre et même lieu, l&apos;un finissant quand l&apos;autre commence (ex. 08:00–11:00).
            Affichage seulement : les événements d&apos;origine ne changent pas.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={toggle}
          className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-border"}`}
        >
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
        </button>
      </label>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}

function TimeZoneField({
  cal, zone, listId, timeZones, onSave,
}: { cal: PublicCalendar; zone?: ZoneInfo; listId: string; timeZones: string[]; onSave: (tz: string | null) => Promise<boolean> }) {
  const [value, setValue] = useState(cal.timeZone ?? "");
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setValue(cal.timeZone ?? ""), [cal.timeZone]);

  const commit = async () => {
    const v = value.trim();
    if ((v || null) === cal.timeZone) return setInvalid(false);
    if (v && !timeZones.includes(v)) return setInvalid(true);
    setInvalid(false);
    if (!(await onSave(v || null))) setValue(cal.timeZone ?? "");
  };

  const auto = zone && zone.source !== "calendar" ? `${zone.name.replace(/_/g, " ")} (${SOURCE_LABELS[zone.source]})` : null;

  return (
    <div className="mt-2 pl-5">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="flex items-center gap-1 text-muted"><Globe className="size-3.5" aria-hidden /> Fuseau horaire</span>
        <input
          value={value}
          list={listId}
          onChange={(e) => { setValue(e.target.value); setInvalid(false); }}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          placeholder="Automatique — tape pour chercher (ex. Paris)"
          spellCheck={false}
          autoComplete="off"
          className={`min-w-0 flex-1 rounded-md border bg-bg px-2 py-1 text-sm outline-none transition-colors focus:border-accent ${invalid ? "border-rose-500" : "border-border"}`}
        />
        {value && (
          <button type="button" onClick={() => { setValue(""); onSave(null); }} className="text-xs text-muted underline-offset-2 hover:text-text hover:underline">
            Automatique
          </button>
        )}
      </label>
      <p className="mt-1 text-xs text-muted">
        {invalid
          ? "Fuseau inconnu : choisis-en un dans la liste (ex. Europe/Paris)."
          : value
            ? "Appliqué aux heures sans fuseau de ce calendrier."
            : auto
              ? `Automatique : ${auto}.`
              : "Automatique."}
      </p>
    </div>
  );
}

function CalendarRow({
  cal, zone, listId, timeZones, onChanged,
}: { cal: PublicCalendar; zone?: ZoneInfo; listId: string; timeZones: string[]; onChanged: () => void }) {
  const [name, setName] = useState(cal.name);
  const [color, setColor] = useState(cal.color);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (patch: { name?: string; color?: string; timeZone?: string | null }) => {
    setError(null);
    try {
      await api(`/api/calendars/${cal.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/api/calendars/${cal.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <span className="size-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== cal.name && save({ name: name.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label="Nom du calendrier"
          className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 font-medium outline-none transition-colors hover:bg-surface-2 focus:bg-surface-2"
        />
        {confirming ? (
          <span className="flex items-center gap-1.5 text-sm">
            <span className="text-muted">Supprimer ?</span>
            <button type="button" onClick={remove} disabled={busy} className="rounded-full bg-rose-600 px-2.5 py-0.5 text-white hover:bg-rose-700">Oui</button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-full px-2 py-0.5 text-muted hover:bg-surface-2">Non</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} aria-label={`Supprimer « ${cal.name} »`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-rose-600">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-5">
        <ColorPicker value={color} label={`Couleur de « ${cal.name} »`} onChange={(c) => { setColor(c); save({ color: c }); }} />
        <span className="text-xs text-muted">{cal.host}</span>
      </div>
      <TimeZoneField cal={cal} zone={zone} listId={listId} timeZones={timeZones} onSave={(tz) => save({ timeZone: tz })} />
      {error && <p className="mt-2 pl-5 text-sm text-rose-600">{error}</p>}
    </li>
  );
}

function AddForm({ used, onAdded }: { used: string[]; onAdded: () => void }) {
  const firstFree = PRESETS.find((c) => !used.includes(c)) ?? PRESETS[0];
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState(firstFree);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const json = await api("/api/calendars", { method: "POST", body: JSON.stringify({ name, url, color }) });
      setMessage({ ok: true, text: `« ${json.calendar.name} » ajouté (${json.eventCount} événement(s) dans le flux).` });
      setName("");
      setUrl("");
      setColor(PRESETS.find((c) => c !== color && !used.includes(c)) ?? PRESETS[0]);
      onAdded();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-surface-2 p-4">
      <h3 className="font-medium">Ajouter un calendrier</h3>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Nom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="ex. Travail" className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Lien d&apos;abonnement (ICS / iCal)</span>
        <input
          value={url} onChange={(e) => setUrl(e.target.value)} required
          placeholder="https://… ou webcal://…" autoComplete="off" spellCheck={false} inputMode="url"
          className={`${field} font-mono text-xs`}
        />
      </label>
      <div className="text-sm">
        <span className="mb-1.5 block text-muted">Couleur</span>
        <ColorPicker value={color} onChange={setColor} label="Couleur du nouveau calendrier" />
      </div>
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <Lock className="mt-px size-3.5 shrink-0" aria-hidden />
        Ce lien est secret : il reste sur ton ordinateur (app/data/calendars.local.json) et n&apos;est jamais envoyé sur GitHub.
      </p>
      {message && <p className={`text-sm ${message.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>{message.text}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Vérification du lien…" : "Ajouter"}
      </button>
    </form>
  );
}
