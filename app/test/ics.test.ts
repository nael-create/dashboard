import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expandFeed } from "@/lib/ics";
import { mergeAdjacent, bucketByDay, type ViewEvent } from "@/lib/calendar-view";

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
const KL = "Asia/Kuala_Lumpur";
const range = ["2026-11-01", "2026-12-01"] as const;
const simple = (events: ViewEvent[]) => events.map((e) => `${e.start} ${e.end} ${e.title}`);

describe("heures flottantes (sans TZID ni Z)", () => {
  it("utilise l'unique VTIMEZONE du fichier (cas du calendrier scolaire)", () => {
    const { events, floatingZone } = expandFeed(fixture("school-floating-paris.ics"), "ecole", ...range, { displayTz: KL });
    expect(floatingZone).toMatchObject({ source: "vtimezone", name: "Europe/Paris" });
    // 08:00 à Paris en novembre (UTC+1) = 15:00 à Kuala Lumpur (UTC+8).
    expect(simple(events)[0]).toBe("2026-11-16T15:00 2026-11-16T16:00 Cours A");
  });

  it("respecte l'heure d'été du VTIMEZONE (juin : UTC+2)", () => {
    const { events } = expandFeed(fixture("school-floating-paris.ics"), "ecole", "2026-06-01", "2026-07-01", { displayTz: KL });
    expect(simple(events)).toEqual(["2026-06-15T14:00 2026-06-15T15:00 Cours d'été"]);
  });

  it("le fuseau choisi dans l'interface est prioritaire", () => {
    const { events, floatingZone } = expandFeed(fixture("school-floating-paris.ics"), "ecole", ...range, {
      displayTz: KL, calendarTz: "Asia/Tokyo",
    });
    expect(floatingZone.source).toBe("calendar");
    // 08:00 à Tokyo (UTC+9) = 07:00 à Kuala Lumpur.
    expect(events[0].start).toBe("2026-11-16T07:00");
  });

  it("X-WR-TIMEZONE passe avant le VTIMEZONE", () => {
    const { events, floatingZone } = expandFeed(fixture("floating-x-wr-timezone.ics"), "x", ...range, { displayTz: KL });
    expect(floatingZone).toMatchObject({ source: "x-wr-timezone", name: "America/New_York" });
    // 08:00 à New York (UTC-5) = 21:00 à Kuala Lumpur.
    expect(events[0].start).toBe("2026-11-16T21:00");
  });

  it("sans aucune indication : fuseau d'affichage", () => {
    const { events, floatingZone } = expandFeed(fixture("floating-no-hint.ics"), "f", ...range, { displayTz: KL });
    expect(floatingZone.source).toBe("display");
    expect(events[0].start).toBe("2026-11-16T08:00");
  });

  it("l'affichage suit le fuseau de l'ordinateur (ici Paris)", () => {
    const { events } = expandFeed(fixture("school-floating-paris.ics"), "ecole", ...range, { displayTz: "Europe/Paris" });
    expect(events[0].start).toBe("2026-11-16T08:00");
  });
});

describe("récurrences et fuseaux nommés (Outlook)", () => {
  const { events } = expandFeed(fixture("outlook-recurring.ics"), "o", ...range, { displayTz: KL });
  const lines = simple(events);

  it("applique EXDATE, occurrences déplacées et annulées", () => {
    const weekly = lines.filter((l) => l.includes("Réunion"));
    expect(weekly).toEqual([
      "2026-11-02T10:00 2026-11-02T11:00 Réunion hebdo",
      "2026-11-17T14:30 2026-11-17T15:30 Réunion hebdo (déplacée)",
      "2026-11-30T10:00 2026-11-30T11:00 Réunion hebdo",
    ]);
  });

  it("convertit les TZID IANA sans VTIMEZONE", () => {
    expect(lines).toContain("2026-11-14T09:00 2026-11-14T10:00 Appel New York");
  });

  it("garde les journées entières telles quelles", () => {
    expect(lines).toContain("2026-11-19 2026-11-22 Congés");
  });
});

describe("regroupement des événements consécutifs (affichage)", () => {
  const { events } = expandFeed(fixture("school-floating-paris.ics"), "ecole", ...range, { displayTz: "Europe/Paris" });

  it("fusionne 08:00–09:00, 09:00–10:00, 10:00–11:00 en 08:00–11:00", () => {
    const merged = mergeAdjacent(events);
    expect(merged.map((e) => `${e.start.slice(11)}–${e.end.slice(11)} ${e.title} x${e.mergedCount ?? 1}`)).toEqual([
      "08:00–11:00 Cours A x3",
      "11:00–12:00 Cours B x1",
    ]);
  });

  it("ne modifie pas les événements d'origine", () => {
    const before = JSON.stringify(events);
    mergeAdjacent(events);
    expect(JSON.stringify(events)).toBe(before);
    expect(events).toHaveLength(4);
  });

  it("ne fusionne pas des calendriers, titres ou lieux différents, ni des créneaux non contigus", () => {
    const base = { allDay: false, title: "X", location: "L" };
    const evs: ViewEvent[] = [
      { ...base, id: "1", calendarId: "a", start: "2026-11-16T08:00", end: "2026-11-16T09:00" },
      { ...base, id: "2", calendarId: "b", start: "2026-11-16T09:00", end: "2026-11-16T10:00" },
      { ...base, id: "3", calendarId: "a", start: "2026-11-16T09:00", end: "2026-11-16T10:00", location: "Autre" },
      { ...base, id: "4", calendarId: "a", start: "2026-11-16T09:30", end: "2026-11-16T10:30" },
    ];
    expect(mergeAdjacent(evs)).toHaveLength(4);
  });

  it("fonctionne avec le classement par jour", () => {
    const byDay = bucketByDay(mergeAdjacent(events));
    expect(byDay.get("2026-11-16")).toHaveLength(2);
  });
});
