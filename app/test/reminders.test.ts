import { describe, expect, it } from "vitest";
import { parseTasksFile } from "@/lib/tasks-core";
import { deadlineWords, emptyState, markSent, parseState, projectDeadline, selectReminders, type SentState } from "@/lib/reminders-core";

const head = (extra = "") => `---\ntimezone: Asia/Kuala_Lumpur\nreminders: yes\nevening_digest: "18:00"\nmorning_digest: "08:00"\nmorning_enabled: no\n${extra}---\n\n`;
const file = (lines: string[], extra = "") => parseTasksFile(head(extra) + lines.join("\n") + "\n");
/** Instant UTC correspondant à une heure murale de Kuala Lumpur (UTC+8). */
const kl = (date: string, time: string) => new Date(Date.parse(`${date}T${time}:00+08:00`));
const D = "2026-11-24";

describe("rappels : sélection", () => {
  const f = file([
    `- [ ] ${D} 14:00 Appeler la banque ⏰-30m id:t-1`,
    `- [ ] ${D} Faire les courses id:t-2`,
    `- [ ] 2026-11-22 Rappeler Paul id:t-3`,
    `- [x] ${D} Déjà fait id:t-4 ✓${D}`,
    `- [ ] 2026-11-25 09:00 Demain ⏰ id:t-5`,
  ]);

  it("rien avant l'heure du rappel ; le rappel part au premier passage après 13:30 (heure de KL)", () => {
    expect(selectReminders(f, emptyState(), kl(D, "13:07"))).toEqual([]);
    const mails = selectReminders(f, emptyState(), kl(D, "14:07"));
    expect(mails.map((m) => m.kind)).toEqual(["task"]);
    expect(mails[0].subject).toBe("Rappel : 14:00 Appeler la banque");
    expect(mails[0].html).toContain("http://127.0.0.1:3000/projets/aujourdhui#task-t-1");
  });

  it("fuseau : 13:40 à KL = 05:40 UTC ; l'heure UTC n'est pas utilisée", () => {
    expect(selectReminders(f, emptyState(), new Date(`${D}T05:40:00Z`)).map((m) => m.kind)).toEqual(["task"]);
    expect(selectReminders(f, emptyState(), new Date(`${D}T13:40:00Z`)).map((m) => m.kind)).toEqual(["evening"]);
  });

  it("jamais deux fois le même rappel ; un report de la tâche le réarme", () => {
    const now = kl(D, "14:07");
    const [m] = selectReminders(f, emptyState(), now);
    const st = markSent(emptyState(), m, now, "Asia/Kuala_Lumpur");
    expect(selectReminders(f, st, kl(D, "15:07"))).toEqual([]);
    const moved = file([`- [ ] ${D} 16:00 Appeler la banque ⏰-30m id:t-1`]);
    expect(selectReminders(moved, st, kl(D, "15:37")).map((x) => x.kind)).toEqual(["task"]);
  });

  it("rappel trop ancien (plus de 6 h de retard du workflow) : sauté", () => {
    const early = file([`- [ ] ${D} 08:00 Tôt ⏰ id:t-9`]);
    expect(selectReminders(early, emptyState(), kl(D, "15:00"))).toEqual([]);
  });

  it("récapitulatif du soir : aujourd'hui non faites + en retard, une seule fois", () => {
    const st: SentState = { keys: { "task:t-1:2026-11-24T14:00:30": D }, mails: [D] };
    const [m] = selectReminders(f, st, kl(D, "18:07"));
    expect(m.kind).toBe("evening");
    expect(m.text).toContain("Faire les courses");
    expect(m.text).toContain("Rappeler Paul");
    expect(m.text).not.toContain("Déjà fait");
    expect(m.text).not.toContain("Demain");
    const after = markSent(st, m, kl(D, "18:07"), "Asia/Kuala_Lumpur");
    expect(selectReminders(f, after, kl(D, "19:07"))).toEqual([]);
  });

  it("soir : projets dont la deadline est dans les 3 jours ou dépassée (même sans tâche) ; tâches sans date ignorées", () => {
    const g = file([`- [x] ${D} Fini id:t-1 ✓${D}`, "- [ ] Sans date #alpha id:t-2"]);
    const deadlines = [
      { slug: "alpha", title: "Alpha", deadline: "2026-11-26" },
      { slug: "beta", title: "Beta", deadline: "2026-11-20" },
      { slug: "gamma", title: "Gamma", deadline: "2026-12-20" },
    ];
    const [m] = selectReminders(g, emptyState(), kl(D, "18:07"), deadlines);
    expect(m.kind).toBe("evening");
    expect(m.subject).toBe("Ce soir : deadlines proches");
    expect(m.text).toContain("Beta : en retard de 4 jours");
    expect(m.text).toContain("Alpha : dans 2 jours");
    expect(m.text).not.toContain("Gamma");
    expect(m.text).not.toContain("Sans date");
    expect(m.html).toContain("http://127.0.0.1:3000/projets/alpha");
    expect(selectReminders(g, emptyState(), kl(D, "18:07"), [deadlines[2]])).toEqual([]);
    expect(deadlineWords(D, D)).toBe("aujourd'hui");
  });

  it("lecture de la deadline d'un README (projets clos et sans deadline ignorés)", () => {
    expect(projectDeadline("a", '---\ntitle: "Site : refonte"\nstatus: active  # x\ndeadline: 2026-12-01  # optionnel\n---\n')).toEqual({ slug: "a", title: "Site : refonte", deadline: "2026-12-01" });
    expect(projectDeadline("a", "---\ntitle: A\nstatus: done\ndeadline: 2026-12-01\n---\n")).toBeNull();
    expect(projectDeadline("a", "---\ntitle: A\ndeadline:      # optionnel\n---\n")).toBeNull();
  });

  it("aucun mail quand il n'y a rien à dire", () => {
    const done = file([`- [x] ${D} Fini id:t-1 ✓${D}`]);
    expect(selectReminders(done, emptyState(), kl(D, "18:07"))).toEqual([]);
  });

  it("matin : seulement si activé, avec les tâches du jour", () => {
    expect(selectReminders(f, emptyState(), kl(D, "08:07"))).toEqual([]);
    const on = file([`- [ ] ${D} Faire les courses id:t-2`], "morning_enabled: yes\n");
    const [m] = selectReminders(on, emptyState(), kl(D, "08:07"));
    expect(m.kind).toBe("morning");
  });

  it("3 mails par jour au plus, une place gardée pour le soir", () => {
    const many = file([
      `- [ ] ${D} 10:00 A ⏰ id:t-a`, `- [ ] ${D} 12:00 B ⏰ id:t-b`, `- [ ] ${D} 14:00 C ⏰ id:t-c`, `- [ ] ${D} Reste id:t-r`,
    ]);
    let st = emptyState();
    const sentKinds: string[] = [];
    for (const h of ["10:07", "12:07", "14:07", "18:07", "19:07"]) {
      for (const m of selectReminders(many, st, kl(D, h))) {
        sentKinds.push(m.kind);
        st = markSent(st, m, kl(D, h), "Asia/Kuala_Lumpur");
      }
    }
    expect(sentKinds).toEqual(["task", "task", "evening"]);
  });

  it("rappels désactivés : rien", () => {
    const off = parseTasksFile(head().replace("reminders: yes", "reminders: no") + `- [ ] ${D} 14:00 X ⏰ id:t-1\n`);
    expect(selectReminders(off, emptyState(), kl(D, "14:07"))).toEqual([]);
  });

  it("état : lu sans erreur s'il est abîmé, oublié au bout de 14 jours", () => {
    expect(parseState("n'importe quoi")).toEqual(emptyState());
    expect(parseState({ keys: { a: "2026-11-01", b: 3 }, mails: ["2026-11-01", null] })).toEqual({ keys: { a: "2026-11-01" }, mails: ["2026-11-01"] });
    const old: SentState = { keys: { "evening:2026-11-01": "2026-11-01" }, mails: ["2026-11-01"] };
    const m = selectReminders(f, emptyState(), kl(D, "18:07")).find((x) => x.kind === "evening")!;
    const next = markSent(old, m, kl(D, "18:07"), "Asia/Kuala_Lumpur");
    expect(next).toEqual({ keys: { [`evening:${D}`]: D }, mails: [D] });
  });

  it("titres échappés dans le HTML", () => {
    const x = file([`- [ ] ${D} 14:00 <script>alert(1)</script> & co ⏰ id:t-1`]);
    const [m] = selectReminders(x, emptyState(), kl(D, "14:07"));
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });
});
