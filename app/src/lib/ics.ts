/**
 * Téléchargement (côté serveur), cache en mémoire et développement des flux ICS.
 * - Récurrences (RRULE, RDATE, EXDATE) et occurrences modifiées (RECURRENCE-ID) via ical.js.
 * - Fuseaux : VTIMEZONE du flux, sinon TZID IANA / Windows.
 * - Heures « flottantes » (ni TZID ni Z) : fuseau choisi pour le calendrier, sinon X-WR-TIMEZONE,
 *   sinon l'unique VTIMEZONE du fichier, sinon le fuseau d'affichage.
 * - Rien n'est écrit sur disque : le cache vit uniquement en mémoire.
 */
import ICAL from "ical.js";
import type { StoredCalendar } from "./calendar-store";
import { displayTimeZone } from "./display-tz";
import { instantFromWallTime, isValidTimeZone, localStamp, resolveTimeZone } from "./tz";

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_ITERATIONS = 100_000;

export interface CalEvent {
  id: string;
  calendarId: string;
  title: string;
  allDay: boolean;
  /** Journée entière : « YYYY-MM-DD » ; sinon « YYYY-MM-DDTHH:mm » dans le fuseau du dashboard. */
  start: string;
  /** Exclusif. Même format que start. */
  end: string;
  location?: string;
  /** Calendrier « Perso » (AGENDA.md) : identifiant de l'événement d'origine, modifiable. */
  sourceId?: string;
  editable?: boolean;
}

export interface FeedError {
  calendarId: string;
  name: string;
  message: string;
  /** Heure (HH:mm) des données de secours affichées, s'il y en a. */
  staleSince?: string;
}

interface CacheEntry { url: string; fetchedAt: number; text: string }

// Survit aux rechargements à chaud en développement.
const g = globalThis as unknown as { __icsCache?: Map<string, CacheEntry> };
const cache = (g.__icsCache ??= new Map());

class FeedFetchError extends Error {}

async function download(url: string): Promise<string> {
  const host = new URL(url).hostname;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5", "User-Agent": "personal-dashboard/1.0" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new FeedFetchError(`délai dépassé (${FETCH_TIMEOUT_MS / 1000} s) : ${host} ne répond pas.`);
    }
    throw new FeedFetchError(`impossible de joindre ${host}. Vérifie ta connexion internet.`);
  }
  if (!res.ok) {
    const hint =
      res.status === 401 || res.status === 403
        ? "accès refusé : le lien n'est peut-être plus valide ou le partage a été désactivé."
        : res.status === 404 || res.status === 410
          ? "introuvable : le lien a peut-être été supprimé ou régénéré."
          : "erreur du serveur du calendrier.";
    throw new FeedFetchError(`HTTP ${res.status}, ${hint}`);
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new FeedFetchError("flux trop volumineux (plus de 15 Mo).");
  const text = new TextDecoder("utf-8").decode(buf);
  if (!/BEGIN:VCALENDAR/i.test(text.slice(0, 2000))) {
    throw new FeedFetchError(
      "la réponse n'est pas un calendrier ICS. Vérifie qu'il s'agit bien du lien d'abonnement (souvent en .ics).",
    );
  }
  return text;
}

/** Retourne le texte ICS (depuis le cache si récent). */
async function getFeedText(cal: StoredCalendar, force: boolean): Promise<{ text: string; stale?: CacheEntry; error?: string }> {
  const hit = cache.get(cal.id);
  const fresh = hit && hit.url === cal.url && Date.now() - hit.fetchedAt < CACHE_TTL_MS;
  if (fresh && !force) return { text: hit.text };
  try {
    const text = await download(cal.url);
    cache.set(cal.id, { url: cal.url, fetchedAt: Date.now(), text });
    return { text };
  } catch (e) {
    const message = e instanceof FeedFetchError ? e.message : `erreur inattendue (${e instanceof Error ? e.message : String(e)}).`;
    const stale = hit && hit.url === cal.url ? hit : undefined;
    return { text: stale?.text ?? "", stale, error: message };
  }
}

export function forgetFeed(id: string) {
  cache.delete(id);
}

/** Vérifie qu'un lien renvoie bien un calendrier lisible (utilisé à l'ajout). */
export async function probeFeed(url: string): Promise<{ ok: true; eventCount: number } | { ok: false; message: string }> {
  try {
    const text = await download(url);
    const comp = new ICAL.Component(ICAL.parse(text));
    return { ok: true, eventCount: comp.getAllSubcomponents("vevent").length };
  } catch (e) {
    if (e instanceof FeedFetchError) return { ok: false, message: e.message };
    return { ok: false, message: `fichier ICS illisible (${e instanceof Error ? e.message : String(e)}).` };
  }
}

