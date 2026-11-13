import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fav-test-"));
vi.stubEnv("CONTENT_DIR", dir);
vi.stubEnv("DASHBOARD_DATA_DIR", path.join(dir, "data"));
const F = await import("@/lib/favorites");
const N = await import("@/lib/notions");
const file = path.join(dir, "FAVORIS.md");

describe("FAVORIS.md", () => {
  it("ajoute (plus récent en haut) puis retire avec la même étoile", async () => {
    expect(await F.toggleFavorite({ type: "article", ref: "https://www.ft.com/content/abc", title: "Fed holds rates", source: "FT World", published: "2026-11-12" }, "2026-11-13")).toEqual({ starred: true });
    await F.toggleFavorite({ type: "newsletter", ref: "https://outlook.live.com/owa/?ItemID=AQMk%3D&exvsurl=1", title: "La lettre éco", source: "Le Monde" }, "2026-11-13");
    const t = fs.readFileSync(file, "utf8");
    expect(t).toContain("## 2026-11-13 — La lettre éco\nid: fav-20261113-2\ntype: newsletter\nref: https://outlook.live.com/owa/?ItemID=AQMk%3D&exvsurl=1\nsource: Le Monde\n");
    expect(t.indexOf("La lettre éco")).toBeLessThan(t.indexOf("Fed holds rates"));
    expect(t).toContain("published: 2026-11-12");
    expect(await F.toggleFavorite({ type: "article", ref: "https://www.ft.com/content/abc", title: "x" }, "2026-11-14")).toEqual({ starred: false });
    expect(fs.readFileSync(file, "utf8")).not.toContain("Fed holds rates");
  });

  it("note personnelle ajoutée, modifiée, effacée", async () => {
    let { favorites, version } = await F.readFavorites();
    await F.setFavoriteNote(version, favorites[0].id, "À relire dimanche");
    ({ favorites, version } = await F.readFavorites());
    expect(favorites[0].note).toBe("À relire dimanche");
    await F.setFavoriteNote(version, favorites[0].id, "");
    expect((await F.readFavorites()).favorites[0].note).toBe("");
  });

  it("référence interne disparue → « Élément supprimé », sans erreur", async () => {
    await N.addNotion({ term: "Spread", definition: "écart" }, "2026-11-13");
    await F.toggleFavorite({ type: "notion", ref: "notion:spread", title: "Spread" }, "2026-11-13");
    await F.toggleFavorite({ type: "project", ref: "project:inexistant", title: "Ancien projet" }, "2026-11-13");
    let r = (await F.resolveFavorites()).favorites;
    expect(r.find((f) => f.ref === "notion:spread")).toMatchObject({ missing: false, href: "/notions#notion-spread" });
    expect(r.find((f) => f.ref === "project:inexistant")).toMatchObject({ missing: true, href: null });
    const { version } = await N.readNotions();
    await N.deleteNotion(version, "spread");
    r = (await F.resolveFavorites()).favorites;
    expect(r.find((f) => f.ref === "notion:spread")?.missing).toBe(true);
  });

  it("refuse les références invalides", async () => {
    await expect(F.toggleFavorite({ type: "article", ref: "javascript:alert(1)", title: "x" }, "2026-11-13")).rejects.toThrow(/invalide/);
    await expect(F.toggleFavorite({ type: "project", ref: "project:../etc", title: "x" }, "2026-11-13")).rejects.toThrow(/invalide/);
  });
});
