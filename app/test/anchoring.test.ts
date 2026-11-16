import { describe, expect, it } from "vitest";
import { locateQuote, quoteFrom } from "@/lib/anchoring";

const text = "Bonjour.\n\nEt bon vendredi 13 à tous. Les experts débattent encore : doit-on le considérer comme un jour de malchance ?\n\nCe qui est sûr, c'est que le loto attire. Les experts débattent encore : rien n'est sûr.";

describe("ancrage par citation", () => {
  it("crée une citation avec préfixe et suffixe, sans espaces aux bords", () => {
    const start = text.indexOf("  doit-on") >= 0 ? text.indexOf("  doit-on") : text.indexOf(" doit-on");
    const q = quoteFrom(text, start, text.indexOf("malchance") + "malchance".length)!;
    expect(q.exact).toBe("doit-on le considérer comme un jour de malchance");
    expect(q.prefix.endsWith("débattent encore :")).toBe(true);
    expect(q.suffix.startsWith("?")).toBe(true);
  });

  it("retrouve le passage malgré des espaces et retours à la ligne différents", () => {
    const q = quoteFrom(text, text.indexOf("Et bon"), text.indexOf("tous.") + 5)!;
    const other = text.replace("vendredi 13", "vendredi\n   13").replace("Bonjour.\n\n", "Bonjour. ");
    const pos = locateQuote(other, q)!;
    expect(other.slice(pos.start, pos.end).replace(/\s+/g, " ")).toBe("Et bon vendredi 13 à tous.");
  });

  it("choisit la bonne occurrence grâce au contexte", () => {
    const second = text.lastIndexOf("Les experts débattent encore");
    const q = quoteFrom(text, second, second + "Les experts débattent encore".length)!;
    const pos = locateQuote(text, q)!;
    expect(pos.start).toBe(second);
    const first = text.indexOf("Les experts débattent encore");
    const q1 = quoteFrom(text, first, first + "Les experts débattent encore".length)!;
    expect(locateQuote(text, q1)!.start).toBe(first);
  });

  it("renvoie null si le passage n'existe plus", () => {
    expect(locateQuote(text, { exact: "phrase disparue", prefix: "", suffix: "" })).toBeNull();
    expect(quoteFrom(text, 3, 3)).toBeNull();
  });
});