/* ------------------------------------------------------------------ */
/* Conversion des dates                                                 */
/* ------------------------------------------------------------------ */

type Time = ICAL.Time;

/** D'où vient le fuseau appliqué aux heures flottantes d'un calendrier. */
export type ZoneSource = "calendar" | "x-wr-timezone" | "vtimezone" | "display";

export interface FloatingZone {
  source: ZoneSource;
  /** Nom IANA (ou TZID du fichier si non reconnu). */
  name: string;
  /** Définition VTIMEZONE du fichier, utilisée seulement si son TZID n'est pas un fuseau connu. */
  ical?: ICAL.Timezone;
}

/**
 * Fuseau des heures flottantes, dans cet ordre :
 * 1. fuseau choisi pour ce calendrier dans l'interface ;
 * 2. X-WR-TIMEZONE du calendrier ;
 * 3. l'unique VTIMEZONE déclaré dans le fichier (s'il y en a exactement un) ;
 * 4. sinon, le fuseau d'affichage.
 */
export function detectFloatingZone(root: ICAL.Component, calendarTz: string | null | undefined, displayTz: string): FloatingZone {
  if (calendarTz && isValidTimeZone(calendarTz)) return { source: "calendar", name: calendarTz };

  const xwr = root.getFirstPropertyValue("x-wr-timezone");
  if (xwr) {
    const resolved = resolveTimeZone(String(xwr));
    if (resolved) return { source: "x-wr-timezone", name: resolved };
  }

  const vtimezones = root.getAllSubcomponents("vtimezone");
  if (vtimezones.length === 1) {
    const tzid = String(vtimezones[0].getFirstPropertyValue("tzid") ?? "");
    const resolved = resolveTimeZone(tzid);
    if (resolved) return { source: "vtimezone", name: resolved };
    if (tzid) return { source: "vtimezone", name: tzid, ical: new ICAL.Timezone({ component: vtimezones[0], tzid }) };
  }

  return { source: "display", name: displayTz };
}

function wallOf(t: Time) {
  return { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second };
}

/** Instant (ms) d'une date-heure ICS. `tzid` = paramètre TZID de la propriété d'origine. */
function toMs(t: Time, tzid: string | null, floating: FloatingZone): number {
  const zone = t.zone;
  if (zone === ICAL.Timezone.utcTimezone) return t.toUnixTime() * 1000;
  // Fuseau défini par un VTIMEZONE dans le flux : ical.js sait calculer le décalage.
  if (zone && zone !== ICAL.Timezone.localTimezone && zone.component) return t.toUnixTime() * 1000;
  // TZID sans définition dans le fichier : nom IANA ou Windows.
  const named = resolveTimeZone(tzid);
  if (named) return instantFromWallTime(wallOf(t), named);
  // Heure flottante (ou TZID inconnu).
  if (floating.ical) {
    const c = t.clone();
    c.zone = floating.ical;
    return c.toUnixTime() * 1000;
  }
  return instantFromWallTime(wallOf(t), floating.name);
}

const pad = (n: number) => String(n).padStart(2, "0");
const dateOnly = (t: Time) => `${t.year}-${pad(t.month)}-${pad(t.day)}`;

function tzidOf(comp: ICAL.Component, prop: "dtstart" | "dtend"): string | null {
  const p = comp.getFirstProperty(prop);
  const v = p?.getParameter("tzid");
  return typeof v === "string" ? v : null;
}

/* ------------------------------------------------------------------ */
/* Développement des événements                                         */
/* ------------------------------------------------------------------ */

export interface ExpandOptions {
  /** Fuseau d'affichage (celui de l'ordinateur par défaut). */
  displayTz: string;
  /** Fuseau choisi pour ce calendrier dans l'interface (heures flottantes uniquement). */
  calendarTz?: string | null;
}

/**
 * Événements qui chevauchent [rangeStart, rangeEnd) (dates YYYY-MM-DD dans le fuseau d'affichage).
 */
