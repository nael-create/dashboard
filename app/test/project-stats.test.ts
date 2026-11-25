import { describe, expect, it } from "vitest";
import { projectStats } from "@/lib/project-stats";
import { parseTasksFile } from "@/lib/tasks-core";
import { entryTasks, nextTask } from "@/lib/tasks-view";

const TODAY = "2026-11-24";
const tasks = parseTasksFile([
  "- [x] 2026-11-20 A #alpha id:t-1 ✓2026-11-21",
  "- [ ] Sans date 1 #alpha id:t-2",
  "- [ ] 2026-11-28 B #alpha id:t-3",
  "- [ ] 2026-11-26 10:00 C #alpha id:t-4",
  "- [ ] Sans date 2 #alpha id:t-5",
  "- [ ] 2026-11-22 En retard #alpha id:t-6",
  "- [-] 2026-11-23 Abandonnée #alpha id:t-7 ✗2026-11-23",
  "- [ ] 2026-11-25 Autre #beta id:t-8",
].join("\n")).tasks;

describe("prochaine action dérivée et indicateurs", () => {
  it("ordre : en retard, puis par date, puis sans date dans l'ordre du fichier", () => {
    expect(entryTasks(tasks, "alpha", TODAY).open.map((t) => t.title)).toEqual(["En retard", "C", "B", "Sans date 1", "Sans date 2"]);
    expect(nextTask(tasks, "alpha", TODAY)?.title).toBe("En retard");
    expect(nextTask(tasks, "beta", TODAY)?.title).toBe("Autre");
    expect(nextTask(tasks, "gamma", TODAY)).toBeNull();
    const undatedOnly = parseTasksFile("- [ ] Premier #x id:t-1\n- [ ] Second #x id:t-2\n").tasks;
    expect(nextTask(undatedOnly, "x", TODAY)?.title).toBe("Premier");
  });

  it("avancement (abandonnées exclues), dernière activité, prochaine tâche", () => {
    expect(projectStats({ slug: "alpha", updated: "2026-11-10", lastNote: "2026-11-15" }, tasks, TODAY)).toEqual({
      progress: { done: 1, total: 6, pct: 17 },
      lastActivity: "2026-11-23",
      nextTask: { id: "t-6", title: "En retard", date: "2026-11-22", time: null },
    });
    expect(projectStats({ slug: "vide", updated: "2026-11-01" }, [], TODAY)).toEqual({ progress: { done: 0, total: 0, pct: null }, lastActivity: "2026-11-01", nextTask: null });
  });
});
