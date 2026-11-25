import { describe, expect, it } from "vitest";
import { deadlinesToEvents, tasksToEvents } from "@/lib/calendar-layers";
import { parseTasksFile } from "@/lib/tasks-core";

describe("calques du calendrier", () => {
  const f = parseTasksFile(`- [ ] 2026-11-24 14:00 Appeler ⏱1h id:t-1\n- [ ] 2026-11-24 Sans heure id:t-2\n- [x] 2026-11-25 09:00 Faite id:t-3 ✓2026-11-25\n- [-] 2026-11-24 Abandonnée id:t-4 ✗2026-11-24\n- [ ] 2026-12-30 Loin id:t-5\n- [ ] Sans date #alpha id:t-6\n`);

  it("tâches : horaires en événements (durée, sinon 30 min), sans heure en journée entière ; abandonnées et sans date masquées", () => {
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

  it("deadlines : journée entière, « Deadline · Projet », hors période et vides ignorées", () => {
    const ev = deadlinesToEvents([
      { slug: "alpha", title: "Alpha", deadline: "2026-11-26" },
      { slug: "beta", title: "Beta", deadline: null },
      { slug: "gamma", title: "Gamma", deadline: "2027-01-10" },
    ], "2026-11-23", "2026-11-30");
    expect(ev).toEqual([{ id: "deadlines:alpha", calendarId: "deadlines", title: "Deadline · Alpha", allDay: true, start: "2026-11-26", end: "2026-11-27", deadline: { project: "alpha", projectTitle: "Alpha" } }]);
  });
});
