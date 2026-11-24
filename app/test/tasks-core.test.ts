import { describe, expect, it } from "vitest";
import { formatTaskLine, localNow, nextOccurrence, parseTaskLine, parseTasksFile } from "@/lib/tasks-core";

describe("lignes de TACHES.md", () => {
  it("lit et réécrit une ligne complète", () => {
    const line = "- [ ] 2026-11-25 14:00 Appeler la banque ⏱30min #medtech ⏰-30m 🔁chaque-lundi id:t-20261124-1";
    const t = parseTaskLine(line, 5)!;
    expect(t).toMatchObject({ id: "t-20261124-1", status: "todo", date: "2026-11-25", time: "14:00", duration: 30, title: "Appeler la banque", project: "medtech", reminder: 30, recurrence: { kind: "weekly", weekday: 1 }, line: 5 });
    expect(formatTaskLine(t)).toBe(line);
  });
  it("faite / abandonnée gardent leur date ; lignes libres ignorées", () => {
    expect(parseTaskLine("- [x] 2026-11-24 Relire id:t-20261123-4 ✓2026-11-24", 0)).toMatchObject({ status: "done", closedOn: "2026-11-24" });
    expect(parseTaskLine("- [-] 2026-11-20 Idée id:t-1 ✗2026-11-22", 0)).toMatchObject({ status: "dropped", closedOn: "2026-11-22" });
    expect(parseTaskLine("Une note à la main", 0)).toBeNull();
    expect(parseTaskLine("- [ ] 2026-02-30 Date impossible", 0)).toBeNull();
  });
  it("réglages dans l'en-tête", () => {
    const f = parseTasksFile('---\ntimezone: Asia/Kuala_Lumpur\nreminders: yes\nevening_digest: "19:30"\nmorning_enabled: yes\nautosync: no\n---\n\n# Tâches\n\n- [ ] 2026-11-24 A id:t-1\n');
    expect(f.settings).toMatchObject({ timezone: "Asia/Kuala_Lumpur", eveningDigest: "19:30", morningDigest: "08:00", morningEnabled: true, autosync: false });
    expect(f.tasks).toHaveLength(1);
  });
});

describe("récurrence", () => {
  it("quotidienne, hebdomadaire, mensuelle (fins de mois et d'année)", () => {
    expect(nextOccurrence({ kind: "daily" }, "2026-12-31")).toBe("2027-01-01");
    expect(nextOccurrence({ kind: "weekly", weekday: 1 }, "2026-11-23")).toBe("2026-11-30"); // lundi → lundi suivant
    expect(nextOccurrence({ kind: "weekly", weekday: 5 }, "2026-11-24")).toBe("2026-11-27");
    expect(nextOccurrence({ kind: "monthly", day: 1 }, "2026-12-01")).toBe("2027-01-01");
    expect(nextOccurrence({ kind: "monthly", day: 31 }, "2027-01-31")).toBe("2027-02-28");
    expect(nextOccurrence({ kind: "monthly", day: 31 }, "2027-02-28")).toBe("2027-03-31");
    expect(nextOccurrence({ kind: "monthly", day: 15 }, "2026-11-10")).toBe("2026-11-15");
  });
});

describe("fuseau", () => {
  it("date et heure locales", () => {
    expect(localNow("Asia/Kuala_Lumpur", new Date("2026-11-24T16:30:00Z"))).toEqual({ date: "2026-11-25", minutes: 30 });
    expect(localNow("Europe/Paris", new Date("2026-11-24T22:59:00Z"))).toEqual({ date: "2026-11-24", minutes: 23 * 60 + 59 });
  });
});
