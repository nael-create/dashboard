/**
 * Téléchargement (côté serveur), cache en mémoire et développement des flux ICS.
 * - Récurrences (RRULE, RDATE, EXDATE) et occurrences modifiées (RECURRENCE-ID) via ical.js.
 * - Fuseaux : VTIMEZONE du flux, sinon TZID IANA / Windows, sinon fuseau du dashboard.
 * - Rien n'est écrit sur disque : le cache vit uniquement en mémoire.
 */
import ICAL from "ical.js";
import config from "@config";
import type { StoredCalendar } from "./calendar-store";
import { instantFromWallTime, localStamp, resolveTimeZone } from "./tz";

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

/** Instant (ms) d'une date-heure ICS. `tzid` = paramètre TZID de la propriété d'origine. */
function toMs(t: Time, tzid: string | null): number {
  const zone = t.zone;
  if (zone === ICAL.Timezone.utcTimezone) return t.toUnixTime() * 1000;
  // Fuseau défini par un VTIMEZONE dans le flux : ical.js sait calculer le décalage.
  if (zone && zone !== ICAL.Timezone.localTimezone && zone.component) return t.toUnixTime() * 1000;
  // Sinon : TZID connu (IANA ou Windows) ou heure « flottante » → fuseau du dashboard.
  const tz = resolveTimeZone(tzid) ?? config.timeZone;
  return instantFromWallTime(
    { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second },
    tz,
  );
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

/**
 * Événements qui chevauchent [rangeStart, rangeEnd) (dates YYYY-MM-DD, fuseau du dashboard).
 */
export function expandFeed(text: string, calendarId: string, rangeStart: string, rangeEnd: string): CalEvent[] {
  const root = new ICAL.Component(ICAL.parse(text));
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
  const startMs = instantFromWallTime(wall(rangeStart), config.timeZone) - 86_400_000;
  const endMs = instantFromWallTime(wall(rangeEnd), config.timeZone) + 86_400_000;

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
    const sMs = toMs(start, tzidOf(comp, "dtstart"));
    const eMs = end ? toMs(end, tzidOf(comp, "dtend") ?? tzidOf(comp, "dtstart")) : sMs;
    const s = localStamp(sMs, config.timeZone);
    const e = localStamp(Math.max(eMs, sMs), config.timeZone);
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
      const occMs = next.isDate ? Date.parse(`${dateOnly(next)}T00:00:00Z`) : toMs(next, startTzid);
      if (occMs > endMs) break;
      const details = ev.getOccurrenceDetails(next);
      const endOcc = details.endDate;
      const endOccMs = endOcc.isDate ? Date.parse(`${dateOnly(endOcc)}T00:00:00Z`) : toMs(endOcc, startTzid);
      if (endOccMs < startMs && occMs < startMs) continue;
      push(details.item, details.startDate, endOcc, `${uid}@${next.toString()}`);
    }
  }

  return out.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, "fr"));
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

export async function loadEvents(
  calendars: StoredCalendar[], rangeStart: string, rangeEnd: string, force = false,
): Promise<{ events: CalEvent[]; errors: FeedError[] }> {
  const results = await Promise.all(
    calendars.map(async (cal) => {
      const { text, stale, error } = await getFeedText(cal, force);
      const errors: FeedError[] = [];
      let events: CalEvent[] = [];
      if (text) {
        try {
          events = expandFeed(text, cal.id, rangeStart, rangeEnd);
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
          staleSince: stale ? localStamp(stale.fetchedAt, config.timeZone).slice(11) : undefined,
        });
      }
      return { events, errors };
    }),
  );
  return {
    events: results.flatMap((r) => r.events).sort((a, b) => a.start.localeCompare(b.start)),
    errors: results.flatMap((r) => r.errors),
  };
}
