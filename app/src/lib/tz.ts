/**
 * Outils de fuseaux horaires, sans dépendance : tout passe par Intl (base IANA du système).
 */

/** Noms de fuseaux Windows (souvent utilisés par Outlook) → noms IANA. */
const WINDOWS_TO_IANA: Record<string, string> = {
  "Singapore Standard Time": "Asia/Singapore",
  "Malay Peninsula Standard Time": "Asia/Kuala_Lumpur",
  "China Standard Time": "Asia/Shanghai",
  "Taipei Standard Time": "Asia/Taipei",
  "W. Australia Standard Time": "Australia/Perth",
  "SE Asia Standard Time": "Asia/Bangkok",
  "Tokyo Standard Time": "Asia/Tokyo",
  "Korea Standard Time": "Asia/Seoul",
  "India Standard Time": "Asia/Kolkata",
  "Arabian Standard Time": "Asia/Dubai",
  "Arab Standard Time": "Asia/Riyadh",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "New Zealand Standard Time": "Pacific/Auckland",
  "UTC": "UTC",
  "Coordinated Universal Time": "UTC",
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "W. Europe Standard Time": "Europe/Berlin",
  "Romance Standard Time": "Europe/Paris",
  "Central Europe Standard Time": "Europe/Budapest",
  "Central European Standard Time": "Europe/Warsaw",
  "E. Europe Standard Time": "Europe/Chisinau",
  "GTB Standard Time": "Europe/Bucharest",
  "FLE Standard Time": "Europe/Kiev",
  "Russian Standard Time": "Europe/Moscow",
  "Turkey Standard Time": "Europe/Istanbul",
  "Israel Standard Time": "Asia/Jerusalem",
  "Egypt Standard Time": "Africa/Cairo",
  "South Africa Standard Time": "Africa/Johannesburg",
  "Morocco Standard Time": "Africa/Casablanca",
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "US Mountain Standard Time": "America/Phoenix",
  "Pacific Standard Time": "America/Los_Angeles",
  "Alaskan Standard Time": "America/Anchorage",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "Atlantic Standard Time": "America/Halifax",
  "Canada Central Standard Time": "America/Regina",
  "SA Pacific Standard Time": "America/Bogota",
  "E. South America Standard Time": "America/Sao_Paulo",
  "Argentina Standard Time": "America/Buenos_Aires",
  "Pacific SA Standard Time": "America/Santiago",
  "Mexico Standard Time": "America/Mexico_City",
  "Central Standard Time (Mexico)": "America/Mexico_City",
};

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Trouve un fuseau IANA à partir d'un TZID d'agenda :
 * IANA direct, nom Windows, ou « (UTC+08:00) Kuala Lumpur, Singapore » (format Outlook).
 */
export function resolveTimeZone(tzid: string | null | undefined): string | null {
  if (!tzid) return null;
  const clean = tzid.replace(/^\/+/, "").replace(/^"|"$/g, "").trim();
  if (WINDOWS_TO_IANA[clean]) return WINDOWS_TO_IANA[clean];
  if (isValidTimeZone(clean)) return clean;
  // Libellés Outlook du type « (UTC+08:00) Kuala Lumpur, Singapore ».
  if (/kuala lumpur/i.test(clean)) return "Asia/Kuala_Lumpur";
  if (/singapore/i.test(clean)) return "Asia/Singapore";
  // Préfixes de type « tzone://Microsoft/... » ou chemins « Europe/Paris » noyés dans le libellé.
  const iana = clean.match(/[A-Z][a-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?/);
  if (iana && isValidTimeZone(iana[0])) return iana[0];
  // « UTC+8 », « GMT+08:00 » (heures pleines uniquement).
  const offset = clean.match(/^\(?(?:UTC|GMT)\s*([+-])(\d{1,2})(?::?00)?\)?$/i);
  if (offset) {
    // Etc/GMT inverse le signe : UTC+8 → Etc/GMT-8.
    const h = Number(offset[2]);
    const name = h === 0 ? "UTC" : `Etc/GMT${offset[1] === "+" ? "-" : "+"}${h}`;
    if (isValidTimeZone(name)) return name;
  }
  return null;
}

export interface WallTime { year: number; month: number; day: number; hour: number; minute: number; second: number }

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

/** Heure murale d'un instant dans un fuseau. */
export function wallTimeOf(ms: number, tz: string): WallTime {
  const parts = Object.fromEntries(dtf(tz).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second),
  };
}

/** Décalage (ms) d'un fuseau à un instant donné. */
function offsetAt(ms: number, tz: string): number {
  const w = wallTimeOf(ms, tz);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(ms / 1000) * 1000;
}

/** Instant (ms) correspondant à une heure murale dans un fuseau (gère les changements d'heure). */
export function instantFromWallTime(w: WallTime, tz: string): number {
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  let ms = guess - offsetAt(guess, tz);
  ms = guess - offsetAt(ms, tz);
  return ms;
}

const pad = (n: number, l = 2) => String(n).padStart(l, "0");

/** « YYYY-MM-DDTHH:mm » dans le fuseau donné. */
export function localStamp(ms: number, tz: string): string {
  const w = wallTimeOf(ms, tz);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/** Ajoute n jours à une date « YYYY-MM-DD ». */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
