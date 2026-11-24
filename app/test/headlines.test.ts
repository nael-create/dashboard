import { describe, expect, it } from "vitest";
import { gridLayout, interleave } from "@/lib/headlines";

const items = (src: string, n: number) => Array.from({ length: n }, (_, i) => ({ sourceId: src, id: `${src}${i + 1}` }));
const maxRun = (list: { sourceId: string }[]) => {
  let best = 0, run = 0;
  list.forEach((x, i) => { run = i && list[i - 1].sourceId === x.sourceId ? run + 1 : 1; best = Math.max(best, run); });
  return best;
};

describe("alternance des sources", () => {
  it("garde l'ordre du FT comme colonne vertébrale, 2 au plus d'affilée, autres sources à tour de rôle", () => {
    const out = interleave(items("ft", 10), [items("verge", 5), items("maddy", 5)], 10);
    expect(out.map((x) => x.id)).toEqual(["ft1", "ft2", "verge1", "ft3", "ft4", "maddy1", "ft5", "ft6", "verge2", "ft7"]);
    expect(maxRun(out)).toBeLessThanOrEqual(2);
  });
  it("sans FT, les autres s'alternent ; jamais 3 d'affilée", () => {
    const out = interleave([], [items("verge", 6), items("maddy", 1)], 10);
    expect(maxRun(out)).toBeLessThanOrEqual(2);
    expect(out.map((x) => x.id)).toEqual(["verge1", "maddy1", "verge2", "verge3"]);
  });
  it("s'arrête plutôt que d'enchaîner 3 sujets de la même source", () => {
    expect(interleave(items("ft", 10), [], 10).map((x) => x.id)).toEqual(["ft1", "ft2"]);
  });
});

describe("mise en page sans trou", () => {
  const sum = (n: number) => gridLayout(n).reduce((s, c) => s + Number(c.span.split("-").pop()), 0);
  it("chaque rangée fait 12 colonnes", () => {
    for (let n = 1; n <= 16; n++) expect(sum(n) % 12, `n=${n}`).toBe(0);
  });
  it("rangées de 6 petites images dès 4 sujets, dernière rangée sans trou", () => {
    expect(gridLayout(12).every((c) => !c.big && c.span === "lg:col-span-2")).toBe(true);
    expect(gridLayout(8).map((c) => c.span)).toEqual([...Array(6).fill("lg:col-span-2"), "lg:col-span-6", "lg:col-span-6"]);
    expect(gridLayout(5).map((c) => c.span)).toEqual([...Array(3).fill("lg:col-span-4"), "lg:col-span-6", "lg:col-span-6"]);
    expect(gridLayout(4).map((c) => c.span)).toEqual(Array(4).fill("lg:col-span-3"));
  });
  it("peu de sujets : pleine largeur, moitiés ou tiers", () => {
    expect(gridLayout(1)).toEqual([{ span: "lg:col-span-12", big: true }]);
    expect(gridLayout(2).map((c) => c.span)).toEqual(["lg:col-span-6", "lg:col-span-6"]);
    expect(gridLayout(3).map((c) => c.span)).toEqual(["lg:col-span-4", "lg:col-span-4", "lg:col-span-4"]);
    expect(gridLayout(0)).toEqual([]);
  });
});
