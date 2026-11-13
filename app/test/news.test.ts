import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "news-test-"));
vi.stubEnv("CONTENT_DIR", dir);
const { parseFeed, dedupe, siteDomain } = await import("@/lib/rss");
const { defaultNewsFile, parseNews, readNewsConfig, saveLayout, updateSource } = await import("@/lib/news-config");
const { looksPersonal } = await import("@/lib/news-schema");

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>T</title><link>https://www.ft.com</link>
<item><title><![CDATA[Markets rally &amp; bonds fall]]></title><link>https://www.ft.com/content/a?syn=1</link><pubDate>Fri, 13 Nov 2026 07:00:00 GMT</pubDate><media:thumbnail url="https://images.ft.com/x.jpg"/></item>
<item><title>Second story here today</title><link>https://www.ft.com/content/b</link><pubDate>Fri, 13 Nov 2026 06:00:00 GMT</pubDate><enclosure url="https://img/y.png" type="image/png"/></item>
</channel></rss>`;
const GOOGLE = `<rss><channel><link>https://news.google.com</link><item><title>China stages Pacific drills near Taiwan, officials say - Reuters</title><link>https://news.google.com/rss/articles/abc?oc=5</link><pubDate>Fri, 13 Nov 2026 04:05:00 GMT</pubDate><source url="https://www.reuters.com">Reuters</source></item></channel></rss>`;
const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><link href="https://blog.exemple.fr/"/><entry><title>Billet Atom</title><link rel="alternate" href="https://blog.exemple.fr/billet"/><updated>2026-11-12T10:00:00Z</updated></entry></feed>`;

describe("analyse des flux", () => {
  it("RSS : titre, lien, date, vignette (media:thumbnail, enclosure)", () => {
    const { items, siteDomain: d } = parseFeed(RSS, { id: "ft", name: "FT", url: "https://www.ft.com/rss/home" });
    expect(items[0]).toMatchObject({ title: "Markets rally & bonds fall", thumbnail: "https://images.ft.com/x.jpg", date: "2026-11-13T07:00:00.000Z" });
    expect(items[1].thumbnail).toBe("https://img/y.png");
    expect(d).toBe("ft.com");
  });
  it("Google News : retire « - Reuters » et garde l'éditeur", () => {
    const { items } = parseFeed(GOOGLE, { id: "r", name: "Reuters", url: "https://news.google.com/rss/search?q=when:24h+site:reuters.com" });
    expect(items[0]).toMatchObject({ title: "China stages Pacific drills near Taiwan, officials say", publisher: "Reuters", thumbnail: null });
    expect(siteDomain("https://news.google.com/rss/search?q=when:24h+site:reuters.com/business")).toBe("reuters.com");
  });
  it("Atom", () => {
    expect(parseFeed(ATOM, { id: "a", name: "A", url: "https://blog.exemple.fr/feed" }).items[0].link).toBe("https://blog.exemple.fr/billet");
  });
  it("refuse ce qui n'est pas un flux", () => {
    expect(() => parseFeed("<html><body>x</body></html>", { id: "x", name: "x", url: "https://x" })).toThrow(/RSS/);
  });
});

describe("dédoublonnage", () => {
  const a = (id: string, title: string, link: string) => ({ id, title, link, publisher: "", sourceId: "s", date: null, thumbnail: null });
  it("même URL (paramètres ignorés) ou titre quasi identique", () => {
    const out = dedupe([
      a("1", "Fed holds rates steady as inflation cools further", "https://www.ft.com/content/a?syn=1"),
      a("2", "Autre titre", "https://ft.com/content/a"),
      a("3", "Fed holds rates steady as inflation cools further again", "https://reuters.com/x"),
      a("4", "Totally different headline about oil prices", "https://reuters.com/y"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["1", "4"]);
  });
});

describe("NEWS.md", () => {
  it("crée le fichier par défaut avec les 7 sources, toutes activées", async () => {
    const cfg = await readNewsConfig();
    expect(cfg.sources.map((s) => s.id)).toEqual(["ft-international", "ft-world", "ft-markets", "ft-global-economy", "reuters", "reuters-business", "reuters-markets"]);
    expect(cfg.sources.every((s) => s.enabled)).toBe(true);
    expect(parseNews(defaultNewsFile()).order).toHaveLength(7);
  });
  it("modifie une source et l'ordre ligne par ligne, en gardant les notes écrites à la main", async () => {
    const file = path.join(dir, "NEWS.md");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("enabled: yes\n", "enabled: yes\nnote: ma note perso\n"));
    let cfg = await readNewsConfig();
    await updateSource(cfg.version, "ft-international", { color: "#123456", enabled: false });
    cfg = await readNewsConfig();
    await saveLayout(cfg.version, { mode: "category", order: [{ key: "cat:Marchés", visible: false }] });
    const text = fs.readFileSync(file, "utf8");
    expect(text).toContain("## FT International\nid: ft-international\nurl: https://www.ft.com/rss/home\ncategory: Monde\ncolor: #123456\nenabled: no\nnote: ma note perso\n");
    expect(text).toContain("## Ordre des widgets\n\n- [ ] cat:Marchés\n");
    expect(text).toContain("widgets: category");
  });
  it("détecte les liens contenant une clé personnelle", () => {
    expect(looksPersonal("https://www.ft.com/myft/following/0f1e2d3c-aaaa-bbbb-cccc-1234567890ab.rss")).toBe(true);
    expect(looksPersonal("https://exemple.fr/rss?token=abcdef123456")).toBe(true);
    expect(looksPersonal("https://www.ft.com/world?format=rss")).toBe(false);
  });
});
