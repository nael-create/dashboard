/**
 * Stockage des abonnements aux calendriers dans app/data/calendars.local.json.
 * Ce fichier contient des liens SECRETS : il est ignoré par git et n'est jamais envoyé
 * tel quel au navigateur (voir publicCalendar).
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";

const STORE_FILE = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "calendars.local.json");

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const calendarSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(HEX_COLOR),
  url: z.string().url(),
});
const storeSchema = z.object({ calendars: z.array(calendarSchema) });

export type StoredCalendar = z.infer<typeof calendarSchema>;

/** Ce qui est envoyé au navigateur : jamais le lien complet. */
export interface PublicCalendar {
  id: string;
  name: string;
  color: string;
  /** Domaine seul (ex. « outlook.office365.com »), pour reconnaître le calendrier. */
  host: string;
}

export function publicCalendar(c: StoredCalendar): PublicCalendar {
  let host = "";
  try {
    host = new URL(c.url).hostname;
  } catch {
    /* lien invalide : domaine inconnu */
  }
  return { id: c.id, name: c.name, color: c.color, host };
}

/** webcal:// → https:// ; seuls http(s) sont acceptés. */
export function normalizeFeedUrl(input: string): string {
  const trimmed = input.trim().replace(/^webcals?:\/\//i, "https://");
  const url = new URL(trimmed);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Le lien doit commencer par https://, http:// ou webcal://");
  }
  return url.toString();
}

export async function readCalendars(): Promise<StoredCalendar[]> {
  let raw: string;
  try {
    raw = await fs.readFile(/*turbopackIgnore: true*/ STORE_FILE, "utf8");
  } catch {
    return [];
  }
  const parsed = storeSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error("Le fichier data/calendars.local.json est mal formé.");
  return parsed.data.calendars;
}

// Écritures en série pour éviter que deux requêtes simultanées s'écrasent.
let queue: Promise<unknown> = Promise.resolve();

export function updateCalendars<T>(fn: (list: StoredCalendar[]) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const list = await readCalendars();
    const result = await fn(list);
    await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(/*turbopackIgnore: true*/ STORE_FILE), { recursive: true });
    const tmp = `${STORE_FILE}.${process.pid}.tmp`;
    // 0600 : lisible uniquement par ton compte utilisateur.
    await fs.writeFile(/*turbopackIgnore: true*/ tmp, JSON.stringify({ calendars: list }, null, 2) + "\n", { mode: 0o600 });
    await fs.rename(/*turbopackIgnore: true*/ tmp, STORE_FILE);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

export const newCalendarId = () => crypto.randomBytes(6).toString("hex");
