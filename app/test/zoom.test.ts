import { describe, expect, it } from "vitest";
import { stepZoom, zoomKey, zoomPage } from "@/lib/zoom";

describe("zoom par page", () => {
  it("une clé par section : accueil, projets (onglets et projets compris), news…", () => {
    expect(zoomPage("/")).toBe("accueil");
    expect(zoomPage("/projets/aujourdhui")).toBe("projets");
    expect(zoomPage("/projets/medtech/docs/brief")).toBe("projets");
    expect(zoomPage("/news/ft-world")).toBe("news");
    expect(zoomKey("/notions")).toBe("dashboard.zoom.notions");
  });
  it("niveaux 75 → 125 %", () => {
    expect(stepZoom(0.9, -1)).toBe(0.8);
    expect(stepZoom(0.75, -1)).toBe(0.75);
    expect(stepZoom(1.1, 1)).toBe(1.25);
  });
});
