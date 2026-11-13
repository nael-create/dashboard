"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, MapPin, RefreshCw } from "lucide-react";
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

/** Clic sur un créneau libre (jour + minutes) ou sur un événement : branchés par le calendrier « Perso ». */
export interface CalendarHandlers {
  onSlot?: (day: string, minutes: number | null) => void;
  onEvent?: (ev: DisplayEvent, day: string) => void;
}

const VIEWS: { id: View; label: string }[] = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
];
const VIEW_KEY = "dashboard.calendar.view";

export function CalendarWidget({ handlers = {}, reloadKey = 0, extraActions }: {
  handlers?: CalendarHandlers;
  /** Change de valeur pour forcer un rechargement (après ajout d'un événement). */
  reloadKey?: number;
  extraActions?: React.ReactNode;
} = {}) {
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
  }, [load, reloadKey]);

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

  const textBtn = "label inline-flex items-center gap-1.5 py-1 transition-colors disabled:opacity-40";

  return (
    <div>
      {/* Titre et commandes */}
      <div className="mb-6 grid gap-5 lg:grid-cols-12 lg:items-end">
        <h3 className="text-[clamp(2.25rem,5.5vw,4.75rem)] font-light lowercase leading-[0.95] tracking-[-0.045em] lg:col-span-7" aria-live="polite">
          {viewTitle(view, cursor)}
        </h3>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 lg:col-span-5 lg:justify-end">
          <div className="flex items-center gap-4">
            <button type="button" className={`${textBtn} text-muted hover:text-text`} onClick={() => setCursor(shift(view, cursor, -1))} aria-label="Période précédente">
              <ArrowLeft className="size-3.5" aria-hidden /> Préc.
            </button>
            <button type="button" className={`${textBtn} ${cursor === today ? "text-muted" : "text-text"} link-underline`} onClick={() => setCursor(today)} disabled={cursor === today}>
              Aujourd&apos;hui
            </button>
            <button type="button" className={`${textBtn} text-muted hover:text-text`} onClick={() => setCursor(shift(view, cursor, 1))} aria-label="Période suivante">
              Suiv. <ArrowRight className="size-3.5" aria-hidden />
            </button>
          </div>
          <div role="tablist" aria-label="Vue du calendrier" className="flex items-center gap-4">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                type="button"
                aria-selected={view === v.id}
                onClick={() => changeView(v.id)}
                className={`${textBtn} border-b ${view === v.id ? "border-text text-text" : "border-transparent text-muted hover:text-text"}`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Rafraîchir les calendriers"
            title="Rafraîchir les calendriers"
            className="grid size-9 place-items-center rounded-full border border-border text-muted transition-colors hover:border-text hover:text-text disabled:opacity-60"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
          </button>
        </div>
      </div>

      {/* Erreurs par calendrier : les autres continuent de s'afficher */}
      {data?.errors.length ? (
        <ul className="mb-5 space-y-2">
          {data.errors.map((e) => (
            <li key={e.calendarId + e.message} className="flex items-start gap-2 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-300">
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
        <p className="mb-5 flex items-start gap-2 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {fatal}
        </p>
      )}

      <div className={`transition-opacity duration-300 ${loading && data ? "opacity-50" : ""}`}>
        {!data && loading ? (
          <div className="h-[420px] animate-pulse bg-surface-2" aria-label="Chargement du calendrier" />
        ) : noCalendars ? (
          <div className="border-y border-dashed border-border py-12">
            <p className="title-md mb-2">aucun calendrier pour l&apos;instant</p>
            <p className="mb-5 text-sm text-muted">Colle le lien d&apos;abonnement (ICS) d&apos;Outlook, Google ou iCloud.</p>
            <button type="button" onClick={() => setManagerOpen(true)}
              className="rounded-full bg-text px-4 py-2 text-[12px] font-medium uppercase tracking-[0.04em] text-bg transition-opacity hover:opacity-85">
              Ajouter un calendrier
            </button>
          </div>
        ) : view === "day" ? (
          <DayView day={cursor} days={range.days} byDay={byDay} colorOf={colorOf} today={today} handlers={handlers} />
        ) : view === "week" ? (
          <WeekView days={range.days} byDay={byDay} colorOf={colorOf} today={today} onOpenDay={openDay} handlers={handlers} />
        ) : (
          <MonthView days={range.days} cursor={cursor} byDay={byDay} colorOf={colorOf} today={today} onOpenDay={openDay} handlers={handlers} />
        )}
      </div>

      {/* Pied : légende, fuseau, gestion */}
      {!noCalendars && (
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
          <ul className="label flex flex-wrap items-center gap-x-5 gap-y-2 text-muted">
            {data?.calendars.map((c) => (
              <li key={c.id} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: c.color }} aria-hidden />
                {c.name}
              </li>
            ))}
            {data?.displayTz && <li title="Fuseau d'affichage">Heure — {data.displayTz.replace(/_/g, " ")}</li>}
          </ul>
          <div className="flex items-center gap-5">
            {extraActions}
            <button type="button" onClick={() => setManagerOpen(true)} className="label link-underline text-muted transition-colors hover:text-text">
              Gérer les calendriers
            </button>
          </div>
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
    </div>
  );
}

/* ------------------------------------------------------------------ */

type ColorOf = (id: string) => string;
type ByDay = Map<string, DisplayEvent[]>;

const mergedHint = (ev: DisplayEvent) =>
  ev.mergedCount && ev.mergedCount > 1 ? `Regroupe ${ev.mergedCount} événements consécutifs` : undefined;

/** Ligne d'événement (listes « ensuite », semaine sur téléphone). */
function EventRow({ ev, day, colorOf, onEvent }: { ev: DisplayEvent; day: string; colorOf: ColorOf; onEvent?: CalendarHandlers["onEvent"] }) {
  const body = (
    <>
      <span className="label w-24 shrink-0 pt-0.5 tabular-nums text-muted">{timeLabel(ev, day)}</span>
      <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: colorOf(ev.calendarId) }} aria-hidden />
      <span className="min-w-0 text-left">
        <span className="block leading-snug">{ev.title}</span>
        {ev.location && (
          <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
            <MapPin className="size-3 shrink-0" aria-hidden /> {ev.location}
          </span>
        )}
      </span>
    </>
  );
  return (
    <li title={mergedHint(ev)} className="border-b border-border last:border-b-0">
      {onEvent ? (
        <button type="button" onClick={() => onEvent(ev, day)} className="flex w-full gap-3 py-2.5 transition-colors hover:bg-surface-2/60">{body}</button>
      ) : (
        <div className="flex gap-3 py-2.5">{body}</div>
      )}
    </li>
  );
}

/* --------------------------- Grille horaire --------------------------- */

const HOUR = 44; // hauteur d'une heure (px)
const toMin = (stamp: string) => Number(stamp.slice(11, 13)) * 60 + Number(stamp.slice(14, 16));

interface Placed { ev: DisplayEvent; top: number; height: number; lane: number; lanes: number; start: number; end: number }

/** Position des événements horaires d'un jour, avec colonnes côte à côte s'ils se chevauchent. */
function place(events: DisplayEvent[], day: string): Placed[] {
  const timed = events
    .filter((e) => !e.allDay)
    .map((ev) => {
      const start = ev.start.slice(0, 10) === day ? toMin(ev.start) : 0;
      const endDay = ev.end.slice(0, 10);
      let end = endDay === day ? toMin(ev.end) : endDay > day ? 1440 : start;
      if (end <= start) end = Math.min(1440, start + 30);
      return { ev, start, end };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1));
    for (const p of cluster) p.lanes = lanes;
    out.push(...cluster);
    cluster = [];
  };
  for (const t of timed) {
    if (cluster.length && t.start >= clusterEnd) flush();
    const used = new Set(cluster.filter((p) => p.end > t.start).map((p) => p.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ ...t, top: (t.start / 60) * HOUR, height: Math.max(22, ((t.end - t.start) / 60) * HOUR - 2), lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, t.end);
  }
  if (cluster.length) flush();
  return out;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function TimeGrid({
  days, byDay, colorOf, today, handlers, onOpenDay,
}: { days: string[]; byDay: ByDay; colorOf: ColorOf; today: string; handlers: CalendarHandlers; onOpenDay?: (d: string) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(nowMinutes());
    const t = setInterval(() => setNow(nowMinutes()), 60_000);
    return () => clearInterval(t);
  }, []);
  // Ouvre la grille vers 7 h (ou une heure avant maintenant si on affiche aujourd'hui).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const focus = days.includes(today) ? Math.max(7 * 60, nowMinutes() - 90) : 7 * 60;
    el.scrollTop = (focus / 60) * HOUR;
  }, [days, today]);

  const allDay = days.map((d) => (byDay.get(d) ?? []).filter((e) => e.allDay));
  const hasAllDay = allDay.some((l) => l.length);
  const cols = { gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` };

  const slotClick = (day: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (!handlers.onSlot || e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = Math.max(0, Math.min(1410, Math.floor(((e.clientY - rect.top) / HOUR) * 2) * 30));
    handlers.onSlot(day, minutes);
  };

  return (
    <div className="border-t border-text/80">
      {/* En-têtes des jours (semaine) */}
      {days.length > 1 && (
        <div className="grid border-b border-border" style={cols}>
          <span />
          {days.map((d) => (
            <button key={d} type="button" onClick={() => onOpenDay?.(d)} className="group px-2 py-2 text-left">
              <span className="label block text-muted">{fmtWeekday(d)}</span>
              <span className={`text-2xl font-light tracking-[-0.03em] ${d === today ? "text-accent-text" : ""}`}>
                <span className="link-underline">{fmtDayNum(d)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {/* Journées entières */}
      {hasAllDay && (
        <div className="grid border-b border-border" style={cols}>
          <span className="label self-center pr-2 text-right text-muted">Jour</span>
          {allDay.map((list, i) => (
            <ul key={days[i]} className="space-y-1 border-l border-border p-1">
              {list.map((ev) => (
                <li key={ev.id}>
                  <button type="button" disabled={!handlers.onEvent} onClick={() => handlers.onEvent?.(ev, days[i])}
                    className="block w-full truncate px-1.5 py-0.5 text-left text-xs disabled:cursor-default"
                    style={{ background: `color-mix(in oklab, ${colorOf(ev.calendarId)} 22%, transparent)` }} title={ev.title}>
                    {ev.title}
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
      {/* Heures */}
      <div ref={scroller} className="relative max-h-[560px] overflow-y-auto overscroll-contain">
        <div className="grid" style={{ ...cols, height: 24 * HOUR }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="label absolute right-2 -translate-y-1/2 tabular-nums text-muted" style={{ top: h * HOUR }}>
                {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>
          {days.map((d) => (
            <div
              key={d}
              onClick={(e) => slotClick(d, e)}
              className={`relative border-l border-border ${handlers.onSlot ? "cursor-cell" : ""} ${d === today ? "bg-surface/40" : ""}`}
              style={{ backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${HOUR}px)` }}
              aria-label={handlers.onSlot ? `${fmtLongDay(d)} : cliquer sur une heure libre pour ajouter un événement` : undefined}
            >
              {place(byDay.get(d) ?? [], d).map((p) => {
                const color = colorOf(p.ev.calendarId);
                const label = timeLabel(p.ev, d);
                return (
                  <button
                    key={p.ev.id}
                    type="button"
                    disabled={!handlers.onEvent}
                    onClick={() => handlers.onEvent?.(p.ev, d)}
                    title={`${label} · ${p.ev.title}${p.ev.location ? ` · ${p.ev.location}` : ""}${mergedHint(p.ev) ? ` (${mergedHint(p.ev)!.toLowerCase()})` : ""}`}
                    className="absolute overflow-hidden border-l-2 px-1.5 py-1 text-left text-xs leading-tight transition-[filter] hover:brightness-95 disabled:cursor-default"
                    style={{
                      top: p.top + 1,
                      height: p.height,
                      left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`,
                      width: `calc(${100 / p.lanes}% - 4px)`,
                      borderColor: color,
                      background: `color-mix(in oklab, ${color} 18%, var(--surface))`,
                    }}
                  >
                    <span className="block truncate font-medium">{p.ev.title}</span>
                    {p.height > 34 && <span className="block truncate tabular-nums text-muted">{label}</span>}
                    {p.height > 52 && p.ev.location && <span className="block truncate text-muted">{p.ev.location}</span>}
                  </button>
                );
              })}
              {d === today && now !== null && (
                <span className="pointer-events-none absolute inset-x-0 z-10 border-t border-accent" style={{ top: (now / 60) * HOUR }} aria-hidden>
                  <span className="absolute -left-1 -top-1 size-2 rounded-full bg-accent" />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Vues ------------------------------ */

function DayView({
  day, days, byDay, colorOf, today, handlers,
}: { day: string; days: string[]; byDay: ByDay; colorOf: ColorOf; today: string; handlers: CalendarHandlers }) {
  const upcoming = days.slice(1).filter((d) => byDay.get(d)?.length);
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <p className="label mb-3 text-muted">{day === today ? `Aujourd'hui — ${fmtLongDay(day)}` : fmtLongDay(day)}</p>
        <TimeGrid days={[day]} byDay={byDay} colorOf={colorOf} today={today} handlers={handlers} />
      </div>
      <div className="lg:col-span-4">
        <p className="label mb-3 text-muted">Ensuite — 7 jours</p>
        {upcoming.length ? (
          <div className="space-y-5 border-t border-text/80 pt-3">
            {upcoming.map((d) => (
              <div key={d}>
                <p className={`mb-1 text-lg font-light tracking-[-0.02em] ${d === today ? "text-accent-text" : ""}`}>{fmtShortDay(d).toLowerCase()}</p>
                <ul>{byDay.get(d)!.map((ev) => <EventRow key={ev.id} ev={ev} day={d} colorOf={colorOf} onEvent={handlers.onEvent} />)}</ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="border-t border-text/80 pt-3 text-sm text-muted">Rien de prévu.</p>
        )}
      </div>
    </div>
  );
}

function WeekView({
  days, byDay, colorOf, today, onOpenDay, handlers,
}: { days: string[]; byDay: ByDay; colorOf: ColorOf; today: string; onOpenDay: (d: string) => void; handlers: CalendarHandlers }) {
  return (
    <>
      {/* Grands écrans : grille horaire sur 7 jours */}
      <div className="hidden md:block">
        <TimeGrid days={days} byDay={byDay} colorOf={colorOf} today={today} handlers={handlers} onOpenDay={onOpenDay} />
      </div>
      {/* Téléphone : liste par jour */}
      <ol className="border-t border-text/80 md:hidden">
        {days.map((d) => {
          const events = byDay.get(d) ?? [];
          return (
            <li key={d} className="border-b border-border py-3">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <button type="button" onClick={() => onOpenDay(d)} className={`text-lg font-light tracking-[-0.02em] ${d === today ? "text-accent-text" : ""}`}>
                  <span className="link-underline">{fmtShortDay(d).toLowerCase()}</span>
                </button>
                {handlers.onSlot && (
                  <button type="button" onClick={() => handlers.onSlot!(d, null)} className="label text-muted hover:text-text">+ Ajouter</button>
                )}
              </div>
              {events.length ? (
                <ul>{events.map((ev) => <EventRow key={ev.id} ev={ev} day={d} colorOf={colorOf} onEvent={handlers.onEvent} />)}</ul>
              ) : (
                <p className="text-sm text-muted">—</p>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

function MonthView({
  days, cursor, byDay, colorOf, today, onOpenDay, handlers,
}: { days: string[]; cursor: string; byDay: ByDay; colorOf: ColorOf; today: string; onOpenDay: (d: string) => void; handlers: CalendarHandlers }) {
  const month = cursor.slice(0, 7);
  return (
    <div className="border-t border-text/80">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((w) => <div key={w} className="label py-2 text-muted">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const events = byDay.get(d) ?? [];
          const inMonth = d.startsWith(month);
          const isToday = d === today;
          return (
            <div
              key={d}
              role={handlers.onSlot ? "button" : undefined}
              tabIndex={handlers.onSlot ? 0 : undefined}
              onClick={(e) => {
                if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.cell) return;
                if (handlers.onSlot) handlers.onSlot(d, null);
                else onOpenDay(d);
              }}
              onKeyDown={(e) => {
                if (handlers.onSlot && (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                  e.preventDefault();
                  handlers.onSlot(d, null);
                }
              }}
              aria-label={`${fmtLongDay(d)} : ${events.length} événement(s)${handlers.onSlot ? " — ajouter un événement" : ""}`}
              className={`group flex min-h-16 flex-col border-b border-border p-1 text-left transition-colors hover:bg-surface/60 sm:min-h-28 sm:p-2 ${i % 7 ? "border-l" : ""} ${inMonth ? "" : "opacity-45"} ${handlers.onSlot ? "cursor-cell" : "cursor-pointer"}`}
            >
              <button type="button" onClick={() => onOpenDay(d)} className={`mb-1 self-start text-sm font-light tabular-nums sm:text-lg ${isToday ? "rounded-full bg-accent px-1.5 text-white" : ""}`} aria-label={`Voir le ${fmtLongDay(d)}`}>
                {fmtDayNum(d)}
              </button>
              {/* Téléphone : pastilles ; écran large : titres */}
              <span data-cell="1" className="flex flex-wrap gap-0.5 sm:hidden">
                {events.slice(0, 4).map((ev) => <span key={ev.id} data-cell="1" className="size-1.5 rounded-full" style={{ background: colorOf(ev.calendarId) }} />)}
              </span>
              <ul data-cell="1" className="hidden space-y-0.5 sm:block">
                {events.slice(0, 3).map((ev) => {
                  const label = timeLabel(ev, d);
                  return (
                    <li key={ev.id}>
                      <button type="button" disabled={!handlers.onEvent} onClick={() => handlers.onEvent?.(ev, d)}
                        className="block w-full truncate px-1 text-left text-xs leading-5 disabled:cursor-default"
                        style={{ background: `color-mix(in oklab, ${colorOf(ev.calendarId)} 16%, transparent)` }}
                        title={`${label} · ${ev.title}${mergedHint(ev) ? ` (${mergedHint(ev)!.toLowerCase()})` : ""}`}>
                        {!ev.allDay && label !== "Journée" && <span className="mr-1 tabular-nums text-muted">{label.startsWith("→") ? "→" : label.slice(0, 5)}</span>}
                        {ev.title}
                      </button>
                    </li>
                  );
                })}
                {events.length > 3 && <li data-cell="1" className="label px-1 text-muted">+{events.length - 3}</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
