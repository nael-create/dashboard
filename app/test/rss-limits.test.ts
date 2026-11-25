import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFeed, parseRetryAfter, rateLimitDelay, ttlFor } from "@/lib/rss";

const MIN = 60_000;
const RSS = `<?xml version="1.0"?><rss><channel><title>T</title><link>https://ex.test</link><item><title>Un titre</title><link>https://ex.test/a</link></item></channel></rss>`;

describe("flux : demandes limitées (HTTP 429)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pause : Retry-After respecté, sinon 15 min puis 30, 60, 120 au plus", () => {
    expect(parseRetryAfter("120", 0)).toBe(120_000);
    expect(parseRetryAfter("Wed, 25 Nov 2026 12:10:00 GMT", Date.parse("2026-11-25T12:00:00Z"))).toBe(10 * MIN);
    expect(parseRetryAfter(null, 0)).toBeNull();
    expect([1, 2, 3, 4, 5].map((n) => rateLimitDelay(n, null) / MIN)).toEqual([15, 30, 60, 120, 120]);
    expect(rateLimitDelay(1, 45 * MIN)).toBe(45 * MIN);
    expect(rateLimitDelay(1, 10 * 3600_000)).toBe(120 * MIN);
  });

  it("Google News rafraîchi toutes les 15 min, les autres toutes les 5 min", () => {
    expect(ttlFor("https://news.google.com/rss/search?q=x")).toBe(15 * MIN);
    expect(ttlFor("https://www.theverge.com/rss/index.xml")).toBe(5 * MIN);
  });

  it("après un 429, pas de nouvelle demande pendant la pause, même avec « Rafraîchir » ; message clair", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 429, headers: { "Retry-After": "120" } }));
    vi.stubGlobal("fetch", fetchMock);
    const src = { id: "limite-test", name: "Test", url: "https://limite.test/rss", category: "x", color: "#000000", enabled: true };
    const first = await loadFeed(src, true);
    expect(first.ok).toBe(false);
    expect(first.error).toBe("trop de demandes (HTTP 429) : limite.test demande de patienter");
    expect(first.retryAt! - Date.now()).toBeGreaterThan(14 * MIN);
    await loadFeed(src, true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("un flux en échec garde les articles du dernier chargement réussi", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(RSS, { status: 200 })));
    const src = { id: "garde-test", name: "Test", url: "https://garde.test/rss", category: "x", color: "#000000", enabled: true };
    expect((await loadFeed(src)).items).toHaveLength(1);
  });
});
