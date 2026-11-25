import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tasks-test-"));
vi.stubEnv("CONTENT_DIR", dir);
vi.stubEnv("DASHBOARD_DATA_DIR", path.join(dir, "data"));

const tasks = await import("@/lib/tasks");
const { groupTasks, historyByWeek, todayProgress } = await import("@/lib/tasks-view");
const file = path.join(dir, "TACHES.md");
const readme = path.join(dir, "projects", "alpha", "README.md");

const PROJECT = `---
title: Alpha
status: active
priority: P1
created: 2026-11-01
updated: 2026-11-01
next_action: "TODO: fill in"
---

## Objectif

Test.

## Prochaines actions

- [ ] Écrire le brief
- [ ] Appeler le labo

## Notes

## Liens

## Journal

- 2026-11-01 — Création
`;

const TUE = "2026-11-24";

describe("TACHES.md", () => {
  beforeEach(() => {
    fs.rmSync(file, { force: true });
    fs.mkdirSync(path.dirname(readme), { recursive: true });
    fs.writeFileSync(readme, PROJECT);
  });

  it("crée le fichier avec ses réglages et insère une tâche horaire à sa place", async () => {
    await tasks.addTask({ title: "Sans heure", date: TUE }, TUE);
    await tasks.addTask({ title: "Tard", date: TUE, time: "18:00" }, TUE);
    await tasks.addTask({ title: "Tôt", date: TUE, time: "09:00", reminder: 30 }, TUE);
    const raw = fs.readFileSync(file, "utf8");
    expect(raw.startsWith("---\ntimezone: ")).toBe(true);
    expect(raw).toContain("# Tâches");
    const { tasks: list } = await tasks.readTasks();
    expect(list.map((t) => t.title)).toEqual(["Sans heure", "Tôt", "Tard"]);
    expect(raw).toContain("- [ ] 2026-11-24 09:00 Tôt ⏰-30m id:t-20261124-3");
  });

  it("refuse un secret dans le titre et ne crée rien", async () => {
    await expect(tasks.addTask({ title: "mot de passe : hunter22", date: TUE }, TUE)).rejects.toThrow(/Non enregistré/);
    expect(fs.existsSync(file)).toBe(false);
  });

  it("refuse une écriture si le fichier a changé depuis la lecture (409)", async () => {
    await tasks.addTask({ title: "A", date: TUE }, TUE);
    const { version, tasks: list } = await tasks.readTasks();
    fs.appendFileSync(file, "note à la main\n");
    await expect(tasks.setTaskStatus(version, list[0].id, "done", TUE)).rejects.toThrow(/modifié ailleurs/);
  });

  it("cocher une tâche liée à un projet ajoute « ✓ … » à la note du jour", async () => {
    await tasks.addTask({ title: "Envoyer le devis", date: TUE, project: "alpha" }, TUE);
    const { version, tasks: list } = await tasks.readTasks();
    await tasks.setTaskStatus(version, list[0].id, "done", TUE);
    const after = await tasks.readTasks();
    expect(after.tasks[0]).toMatchObject({ status: "done", closedOn: TUE });
    expect(fs.readFileSync(file, "utf8")).toContain("- [x] 2026-11-24 Envoyer le devis #alpha id:t-20261124-1 ✓2026-11-24");
    const md = fs.readFileSync(readme, "utf8");
    expect(md).toMatch(/## Notes\n\n### 2026-11-24\n\n✓ Envoyer le devis\n/);
    expect(md).not.toContain("updated: 2026-11-01");
  });

  it("une tâche récurrente cochée crée l'occurrence suivante", async () => {
    await tasks.addTask({ title: "Sport", date: TUE, recurrence: { kind: "weekly", weekday: 2 } }, TUE);
    const { version, tasks: list } = await tasks.readTasks();
    const res = await tasks.setTaskStatus(version, list[0].id, "done", TUE);
    expect(res.result?.next?.date).toBe("2026-12-01");
    const after = await tasks.readTasks();
    expect(after.tasks.map((t) => [t.status, t.date, !!t.recurrence])).toEqual([["done", TUE, false], ["todo", "2026-12-01", true]]);
  });

  it("une récurrence dépassée reste en retard et la suivante est créée à partir d'aujourd'hui", async () => {
    await tasks.addTask({ title: "Arroser", date: "2026-11-20", recurrence: { kind: "daily" } }, "2026-11-20");
    const cur = await tasks.rollRecurring(TUE);
    expect(cur.tasks.map((t) => [t.date, !!t.recurrence])).toEqual([["2026-11-20", false], [TUE, true]]);
    // Deuxième passage : rien de plus.
    const again = await tasks.rollRecurring(TUE);
    expect(again.tasks).toHaveLength(2);
  });

  it("mensuelle le 31 : se cale sur le dernier jour des mois courts", async () => {
    await tasks.addTask({ title: "Loyer", date: "2027-01-31", recurrence: { kind: "monthly", day: 31 } }, "2027-01-31");
    const { version, tasks: list } = await tasks.readTasks();
    const res = await tasks.setTaskStatus(version, list[0].id, "done", "2027-01-31");
    expect(res.result?.next?.date).toBe("2027-02-28");
  });

  it("tâche sans date : seulement liée à un projet ou domaine existant ; jamais dans « aujourd'hui »", async () => {
    await expect(tasks.addTask({ title: "Libre", date: null }, TUE)).rejects.toThrow(/projet/);
    await expect(tasks.addTask({ title: "Fantôme", date: null, project: "inconnu" }, TUE)).rejects.toThrow();
    await tasks.addTask({ title: "Choisir le papier", date: null, project: "alpha", time: "10:00", recurrence: { kind: "daily" } }, TUE);
    const t = fs.readFileSync(file, "utf8");
    expect(t).toMatch(/^- \[ \] Choisir le papier #alpha id:t-20261124-\d+$/m);
    const { tasks: list } = await tasks.readTasks();
    expect(list[0]).toMatchObject({ title: "Choisir le papier", date: null, time: null, recurrence: null, project: "alpha" });
    const g = groupTasks(list, TUE);
    expect([...g.overdue, ...g.today, ...g.tomorrow, ...g.week, ...g.later]).toHaveLength(0);
  });

  it("cocher une tâche liée l'inscrit dans la note du jour du projet ; décocher la retire", async () => {
    await tasks.addTask({ title: "Relire le devis", date: null, project: "alpha" }, TUE);
    let cur = await tasks.readTasks();
    await tasks.setTaskStatus(cur.version, cur.tasks[0].id, "done", TUE);
    expect(fs.readFileSync(readme, "utf8")).toContain(`### ${TUE}\n\n✓ Relire le devis`);
    cur = await tasks.readTasks();
    await tasks.setTaskStatus(cur.version, cur.tasks[0].id, "todo", TUE);
    expect(fs.readFileSync(readme, "utf8")).not.toContain("✓ Relire le devis");
  });

  it("annuler une suppression remet la tâche à sa place", async () => {
    for (const t of ["A", "B", "C"]) await tasks.addTask({ title: t, date: TUE }, TUE);
    let cur = await tasks.readTasks();
    const removed = cur.tasks[1];
    await tasks.deleteTask(cur.version, removed.id);
    cur = await tasks.readTasks();
    await tasks.restoreTask(removed);
    cur = await tasks.readTasks();
    expect(cur.tasks.map((t) => [t.title, t.id])).toEqual([["A", cur.tasks[0].id], ["B", removed.id], ["C", cur.tasks[2].id]]);
  });

  it("Convertir un projet à l'ancien format depuis sa page : tâches ajoutées, notes du jour, idempotent", async () => {
    const { readEditable } = await import("@/lib/entries-edit");
    const { migrateEntry } = await import("@/lib/entry-migration");
    await tasks.addTask({ title: "Écrire le brief", date: null, project: "alpha" }, TUE); // déjà là : pas de doublon
    let e = (await readEditable("project", "alpha"))!;
    expect(e.legacy).toBe(true);
    const res = await migrateEntry("project", "alpha", e.version);
    expect(res.tasks).toBe(1);
    const list = (await tasks.readTasks()).tasks.filter((t) => t.project === "alpha");
    expect(list.map((t) => [t.title, t.date])).toEqual([["Écrire le brief", null], ["Appeler le labo", null]]);
    e = (await readEditable("project", "alpha"))!;
    expect(e.legacy).toBe(false);
    expect(e.notes.find((n) => n.date === "2026-11-01")?.text).toMatch(/^Création\n\n\*\*Ancien contenu/);
    expect(e.notes.some((n) => n.text.includes("**Ancien contenu : Objectif**\n\nTest."))).toBe(true);
    const again = await migrateEntry("project", "alpha", e.version);
    expect(again.tasks).toBe(0);
    await expect(migrateEntry("project", "alpha", "ancienne")).rejects.toThrow(/modifié ailleurs/);
  });

  it("déplacer, placer, reporter, abandonner, supprimer", async () => {
    for (const t of ["A", "B", "C"]) await tasks.addTask({ title: t, date: TUE }, TUE);
    let cur = await tasks.readTasks();
    await tasks.moveTask(cur.version, cur.tasks[2].id, -1);
    cur = await tasks.readTasks();
    expect(cur.tasks.map((t) => t.title)).toEqual(["A", "C", "B"]);
    await tasks.placeTask(cur.version, cur.tasks[2].id, cur.tasks[0].id);
    cur = await tasks.readTasks();
    expect(cur.tasks.map((t) => t.title)).toEqual(["B", "A", "C"]);
    await tasks.updateTask(cur.version, cur.tasks[0].id, { date: "2026-11-25" });
    cur = await tasks.readTasks();
    await tasks.setTaskStatus(cur.version, cur.tasks[1].id, "dropped", TUE);
    cur = await tasks.readTasks();
    expect(cur.tasks[1]).toMatchObject({ status: "dropped", closedOn: TUE });
    await tasks.deleteTask(cur.version, cur.tasks[2].id);
    cur = await tasks.readTasks();
    expect(cur.tasks.map((t) => t.title)).toEqual(["B", "A"]);
  });

  it("réglages : remplace seulement le frontmatter", async () => {
    await tasks.addTask({ title: "A", date: TUE }, TUE);
    const cur = await tasks.readTasks();
    await tasks.updateTaskSettings(cur.version, { eveningDigest: "19:30", morningEnabled: true, timezone: "Asia/Kuala_Lumpur" });
    const after = await tasks.readTasks();
    expect(after.settings).toMatchObject({ eveningDigest: "19:30", morningEnabled: true, timezone: "Asia/Kuala_Lumpur" });
    expect(after.tasks).toHaveLength(1);
    await expect(tasks.updateTaskSettings(after.version, { timezone: "Mars/Olympus" })).rejects.toThrow(/Fuseau/);
  });
});

describe("regroupements d'affichage", () => {
  const t = (id: string, date: string, status: "todo" | "done" | "dropped" = "todo", closedOn: string | null = null) => ({
    id, date, status, closedOn, time: null, duration: null, title: id, project: null, reminder: null, recurrence: null, line: Number(id.slice(1)),
  });
  const list = [t("t1", "2026-11-20"), t("t2", TUE), t("t3", TUE, "done", TUE), t("t4", "2026-11-25"), t("t5", "2026-11-29"), t("t6", "2026-11-30"), t("t7", "2026-11-22", "done", TUE), t("t8", TUE, "dropped", TUE)];

  it("sections : en retard, aujourd'hui, demain, cette semaine (jusqu'à dimanche)", () => {
    const g = groupTasks(list, TUE);
    expect(g.overdue.map((x) => x.id)).toEqual(["t1"]);
    expect(g.today.map((x) => x.id)).toEqual(["t2"]);
    expect(g.tomorrow.map((x) => x.id)).toEqual(["t4"]);
    expect(g.week.map((x) => x.id)).toEqual(["t5"]);
    expect(g.todayDone.map((x) => x.id)).toEqual(["t7", "t3", "t8"]);
  });

  it("le samedi, « cette semaine » couvre la semaine suivante", () => {
    expect(groupTasks([t("t1", "2026-12-06")], "2026-11-28").week).toHaveLength(1);
  });

  it("progression : faites / prévues aujourd'hui, sans les abandonnées", () => {
    expect(todayProgress(list, TUE)).toEqual({ done: 2, total: 3 });
  });

  it("historique groupé par semaine, plus récente d'abord", () => {
    const h = historyByWeek([...list, t("t9", "2026-11-10", "done", "2026-11-12")]);
    expect(h.map((w) => w.week)).toEqual(["2026-11-23", "2026-11-09"]);
  });
});
