import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agenda-test-"));
vi.stubEnv("CONTENT_DIR", dir);
const A = await import("@/lib/agenda");
const file = path.join(dir, "AGENDA.md");
const KL = "Asia/Kuala_Lumpur";
const lines = (evs: { start: string; end: string; title: string }[]) => evs.map((e) => `${e.start} ${e.end} ${e.title}`);

describe("AGENDA.md (calendrier « Perso »)", () => {
  it("crée le fichier, ajoute un événement horaire avec fuseau IANA explicite", async () => {
    const { result } = await A.addAgendaEvent({ title: "Dîner chez Paul", date: "2026-11-20", allDay: false, startTime: "19:30", endTime: "22:00", location: "Chez Paul", note: "Apporter un dessert", timezone: KL });
    expect(result).toBe("evt-20261120-1");
    expect(fs.readFileSync(file, "utf8")).toContain("## Réglages\nname: Perso\ncolor: #a3451f\n\n## 2026-11-20 — Dîner chez Paul\nid: evt-20261120-1\nstart: 2026-11-20 19:30\nend: 2026-11-20 22:00\ntimezone: Asia/Kuala_Lumpur\nlocation: Chez Paul\n\nApporter un dessert\n");
    const { events } = await A.readAgenda();
    expect(lines(A.expandAgenda(events, "2026-11-16", "2026-11-23", KL))).toEqual(["2026-11-20T19:30 2026-11-20T22:00 Dîner chez Paul"]);
    // Affiché depuis Paris : 12:30 → 15:00.
    expect(lines(A.expandAgenda(events, "2026-11-16", "2026-11-23", "Europe/Paris"))).toEqual(["2026-11-20T12:30 2026-11-20T15:00 Dîner chez Paul"]);
  });

  it("journée entière (fin incluse dans le fichier, exclusive à l'affichage)", async () => {
    const { version } = await A.readAgenda();
    await A.addAgendaEvent({ title: "Anniversaire", date: "2026-11-25", allDay: true, timezone: KL }, version);
    const { events } = await A.readAgenda();
    expect(lines(A.expandAgenda(events, "2026-11-23", "2026-11-30", KL))).toContain("2026-11-25 2026-11-26 Anniversaire");
  });

  it("répétition hebdomadaire avec date de fin ; heure murale conservée au changement d'heure", async () => {
    await A.addAgendaEvent({ title: "Cours", date: "2026-10-19", allDay: false, startTime: "09:00", endTime: "10:00", repeat: "weekly", until: "2026-11-09", timezone: "Europe/Paris" });
    const { events } = await A.readAgenda();
    const occ = A.expandAgenda(events, "2026-10-12", "2026-11-30", "Europe/Paris").filter((e) => e.title === "Cours");
    expect(occ.map((e) => e.start)).toEqual(["2026-10-19T09:00", "2026-10-26T09:00", "2026-11-02T09:00", "2026-11-09T09:00"]);
    expect(occ[0].id).toBe("perso:evt-20261019-1@2026-10-19");
    expect(occ.every((e) => e.editable && e.sourceId === "evt-20261019-1")).toBe(true);
  });

  it("une répétition ancienne reste rapide et correcte", async () => {
    await A.addAgendaEvent({ title: "Sport", date: "2020-01-07", allDay: false, startTime: "18:30", endTime: "19:30", repeat: "weekly", timezone: KL });
    const { events } = await A.readAgenda();
    const occ = A.expandAgenda(events, "2026-11-16", "2026-11-23", KL).filter((e) => e.title === "Sport");
    expect(occ.map((e) => e.start)).toEqual(["2026-11-17T18:30"]);
  });

  it("modifie, supprime, change le nom et la couleur ; refuse les versions périmées", async () => {
    let { version, events } = await A.readAgenda();
    const ev = events.find((e) => e.title === "Anniversaire")!;
    await A.updateAgendaEvent(version, ev.id, { ...A.toInput(ev), title: "Anniversaire de Léa", location: "Maison" });
    await expect(A.deleteAgendaEvent(version, ev.id)).rejects.toThrow(/modifié ailleurs/);
    ({ version } = await A.readAgenda());
    await A.updateAgendaSettings(version, { name: "Moi", color: "#0d7680" });
    ({ version, events } = await A.readAgenda());
    expect((await A.readAgenda()).settings).toEqual({ name: "Moi", color: "#0d7680" });
    await A.deleteAgendaEvent(version, ev.id);
    expect(fs.readFileSync(file, "utf8")).not.toContain("Léa");
  });

  it("bloc écrit à la main sans fuseau : ignoré sans erreur", () => {
    const { events } = A.parseAgenda("## 2026-11-20 — Sans fuseau\nstart: 2026-11-20 10:00\nend: 2026-11-20 11:00\n");
    expect(events[0].problem).toMatch(/fuseau/);
    expect(A.expandAgenda(events, "2026-11-16", "2026-11-23", KL)).toEqual([]);
  });

  it("refuse les secrets et les titres vides", async () => {
    await expect(A.addAgendaEvent({ title: "Wifi", date: "2026-11-20", allDay: true, note: "mot de passe : abc", timezone: KL })).rejects.toThrow(/mot de passe/);
    await expect(A.addAgendaEvent({ title: " ", date: "2026-11-20", allDay: true, timezone: KL })).rejects.toThrow(/titre/);
  });
});
