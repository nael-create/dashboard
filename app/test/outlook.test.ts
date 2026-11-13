import { describe, expect, it } from "vitest";
import { emailDocument, explainAuthError, sanitizeEmail } from "@/lib/outlook";

describe("nettoyage du HTML des newsletters", () => {
  const dirty = `
    <style>.x{color:red}</style>
    <script>alert(1)</script>
    <p onclick="steal()" style="color:blue">Bonjour <a href="javascript:alert(1)">piège</a> <a href="https://exemple.fr/article">lien</a></p>
    <img src="https://tracker.exemple/pixel.gif" onerror="x()">
    <img src="data:image/png;base64,AAAA">
    <iframe src="https://exemple.fr"></iframe>
    <form action="https://exemple.fr"><input name="mdp"></form>
    <object data="x.swf"></object>
    <svg><script>alert(2)</script></svg>
    <table cellpadding="4"><tr><td bgcolor="#fff">cellule</td></tr></table>`;
  const clean = sanitizeEmail(dirty);

  it("retire scripts, formulaires, iframes, objets et gestionnaires d'événements", () => {
    for (const bad of ["<script", "onclick", "onerror", "<iframe", "<form", "<input", "<object", "javascript:", "<svg"]) {
      expect(clean.toLowerCase()).not.toContain(bad);
    }
  });

  it("garde la mise en forme utile et ouvre les liens dans un nouvel onglet", () => {
    expect(clean).toContain("<style>");
    expect(clean).toContain('style="color:blue"');
    expect(clean).toContain('href="https://exemple.fr/article"');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('bgcolor="#fff"');
  });

  it("bloque les images distantes par défaut via la politique de sécurité du cadre", () => {
    expect(emailDocument(clean, false)).toContain("img-src data:;");
    expect(emailDocument(clean, true)).toContain("img-src data: https: http:");
    expect(emailDocument(clean, false)).toContain("default-src 'none'");
  });
});

describe("messages d'erreur de connexion", () => {
  it("explique le consentement administrateur", () => {
    expect(explainAuthError("access_denied", "AADSTS65001: The user or administrator has not consented")).toMatch(/administrateur/);
  });
  it("explique un mauvais type de compte", () => {
    expect(explainAuthError("invalid_request", "AADSTS50020: User account from identity provider does not exist")).toMatch(/type de compte/);
  });
});