export function expandFeed(
  text: string, calendarId: string, rangeStart: string, rangeEnd: string, opts: ExpandOptions,
): { events: CalEvent[]; floatingZone: FloatingZone } {
  const { displayTz } = opts;
  const root = new ICAL.Component(ICAL.parse(text));
  const floating = detectFloatingZone(root, opts.calendarTz, displayTz);
  const vevents = root.getAllSubcomponents("vevent");

  // Regroupe occurrences modifiées (RECURRENCE-ID) et événements principaux par UID.
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  vevents.forEach((c, i) => {
    const ev = new ICAL.Event(c);
    const uid = ev.uid || `sans-uid-${i}`;
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else masters.set(uid, ev);
  });
  for (const ex of exceptions) {
    const master = masters.get(ex.uid);
    if (master) master.relateException(ex);
    // Exception orpheline : on l'affiche comme un événement simple.
    else masters.set(`${ex.uid}#${ex.recurrenceId?.toString()}`, ex);
  }

  const rangeStartStamp = `${rangeStart}T00:00`;
  const rangeEndStamp = `${rangeEnd}T00:00`;
  // Bornes en instants, élargies d'une journée pour couvrir tous les fuseaux d'origine.
  const startMs = instantFromWallTime(wall(rangeStart), displayTz) - 86_400_000;
  const endMs = instantFromWallTime(wall(rangeEnd), displayTz) + 86_400_000;

  const out: CalEvent[] = [];

  const push = (item: ICAL.Event, start: Time, end: Time | null, key: string) => {
    const comp = item.component;
    if (String(comp.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") return;
    const title = (item.summary || "").trim() || "(sans titre)";
    const location = (item.location || "").trim() || undefined;

    if (start.isDate) {
      const s = dateOnly(start);
      let e = end ? dateOnly(end) : s;
      if (e <= s) e = addOneDay(s);
      if (s < rangeEnd && e > rangeStart) {
        out.push({ id: `${calendarId}:${key}`, calendarId, title, allDay: true, start: s, end: e, location });
      }
      return;
    }
    const sMs = toMs(start, tzidOf(comp, "dtstart"), floating);
    const eMs = end ? toMs(end, tzidOf(comp, "dtend") ?? tzidOf(comp, "dtstart"), floating) : sMs;
    const s = localStamp(sMs, displayTz);
    const e = localStamp(Math.max(eMs, sMs), displayTz);
    const overlaps = s < rangeEndStamp && (e > rangeStartStamp || (e === s && s >= rangeStartStamp));
    if (overlaps) out.push({ id: `${calendarId}:${key}`, calendarId, title, allDay: false, start: s, end: e, location });
  };

  for (const [uid, ev] of masters) {
    if (!ev.startDate) continue;
    if (!ev.isRecurring()) {
      push(ev, ev.startDate, ev.endDate, uid);
      continue;
    }
    const it = ev.iterator();
    const startTzid = tzidOf(ev.component, "dtstart");
    let next: Time | null;
    let n = 0;
    while ((next = it.next()) && n++ < MAX_ITERATIONS) {
      const occMs = next.isDate ? Date.parse(`${dateOnly(next)}T00:00:00Z`) : toMs(next, startTzid, floating);
      if (occMs > endMs) break;
      const details = ev.getOccurrenceDetails(next);
      const endOcc = details.endDate;
      const endOccMs = endOcc.isDate ? Date.parse(`${dateOnly(endOcc)}T00:00:00Z`) : toMs(endOcc, startTzid, floating);
      if (endOccMs < startMs && occMs < startMs) continue;
      push(details.item, details.startDate, endOcc, `${uid}@${next.toString()}`);
    }
  }

  return {
    events: out.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, "fr")),
    floatingZone: floating,
  };
}

function wall(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day, hour: 0, minute: 0, second: 0 };
}

function addOneDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Point d'entrée                                                       */
/* ------------------------------------------------------------------ */

export interface ZoneInfo { source: ZoneSource; name: string }

export async function loadEvents(
  calendars: StoredCalendar[], rangeStart: string, rangeEnd: string, force = false,
): Promise<{ events: CalEvent[]; errors: FeedError[]; zones: Record<string, ZoneInfo>; displayTz: string }> {
  const displayTz = displayTimeZone();
  const results = await Promise.all(
    calendars.map(async (cal) => {
      const { text, stale, error } = await getFeedText(cal, force);
      const errors: FeedError[] = [];
      let events: CalEvent[] = [];
      let zone: ZoneInfo | null = null;
      if (text) {
        try {
          const r = expandFeed(text, cal.id, rangeStart, rangeEnd, { displayTz, calendarTz: cal.timeZone });
          events = r.events;
          zone = { source: r.floatingZone.source, name: r.floatingZone.name };
        } catch (e) {
          errors.push({
            calendarId: cal.id, name: cal.name,
            message: `fichier ICS illisible (${e instanceof Error ? e.message : String(e)}).`,
          });
        }
      }
      if (error) {
        errors.push({
          calendarId: cal.id, name: cal.name, message: error,
          staleSince: stale ? localStamp(stale.fetchedAt, displayTz).slice(11) : undefined,
        });
      }
      return { id: cal.id, events, errors, zone };
    }),
  );
  return {
    events: results.flatMap((r) => r.events).sort((a, b) => a.start.localeCompare(b.start)),
    errors: results.flatMap((r) => r.errors),
    zones: Object.fromEntries(results.filter((r) => r.zone).map((r) => [r.id, r.zone!])),
    displayTz,
  };
}
