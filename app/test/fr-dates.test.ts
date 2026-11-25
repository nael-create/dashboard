import { describe, expect, it } from "vitest";
import {
  dayMonth, deadlineChip, deadlinePresets, endOfMonth, longDate, monthGrid, nextWeek, shortDate, taskDateChip, taskPresets, thisWeekend,
} from "@/lib/fr-dates";

const WED = "2026-11-25";

describe("dates en français", () => {
  it("formats courts et longs, jamais 11/25/2026", () => {
    expect(shortDate(WED)).toBe("25 nov. 2026");
    expect(longDate(WED)).toBe("mercredi 25 novembre");
    expect(longDate("2027-01-04", WED)).toBe("lundi 4 janvier 2027");
    expect(dayMonth("2026-12-07", WED)).toBe("7 déc.");
  });

  it("puce de deadline", () => {
    expect(deadlineChip(WED, WED)).toEqual({ text: "aujourd'hui", tone: "soon" });
    expect(deadlineChip("2026-11-26", WED).text).toBe("demain");
    expect(deadlineChip("2026-12-07", WED)).toEqual({ text: "dans 12 jours · 7 déc.", tone: "normal" });
    expect(deadlineChip("2026-11-27", WED)).toEqual({ text: "dans 2 jours · 27 nov.", tone: "soon" });
    expect(deadlineChip("2026-11-23", WED)).toEqual({ text: "en retard de 2 jours", tone: "overdue" });
    expect(deadlineChip("2026-11-24", WED).text).toBe("en retard de 1 jour");
  });

  it("puce de date d'une tâche", () => {
    expect(taskDateChip(WED, WED).text).toBe("aujourd'hui");
    expect(taskDateChip("2026-11-26", WED).text).toBe("demain");
    expect(taskDateChip("2026-11-28", WED).text).toBe("sam. 28 nov.");
    expect(taskDateChip("2026-11-23", WED)).toEqual({ text: "en retard de 2 j", tone: "overdue" });
    expect(taskDateChip("2027-01-08", WED).text).toBe("ven. 8 janv. 2027");
  });

  it("raccourcis", () => {
    expect(thisWeekend(WED)).toBe("2026-11-28");
    expect(thisWeekend("2026-11-29")).toBe("2026-11-29");
    expect(nextWeek(WED)).toBe("2026-11-30");
    expect(nextWeek("2026-11-30")).toBe("2026-12-07");
    expect(endOfMonth(WED)).toBe("2026-11-30");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(deadlinePresets(WED).map((p) => p.date)).toEqual(["2026-12-02", "2026-12-09", "2026-11-30"]);
    expect(taskPresets(WED).map((p) => p.label)).toEqual(["Aujourd'hui", "Demain", "Ce week-end", "Semaine prochaine"]);
  });

  it("grille du mois : semaines du lundi au dimanche", () => {
    const g = monthGrid(2026, 11);
    expect(g[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(g.at(-1)).toEqual(["2026-11-30", null, null, null, null, null, null]);
    expect(g.flat().filter(Boolean)).toHaveLength(30);
  });
});
