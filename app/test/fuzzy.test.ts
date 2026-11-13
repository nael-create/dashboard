import { describe, expect, it } from "vitest";
import { fuzzyFilter, fuzzyScore } from "@/lib/fuzzy";

describe("recherche approximative", () => {
  it("insensible aux accents et à la casse", () => {
    expect(fuzzyScore("economie", "Économie mondiale")).not.toBeNull();
    expect(fuzzyScore("REVUE", "revue de la semaine")).not.toBeNull();
  });
  it("lettres dans l'ordre : « tx dir » trouve « Taux directeur »", () => {
    expect(fuzzyScore("tx dir", "Taux directeur")).not.toBeNull();
    expect(fuzzyScore("zzz", "Taux directeur")).toBeNull();
  });
  it("trie : début de mot > contenu > lettres éparses", () => {
    const items = ["Plan de la maison", "Maison de campagne", "Mémo : marcher, aisément, son"];
    expect(fuzzyFilter("maison", items, (s) => s)).toEqual(["Maison de campagne", "Plan de la maison"]);
  });
  it("ne trouve pas des lettres trop dispersées dans un long texte", () => {
    expect(fuzzyScore("abc", "a" + "x".repeat(40) + "b" + "y".repeat(40) + "c")).toBeNull();
  });
});
