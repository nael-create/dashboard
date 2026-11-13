"use client";

import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, MapPin, RefreshCw, Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  WEEKDAYS, bucketByDay, fmtDayNum, fmtLongDay, fmtShortDay, fmtWeekday, shift, timeLabel,
  mergeAdjacent, todayInTz, viewTitle, visibleRange, type DisplayEvent, type View, type ViewEvent,
} from "@/lib/calendar-view";
import { CalendarManager, type PublicCalendar, type ZoneInfo } from "./calendar-manager";

interface FeedError { calendarId: string; name: string; message: string; staleSince?: string }
interface Payload {
  calendars: PublicCalendar[];
  events: ViewEvent[];
  errors: FeedError[];
  /** Fuseau appliqué aux heures flottantes de chaque calendrier. */
  zones: Record<string, ZoneInfo>;
  /** Fuseau d'affichage (celui de l'ordinateur, sauf réglage contraire). */
  displayTz: string;
  options: { mergeAdjacent: boolean };
}

const VIEWS: { id: View; label: string }[] = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
];
const VIEW_KEY = "dashboard.calendar.view";

export function CalendarWidget() {
  const [today, setToday] = useState(todayInTz);
  const [view, setView] = useState<View>("day");
  const [cursor, setCursor] = useState(today);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const requestId = useRef(0);
  const displayTzRef = useRef<string | undefined>(undefined);

  // Vue mémorisée dans ce navigateur (confort uniquement).
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "day" || v === "week" || v === "month") setView(v);
    } catch {
      /* stockage indisponible */
    }
  }, []);
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* stockage indisponible */
    }
  };

  // La date du jour change à minuit (fuseau du dashboard).
  useEffect(() => {
    const t = setInterval(() => setToday(todayInTz(displayTzRef.current)), 60_000);
    return () => clearInterval(t);
  }, []);

  const range = useMemo(() => visibleRange(view, cursor), [view, cursor]);

  const load = useCallback(
    async (refresh = false) => {
      const id = ++requestId.current;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const qs = new URLSearchParams({ start: range.start, end: range.end, ...(refresh ? { refresh: "1" } : {}) });
        const res = await fetch(`/api/events?${qs}`, { cache: "no-store" });
        const json = await res.json();
        if (id !== requestId.current) return;
        if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
        setData(json);
        setFatal(null);
        displayTzRef.current = json.displayTz;
        setToday(todayInTz(json.displayTz));
      } catch (e) {
        if (id === requestId.current) setFatal(e instanceof Error ? e.message : String(e));
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [range.start, range.end],
  );

  useEffect(() => {
    load();
  }, [load]);

  const colorOf = useMemo(() => {
    const m = new Map(data?.calendars.map((c) => [c.id, c.color]));
    return (id: string) => m.get(id) ?? "var(--muted)";
  }, [data]);
  // Fusion des événements consécutifs : affichage seulement, les données restent intactes.
  const byDay = useMemo(() => {
    const events = data?.events ?? [];
    return bucketByDay(data?.options.mergeAdjacent === false ? events : mergeAdjacent(events));
  }, [data]);

  const noCalendars = data !== null && data.calendars.length === 0;
  const openDay = (d: string) => {
    setCursor(d);
    changeView("day");
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
      {/* En-tête : titre, navigation, choix de la vue */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-accent-text" aria-hidden />
          <h2 className="truncate text-[15px] font-semibold tracking-tight" aria-live="polite">
            {viewTitle(view, cursor)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-border">
            <IconButton label="Précédent" onClick={() => setCursor(shift(view, cursor, -1))}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <button
              type="button"
              onClick={() => setCursor(today)}
              className="px-2 text-sm text-muted transition-colors hover:text-text disabled:opacity-40"
              disabled={cursor === today}
            >
              Aujourd&apos;hui
            </button>
            <IconButton label="Suivant" onClick={() => setCursor(shift(view, cursor, 1))}>
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
          <div role="tablist" aria-label="Vue du calendrier" className="flex rounded-full bg-surface-2 p-0.5">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                type="button"
                aria-selected={view === v.id}
                onClick={() => changeView(v.id)}
                className={`rounded-full px-3 py-1 text-sm transition-all ${
                  view === v.id ? "bg-surface font-medium text-text shadow-sm" : "text-muted hover:text-text"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <IconButton label="Rafraîchir les calendriers" onClick={() => load(true)} bordered disabled={refreshing}>
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </IconButton>
        </div>
      </header>

      {/* Erreurs par calendrier : les autres continuent de s'afficher */}
      {data?.errors.length ? (
        <ul className="mb-4 space-y-2">
          {data.errors.map((e) => (
            <li key={e.calendarId + e.message} className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong className="font-semibold">« {e.name} »</strong> n&apos;a pas pu être chargé : {e.message}
                {e.staleSince && <span className="opacity-80"> (affichage des données de {e.staleSince})</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {fatal && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {fatal}
        </p>
      )}

      <div className={`transition-opacity duration-200 ${loading && data ? "opacity-50" : ""}`}>
        {!data && loading ? (
          <Skeleton />
        ) : noCalendars ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <p className="mb-1 font-medium">Aucun calendrier pour l&apos;instant</p>
            <p className="mb-4 text-sm text-muted">Colle le lien d&apos;abonnement (ICS) d&apos;Outlook, Google ou iCloud.</p>
            <button
              type="button"
              onClick={() => setManagerOpen(true)}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Ajouter un calendrier
            </button>
          </div>
        ) : view === "day" ? (
          <DayView day={cursor} days={range.days} byDay={byDay} colorOf={colorOf} today={today} />
        ) : view === "week" ? (
          <WeekView days={range.days} byDay={byDay} colorOf={colorOf} today={today} onOpenDay={openDay} />
        ) : (
          <MonthView days={range.days} cursor={cursor} byDay={byDay} colorOf={colorOf} today={today} onOpenDay={openDay} />
        )}
      </div>

      {/* Pied : légende et gestion */}
      {!noCalendars && (
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
            {data?.calendars.map((c) => (
              <li key={c.id} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
                {c.name}
              </li>
            ))}
            {data?.displayTz && <li className="opacity-80" title="Fuseau d'affichage">Heure : {data.displayTz.replace(/_/g, " ")}</li>}
          </ul>
          <button
            type="button"
            onClick={() => setManagerOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent-text"
          >
            <Settings2 className="size-4" aria-hidden /> Gérer les calendriers
          </button>
        </footer>
      )}

      <CalendarManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        calendars={data?.calendars ?? []}
        zones={data?.zones ?? {}}
        mergeAdjacent={data?.options.mergeAdjacent ?? true}
        onChanged={() => load()}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */

type ColorOf = (id: string) => string;

function IconButton({
  label, onClick, children, bordered, disabled,
}: { label: string; onClick: () => void; children: React.ReactNode; bordered?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-60 ${
        bordered ? "border border-border" : ""
      }`}
    >
      {children}
    </button>
  );
}

const mergedHint = (ev: DisplayEvent) =>
  ev.mergedCount && ev.mergedCount > 1 ? `Regroupe ${ev.mergedCount} événements consécutifs` : undefined;

function EventRow({ ev, day, colorOf }: { ev: DisplayEvent; day: string; colorOf: ColorOf }) {
  return (
    <li className="flex gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2" title={mergedHint(ev)}>
      <span className="mt-0.5 w-24 shrink-0 text-sm tabular-nums text-muted">{timeLabel(ev, day)}</span>
      <span className="w-1 shrink-0 self-stretch rounded-full" style={{ background: colorOf(ev.calendarId) }} aria-hidden />
      <span className="min-w-0">
        <span className="block font-medium leading-snug">{ev.title}</span>
        {ev.location && (
          <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
            <MapPin className="size-3 shrink-0" aria-hidden /> {ev.location}
          </span>
        )}
      </span>
    </li>
  );
}

function DayView({
  day, days, byDay, colorOf, today,
}: { day: string; days: string[]; byDay: Map<string, DisplayEvent[]>; colorOf: ColorOf; today: string }) {
  const events = byDay.get(day) ?? [];
  const upcoming = days.slice(1).filter((d) => byDay.get(d)?.length);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <p className="mb-3 text-2xl font-semibold tracking-tight">
          {day === today ? "Aujourd'hui" : fmtLongDay(day)}
          {day === today && <span className="ml-2 text-base font-normal text-muted">{fmtLongDay(day)}</span>}
        </p>
        {events.length ? (
          <ul className="-mx-2">{events.map((ev) => <EventRow key={ev.id} ev={ev} day={day} colorOf={colorOf} />)}</ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            Rien de prévu ce jour-là.
          </p>
        )}
      </div>
      <div className="lg:border-l lg:border-border lg:pl-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Ensuite (7 jours)</p>
        {upcoming.length ? (
          <div className="space-y-4">
            {upcoming.map((d) => (
              <div key={d}>
                <p className={`mb-1 text-sm font-medium ${d === today ? "text-accent-text" : ""}`}>{fmtShortDay(d)}</p>
                <ul className="-mx-2">
                  {byDay.get(d)!.map((ev) => <EventRow key={ev.id} ev={ev} day={d} colorOf={colorOf} />)}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Rien de prévu.</p>
        )}
      </div>
    </div>
  );
}

function Chip({ ev, day, colorOf, wrap }: { ev: DisplayEvent; day: string; colorOf: ColorOf; wrap?: boolean }) {
  const color = colorOf(ev.calendarId);
  const label = timeLabel(ev, day);
  return (
    <li
      className={`rounded-md px-1.5 py-0.5 text-xs leading-5 ${wrap ? "line-clamp-3 break-words" : "truncate"}`}
      style={{ background: `color-mix(in oklab, ${color} 16%, transparent)` }}
      title={`${label} · ${ev.title}${ev.location ? ` · ${ev.location}` : ""}${mergedHint(ev) ? ` (${mergedHint(ev)!.toLowerCase()})` : ""}`}
    >
      {!ev.allDay && label !== "Journée" && (
        <span className="mr-1 tabular-nums text-muted">{label.startsWith("→") ? "→" : label.slice(0, 5)}</span>
      )}
      <span className="font-medium">{ev.title}</span>
    </li>
  );
}

function WeekView({
  days, byDay, colorOf, today, onOpenDay,
}: { days: string[]; byDay: Map<string, DisplayEvent[]>; colorOf: ColorOf; today: string; onOpenDay: (d: string) => void }) {
  return (
    <ol className="grid gap-2 md:grid-cols-7">
      {days.map((d) => {
        const events = byDay.get(d) ?? [];
        const isToday = d === today;
        return (
          <li key={d} className={`min-h-0 rounded-xl border p-2 md:min-h-44 ${isToday ? "border-accent/60 bg-accent-soft/40" : "border-border"}`}>
            <button
              type="button"
              onClick={() => onOpenDay(d)}
              className="mb-1.5 flex w-full items-baseline gap-1.5 rounded-md px-1 text-left transition-colors hover:text-accent-text"
            >
              <span className="text-xs text-muted">{fmtWeekday(d)}</span>
              <span className={`text-sm font-semibold ${isToday ? "text-accent-text" : ""}`}>{fmtDayNum(d)}</span>
            </button>
            {events.length ? (
              <ul className="space-y-1">{events.map((ev) => <Chip key={ev.id} ev={ev} day={d} colorOf={colorOf} wrap />)}</ul>
            ) : (
              <p className="px-1 text-xs text-muted/70">—</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function MonthView({
  days, cursor, byDay, colorOf, today, onOpenDay,
}: { days: string[]; cursor: string; byDay: Map<string, DisplayEvent[]>; colorOf: ColorOf; today: string; onOpenDay: (d: string) => void }) {
  const month = cursor.slice(0, 7);
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-xs text-muted">
        {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const events = byDay.get(d) ?? [];
          const inMonth = d.startsWith(month);
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onOpenDay(d)}
              aria-label={`${fmtLongDay(d)} : ${events.length} événement(s)`}
              className={`flex min-h-14 flex-col items-stretch rounded-lg border p-1 text-left transition-colors hover:border-accent/60 sm:min-h-24 sm:p-1.5 ${
                isToday ? "border-accent/60 bg-accent-soft/40" : "border-border"
              } ${inMonth ? "" : "opacity-45"}`}
            >
              <span className={`mb-1 text-xs font-medium ${isToday ? "text-accent-text" : ""}`}>{fmtDayNum(d)}</span>
              {/* Téléphone : pastilles ; écran large : titres */}
              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {events.slice(0, 4).map((ev) => (
                  <span key={ev.id} className="size-1.5 rounded-full" style={{ background: colorOf(ev.calendarId) }} />
                ))}
              </span>
              <ul className="hidden space-y-0.5 sm:block">
                {events.slice(0, 3).map((ev) => <Chip key={ev.id} ev={ev} day={d} colorOf={colorOf} />)}
                {events.length > 3 && <li className="px-1 text-xs text-muted">+{events.length - 3} autre(s)</li>}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-label="Chargement du calendrier">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-2" />
      ))}
    </div>
  );
}
