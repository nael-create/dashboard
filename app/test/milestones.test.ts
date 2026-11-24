import { describe, expect, it } from "vitest";
import { addMilestone, editMilestone, milestones, parseDoc, removeMilestone, serializeDoc, setMilestoneDone } from "@/lib/markdown-doc";
import { milestonesToEvents, tasksToEvents } from "@/lib/calendar-layers";
import { parseTasksFile } from "@/lib/tasks-core";

const README = `---
title: Alpha
---

## Objectif

Test.

## Journal

- 2026-11-01 — Création
`;

describe("jalons (## Jalons)", () => {
  it("crée la section avant le Journal et garde l'ordre chronologique", () => {
    const d = parseDoc(README);
    addMilestone(d, "2027-02-01", "Lancement");
    addMilestone(d, "2026-12-15", "Prototype");
    addMilestone(d, "2027-01-10", "Tests");
    const out = serializeDoc(d);
    expect(out).toContain("## Jalons\n\n- [ ] 2026-12-15 — Prototype\n- [ ] 2027-01-10 — Tests\n- [ ] 2027-02-01 — Lancement\n\n## Journal");
    expect(milestones(d).map((m) => [m.index, m.date, m.text])).toEqual([[0, "2026-12-15", "Prototype"], [1, "2027-01-10", "Tests"], [2, "2027-02-01", "Lancement"]]);
  });

  it("lit les jalons écrits à la main (tiret simple, [X], autres lignes conservées)", () => {
    const d = parseDoc(`## Jalons\n\nNote libre.\n- [X] 2026-11-30 - Brief validé\n* [ ] 2026-12-20 — Démo\n\n## Journal\n`);
    expect(milestones(d)).toMatchObject([{ date: "2026-11-30", text: "Brief validé", done: true }, { date: "2026-12-20", text: "Démo", done: false }]);
  });

  it("cocher, modifier (reclassé), supprimer ; refuse un jalon qui a changé", () => {
    const d = parseDoc(README);
    addMilestone(d, "2026-12-15", "Prototype");
    addMilestone(d, "2027-01-10", "Tests");
    setMilestoneDone(d, 0, "Prototype", true);
    expect(milestones(d)[0].done).toBe(true);
    editMilestone(d, 0, "Prototype", "2027-03-01", "Prototype v2");
    expect(milestones(d).map((m) => [m.text, m.done])).toEqual([["Tests", false], ["Prototype v2", true]]);
    expect(() => setMilestoneDone(d, 0, "Autre", true)).toThrow(/changé/);
    removeMilestone(d, 0, "Tests");
    expect(milestones(d)).toHaveLength(1);
  });
});

describe("calques du calendrier", () => {
  const f = parseTasksFile(`- [ ] 2026-11-24 14:00 Appeler ⏱1h id:t-1\n- [ ] 2026-11-24 Sans heure id:t-2\n- [x] 2026-11-25 09:00 Faite id:t-3 ✓2026-11-25\n- [-] 2026-11-24 Abandonnée id:t-4 ✗2026-11-24\n- [ ] 2026-12-30 Loin id:t-5\n`);

  it("tâches : horaires en événements (durée, sinon 30 min), sans heure en journée entière, abandonnées masquées", () => {
    const ev = tasksToEvents(f.tasks, "Asia/Kuala_Lumpur", "Asia/Kuala_Lumpur", "2026-11-23", "2026-11-30");
    expect(ev.map((e) => [e.id, e.allDay, e.start, e.end, e.task?.done])).toEqual([
      ["taches:t-1", false, "2026-11-24T14:00", "2026-11-24T15:00", false],
      ["taches:t-2", true, "2026-11-24", "2026-11-25", false],
      ["taches:t-3", false, "2026-11-25T09:00", "2026-11-25T09:30", true],
    ]);
  });

  it("tâches : heure convertie si le fuseau d'affichage diffère", () => {
    const [e] = tasksToEvents(f.tasks, "Asia/Kuala_Lumpur", "Europe/Paris", "2026-11-23", "2026-11-30");
    expect(e.start).toBe("2026-11-24T07:00");
  });

  it("jalons : journée entière, titre avec le projet", () => {
    const ev = milestonesToEvents([{ project: "alpha", projectTitle: "Alpha", index: 0, date: "2026-11-26", text: "Prototype", done: false }], "2026-11-23", "2026-11-30");
    expect(ev[0]).toMatchObject({ calendarId: "jalons", allDay: true, start: "2026-11-26", end: "2026-11-27", title: "Prototype · Alpha" });
  });
});
