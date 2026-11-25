import { describe, expect, it } from "vitest";
import { parseTaskInput } from "@/lib/task-input";

const TUE = "2026-11-24"; // mardi
const MON = "2026-11-23"; // lundi
const P = ["medtech", "site-perso"];

describe("saisie rapide en français", () => {
  it("par défaut : aujourd'hui, titre intact", () => {
    expect(parseTaskInput("Appeler la banque", TUE)).toMatchObject({ title: "Appeler la banque", date: TUE, time: null, ambiguous: false });
  });
  it("aujourd'hui, demain, après-demain", () => {
    expect(parseTaskInput("Appeler aujourd'hui", TUE)).toMatchObject({ title: "Appeler", date: TUE });
    expect(parseTaskInput("demain Payer le loyer", TUE)).toMatchObject({ title: "Payer le loyer", date: "2026-11-25" });
    expect(parseTaskInput("Ranger après-demain", TUE).date).toBe("2026-11-26");
    expect(parseTaskInput("Ranger apres demain", TUE)).toMatchObject({ title: "Ranger", date: "2026-11-26" });
  });
  it("jour de la semaine = le prochain, jamais aujourd'hui (lundi un lundi = lundi suivant)", () => {
    expect(parseTaskInput("Sport lundi", MON).date).toBe("2026-11-30");
    expect(parseTaskInput("Sport lundi", TUE).date).toBe("2026-11-30");
    expect(parseTaskInput("Courses mercredi", TUE).date).toBe("2026-11-25");
    expect(parseTaskInput("Réunion ce vendredi", TUE)).toMatchObject({ title: "Réunion", date: "2026-11-27" });
    expect(parseTaskInput("Réunion mardi", TUE).date).toBe("2026-12-01");
  });
  it("dates numériques et en toutes lettres, passage d'année et de mois", () => {
    expect(parseTaskInput("Dentiste 25/11", TUE)).toMatchObject({ title: "Dentiste", date: "2026-11-25" });
    expect(parseTaskInput("Dentiste le 3/12", TUE)).toMatchObject({ title: "Dentiste", date: "2026-12-03" });
    expect(parseTaskInput("Impôts 15/01", TUE).date).toBe("2027-01-15");
    expect(parseTaskInput("Anniversaire 25 nov", TUE).date).toBe("2026-11-25");
    expect(parseTaskInput("Bilan le 1er décembre", TUE)).toMatchObject({ title: "Bilan", date: "2026-12-01" });
    expect(parseTaskInput("Bilan 30 novembre 2027", TUE).date).toBe("2027-11-30");
    expect(parseTaskInput("Hier 23/11", TUE).date).toBe("2027-11-23");
    expect(parseTaskInput("Bissextile 29/02/2028", TUE).date).toBe("2028-02-29");
  });
  it("heures : 14h, 14h30, 9:15, à 1h, midi, minuit", () => {
    expect(parseTaskInput("Appeler demain 14h", TUE)).toMatchObject({ title: "Appeler", date: "2026-11-25", time: "14:00" });
    expect(parseTaskInput("Appeler à 14h30", TUE)).toMatchObject({ title: "Appeler", time: "14:30" });
    expect(parseTaskInput("Café 9:15", TUE).time).toBe("09:15");
    expect(parseTaskInput("Train à 1h", TUE)).toMatchObject({ title: "Train", time: "01:00", duration: null });
    expect(parseTaskInput("Déjeuner midi", TUE).time).toBe("12:00");
    expect(parseTaskInput("Feu d'artifice à minuit", TUE)).toMatchObject({ title: "Feu d'artifice", time: "00:00" });
  });
  it("durées : 30min, 1h, 1h30, pendant 2h ; une heure puis une durée", () => {
    expect(parseTaskInput("Lire 30min", TUE)).toMatchObject({ title: "Lire", duration: 30, time: null });
    expect(parseTaskInput("Sport 1h", TUE)).toMatchObject({ duration: 60, time: null });
    expect(parseTaskInput("Sport 1h30", TUE).duration).toBe(90);
    expect(parseTaskInput("Atelier pendant 2h", TUE)).toMatchObject({ title: "Atelier", duration: 120 });
    expect(parseTaskInput("Atelier 14h 2h", TUE)).toMatchObject({ time: "14:00", duration: 120 });
  });
  it("projet existant seulement ; rappel ⏰", () => {
    expect(parseTaskInput("Appeler la banque #medtech", TUE, P)).toMatchObject({ title: "Appeler la banque", project: "medtech" });
    expect(parseTaskInput("Voir #inconnu", TUE, P)).toMatchObject({ title: "Voir #inconnu", project: null });
    expect(parseTaskInput("Appeler 14h ⏰-30m #medtech", TUE, P)).toMatchObject({ reminder: 30, project: "medtech", title: "Appeler" });
    expect(parseTaskInput("Appeler ⏰", TUE).reminder).toBeNull(); // pas d'heure, pas de rappel
  });
  it("récurrences : tous les jours, chaque lundi, tous les mois le 1er", () => {
    expect(parseTaskInput("Méditer tous les jours", TUE)).toMatchObject({ title: "Méditer", recurrence: { kind: "daily" }, date: TUE });
    expect(parseTaskInput("Sport chaque lundi 7h", TUE)).toMatchObject({ title: "Sport", recurrence: { kind: "weekly", weekday: 1 }, date: "2026-11-30", time: "07:00" });
    expect(parseTaskInput("Sport chaque mardi", TUE).date).toBe(TUE);
    expect(parseTaskInput("Loyer tous les mois le 1er", TUE)).toMatchObject({ title: "Loyer", recurrence: { kind: "monthly", day: 1 }, date: "2026-12-01" });
    expect(parseTaskInput("Facture chaque mois le 30", TUE).date).toBe("2026-11-30");
    expect(parseTaskInput("Sport tous les lundis", TUE)).toMatchObject({ recurrence: { kind: "weekly", weekday: 1 } });
  });
  it("ambigu : texte gardé, date à corriger (aujourd'hui)", () => {
    expect(parseTaskInput("Rendu 31/02", TUE)).toMatchObject({ title: "Rendu 31/02", date: TUE, ambiguous: true });
    expect(parseTaskInput("Déplacer de lundi à mardi", TUE)).toMatchObject({ title: "Déplacer de lundi à mardi", date: TUE, ambiguous: true });
    expect(parseTaskInput("Lire le 45/13", TUE).ambiguous).toBe(true);
  });
});

describe("saisie : « dans N jours » et tâches sans date", () => {
  const TUE = "2026-11-24";
  it("dans 3 jours, dans une semaine, dans 2 semaines", () => {
    expect(parseTaskInput("Relancer Paul dans 3 jours", TUE).date).toBe("2026-11-27");
    expect(parseTaskInput("Bilan dans une semaine", TUE)).toMatchObject({ date: "2026-12-01", title: "Bilan" });
    expect(parseTaskInput("Bilan dans 2 semaines", TUE).date).toBe("2026-12-08");
  });
  it("sans date reconnue et sans date par défaut : tâche sans date (heure et rappel ignorés)", () => {
    expect(parseTaskInput("Choisir les photos", TUE, [], null)).toMatchObject({ title: "Choisir les photos", date: null });
    expect(parseTaskInput("Appeler vendredi", TUE, [], null).date).toBe("2026-11-27");
  });
});
