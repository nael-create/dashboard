import { describe, expect, it } from "vitest";
import { acceptedAnswers, buildDeck, checkWritten, choicesFor, normalizeAnswer, shouldRecord, shuffle, type PracticeCard } from "@/lib/practice";
import { afterAnswer } from "@/lib/leitner";

const card = (id: string, term: string, extra: Partial<PracticeCard> = {}): PracticeCard => ({ id, term, definition: `déf ${term}`, example: "", box: 1, due: "2026-11-15", ...extra });

describe("réponses écrites", () => {
  it("ignore accents, majuscules, apostrophes et espaces", () => {
    expect(normalizeAnswer("  S’escrimer ")).toBe("s escrimer");
    expect(checkWritten("S'escrimer", "s escrimer")).toBe("correct");
    expect(checkWritten("Lésiner", "LESINER")).toBe("correct");
    expect(checkWritten("Fenêtre d'Overton", "fenetre d overton")).toBe("correct");
  });
  it("accepte chaque variante d'un terme à plusieurs mots", () => {
    expect(acceptedAnswers("Éminemment, diablement, sensiblement")).toContain("diablement");
    expect(checkWritten("Éminemment, diablement, sensiblement", "Diablement")).toBe("correct");
  });
  it("une faute de frappe sur un mot long compte juste ; sinon faux", () => {
    expect(checkWritten("Ratiociner", "ratiocinr")).toBe("close");
    expect(checkWritten("Dénouer", "nouer")).toBe("wrong");
    expect(checkWritten("Lésiner", "")).toBe("wrong");
    expect(checkWritten("Tributaire", "tributeur")).toBe("wrong");
  });
});

describe("paquets et QCM", () => {
  const cards = [card("a", "Alpha", { due: "2026-11-14" }), card("b", "Bravo", { box: 5, due: "2026-12-01" }), card("c", "Charlie"), card("d", "Delta"), card("e", "Echo")];
  it("paquets : à revoir, pas encore apprises, toutes", () => {
    expect(buildDeck(cards, "due", "2026-11-14", 4).map((c) => c.id)).toEqual(["a"]);
    expect(buildDeck(cards, "learning", "2026-11-14", 4).map((c) => c.id)).toEqual(["a", "c", "d", "e"]);
    expect(buildDeck(cards, "all", "2026-11-14", 4)).toHaveLength(5);
  });
  it("QCM : 4 choix dont la bonne réponse, sans doublon", () => {
    const ch = choicesFor(cards[0], cards);
    expect(ch).toHaveLength(4);
    expect(ch).toContain("Alpha");
    expect(new Set(ch).size).toBe(4);
    expect(choicesFor(cards[0], cards.slice(0, 2))).toHaveLength(2);
  });
  it("mélange sans perdre de carte", () => {
    expect(shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("mémoire", () => {
  it("« À revoir » toujours enregistré ; « Je sais » seulement si la carte est due", () => {
    expect(shouldRecord(false, card("x", "X", { due: "2026-12-01" }), "2026-11-14")).toBe(true);
    expect(shouldRecord(true, card("x", "X", { due: "2026-12-01" }), "2026-11-14")).toBe(false);
    expect(shouldRecord(true, card("x", "X", { due: "2026-11-14" }), "2026-11-14")).toBe(true);
  });
  it("délais de Leitner", () => {
    expect(afterAnswer(1, true)).toEqual({ box: 2, days: 2 });
    expect(afterAnswer(3, true)).toEqual({ box: 4, days: 14 });
    expect(afterAnswer(6, true)).toEqual({ box: 6, days: 90 });
    expect(afterAnswer(5, false)).toEqual({ box: 1, days: 1 });
  });
});
